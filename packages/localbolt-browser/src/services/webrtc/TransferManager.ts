/**
 * TransferManager — owns file send/receive, chunk processing,
 * pause/resume/cancel, progress, stats, backpressure, and metrics.
 *
 * Extracted from WebRTCService (A2). All behavior preserved exactly.
 *
 * State ownership: Like HandshakeManager, state lives on WebRTCService.
 * TransferManager reads/writes through a TransferContext bridge so that
 * tests (which set fields via `(service as any).fieldName`) continue to work.
 */
import { sealBoxPayload, openBoxPayload, DEFAULT_CHUNK_SIZE, EncryptionError, IntegrityError, hashFile, toBase64, fromBase64, bufferToHex } from '@the9ines/bolt-core';

import type { BtrModeValue } from '@the9ines/bolt-core';

/** BTR mode string constant — avoids importing BtrMode (which breaks mocked tests). */
const BTR_FULL = 'FULL_BTR' as const;
import { WebRTCError, TransferError } from '../../types/webrtc-errors.js';
import { ENABLE_TRANSFER_METRICS, TransferMetricsCollector, summarizeTransfer } from './transferMetrics.js';
import { dcSendMessage } from './EnvelopeCodec.js';
import type { FileChunkMessage, ActiveTransfer, TransferProgress, DcControlMessage } from './types.js';

/** RU3: classify errors into user-meaningful reasons for toast display. */
function classifyTransferError(error: Error): string {
  const msg = error.message.toLowerCase();
  if (error instanceof EncryptionError || msg.includes('encrypt') || msg.includes('decrypt')) {
    return 'Encryption error — please reconnect and try again';
  }
  if (error instanceof IntegrityError || msg.includes('integrity') || msg.includes('hash')) {
    return 'File verification failed — data may be corrupted';
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'Transfer timed out — connection may be too slow';
  }
  if (msg.includes('disconnect') || msg.includes('closed') || msg.includes('connection')) {
    return 'Connection lost during transfer';
  }
  return 'Transfer failed — please try again';
}
import { CANONICAL_CONTROL_TYPES } from './types.js';
import { getPolicyAdapter } from './PolicyAdapter.js';
import type { PolicyAdapter, PolicyDecideInput } from './PolicyAdapter.js';
import type { WasmBtrTransferAdapter, BtrEnvelopeFields } from './BtrTransferAdapter.js';

/** Generate a spec-compliant transfer_id (bytes16 → hex, 32 chars). */
function generateTransferId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bufferToHex(bytes.buffer);
}

/**
 * TransferContext — the subset of shared state that TransferManager needs.
 */
export interface TransferContext {
  // Crypto keys
  getKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } | null;
  getRemotePublicKey(): Uint8Array | null;

  // DataChannel
  getDc(): RTCDataChannel | null;

  // Handshake state (read-only from transfer perspective)
  isHelloComplete(): boolean;
  getSessionGeneration(): number;
  hasCapability(name: string): boolean;
  negotiatedEnvelopeV1(): boolean;

  // Transfer state (read/write)
  getTransferPaused(): boolean;
  setTransferPaused(v: boolean): void;
  getTransferCancelled(): boolean;
  setTransferCancelled(v: boolean): void;
  getReceiveBuffers(): Map<string, (Blob | null)[]>;
  getGuardedTransfers(): Map<string, ActiveTransfer>;
  getSendTransferIds(): Map<string, string>;
  getRecvTransferIds(): Map<string, string>;

  // Stats
  getTransferStartTime(): number;
  setTransferStartTime(v: number): void;
  getPauseDuration(): number;
  setPauseDuration(v: number): void;
  getLastPausedAt(): number | null;
  setLastPausedAt(v: number | null): void;

  // Metrics
  getMetricsCollector(): TransferMetricsCollector | null;
  setMetricsCollector(v: TransferMetricsCollector | null): void;
  getMetricsFirstProgressRecorded(): boolean;
  setMetricsFirstProgressRecorded(v: boolean): void;

  // Backpressure
  getBackpressureReject(): ((err: Error) => void) | undefined;
  setBackpressureReject(v: ((err: Error) => void) | undefined): void;

  // Completion timer
  getCompletionTimeout(): ReturnType<typeof setTimeout> | null;
  setCompletionTimeout(v: ReturnType<typeof setTimeout> | null): void;

  // Progress callback
  getOnProgressCallback(): ((progress: TransferProgress) => void) | undefined;

  // Identity key (for guarded transfers)
  getRemoteIdentityKey(): Uint8Array | null;

  // Callbacks
  onReceiveFile(file: Blob, filename: string): void;
  onError(error: Error): void;
  disconnect(): void;

  // Envelope send helper
  sendMessage(innerMsg: any, btrFields?: BtrEnvelopeFields): void;

  // HELLO wait (delegates to service's waitForHello)
  waitForHello(): Promise<void>;

  // BTR state
  getBtrMode(): BtrModeValue | null;
  getBtrAdapter(): WasmBtrTransferAdapter | null;
}

/** DP-9: Max time (ms) to wait for onbufferedamountlow before polling fallback. */
const BACKPRESSURE_TIMEOUT_MS = 5000;

export class TransferManager {
  // DP-9: Guard against concurrent sendFile calls (property overwrite on onbufferedamountlow)
  private sendInProgress = false;

  constructor(private ctx: TransferContext) {}

  // ─── File Transfer (Send) ──────────────────────────────────────────

  async sendFile(file: File): Promise<void> {
    // DP-9: Prevent concurrent sendFile calls — property-based onbufferedamountlow
    // only supports one handler at a time; concurrent sends overwrite each other.
    if (this.sendInProgress) {
      throw new TransferError('Transfer already in progress');
    }
    this.sendInProgress = true;

    // Wait for HELLO handshake before allowing file transfer
    if (!this.ctx.isHelloComplete()) {
      await this.ctx.waitForHello();
    }

    const dc = this.ctx.getDc();
    // readyState is 'open' for RTCDataChannel, 1 (WebSocket.OPEN) for WebSocket
    if (!dc || (dc.readyState !== 'open' && (dc.readyState as unknown) !== 1)) {
      this.sendInProgress = false;
      throw new TransferError('Data channel not open');
    }
    const remotePublicKey = this.ctx.getRemotePublicKey();
    if (!remotePublicKey) {
      throw new EncryptionError('No remote public key');
    }

    const totalChunks = Math.ceil(file.size / DEFAULT_CHUNK_SIZE);
    const transferId = generateTransferId();
    this.ctx.getSendTransferIds().set(file.name, transferId);

    // Compute file hash if bolt.file-hash was negotiated
    let fileHash: string | undefined;
    if (this.ctx.hasCapability('bolt.file-hash')) {
      fileHash = await hashFile(file);
    }

    // BTR: initialize transfer context if FullBtr negotiated
    const btrAdapter = this.ctx.getBtrAdapter();
    const isBtrMode = this.ctx.getBtrMode() === BTR_FULL && btrAdapter !== null;
    let senderRatchetPub: Uint8Array | undefined;
    if (isBtrMode) {
      const transferIdBytes = fromBase64(toBase64(new TextEncoder().encode(transferId.slice(0, 16).padEnd(16, '\0')))).slice(0, 16);
      // Use hex transferId as 16-byte identifier
      const tidBytes = new Uint8Array(16);
      for (let i = 0; i < 16 && i * 2 < transferId.length; i++) {
        tidBytes[i] = parseInt(transferId.slice(i * 2, i * 2 + 2), 16);
      }
      const [_btrCtx, ratchetPub] = btrAdapter.beginSend(tidBytes, remotePublicKey);
      senderRatchetPub = ratchetPub;
      console.log(`[BTR_TRANSFER_SEND] DH ratchet step complete, generation=${btrAdapter.generation}`);
    }

    console.log(`[TRANSFER] Sending ${file.name} (${file.size} bytes, ${totalChunks} chunks, tid=${transferId})`);
    this.ctx.setTransferCancelled(false);
    this.ctx.setTransferPaused(false);
    this.ctx.setTransferStartTime(Date.now());
    this.ctx.setPauseDuration(0);
    this.ctx.setLastPausedAt(null);

    if (ENABLE_TRANSFER_METRICS) {
      const collector = new TransferMetricsCollector();
      this.ctx.setMetricsCollector(collector);
      this.ctx.setMetricsFirstProgressRecorded(false);
      collector.begin(transferId, file.size, DEFAULT_CHUNK_SIZE, totalChunks);
    }

    try {
      const policy = getPolicyAdapter();
      let chunksSent = 0;
      let lastProgressReportMs = Date.now();
      let lastReportedPercent = 0;
      const STALL_WARN_MS = 5_000;
      const STALL_THRESHOLD_MS = 30_000;
      let lastProgressAt = Date.now();

      while (chunksSent < totalChunks) {
        if (this.ctx.getTransferCancelled()) throw new TransferError('Transfer cancelled by user');

        while (this.ctx.getTransferPaused()) {
          await new Promise(r => setTimeout(r, 100));
          if (this.ctx.getTransferCancelled()) throw new TransferError('Transfer cancelled while paused');
        }

        // Observe DC backpressure state for policy input
        const dcForPressure = this.ctx.getDc();
        let pressure = 0; // Clear
        if (dcForPressure) {
          if (dcForPressure.bufferedAmount > dcForPressure.bufferedAmountLowThreshold * 4) {
            pressure = 2; // Pressured
          } else if (dcForPressure.bufferedAmount > dcForPressure.bufferedAmountLowThreshold) {
            pressure = 1; // Elevated
          }
        }

        // Build pending chunk IDs from current position
        const remaining = totalChunks - chunksSent;
        const pendingIds = new Uint32Array(Math.min(remaining, 64));
        for (let j = 0; j < pendingIds.length; j++) {
          pendingIds[j] = chunksSent + j;
        }

        const decision = policy.decide({
          pendingChunkIds: pendingIds,
          rttMs: 10,        // Default; future: measure from DC stats
          lossPpm: 0,       // Default; future: measure from DC stats
          deviceClass: 3,   // Unknown; future: detect from navigator
          maxParallelChunks: 4,
          maxInFlightBytes: 262144,
          priority: 128,
          fairnessMode: 0,  // Balanced
          configuredChunkSize: DEFAULT_CHUNK_SIZE,
          transportMaxMessageSize: 262144,
          pressure,
        });

        // Handle backpressure pause from policy
        if (decision.backpressure === 'pause' || decision.nextChunkIds.length === 0) {
          // Wait for buffer to drain before re-evaluating
          await this.awaitBackpressureDrain();
          continue;
        }

        // Send each chunk in this round's schedule
        for (const chunkIndex of decision.nextChunkIds) {
          if (this.ctx.getTransferCancelled()) throw new TransferError('Transfer cancelled by user');

          while (this.ctx.getTransferPaused()) {
            await new Promise(r => setTimeout(r, 100));
            if (this.ctx.getTransferCancelled()) throw new TransferError('Transfer cancelled while paused');
          }

          const start = chunkIndex * DEFAULT_CHUNK_SIZE;
          const end = Math.min(start + DEFAULT_CHUNK_SIZE, file.size);
          const raw = new Uint8Array(await file.slice(start, end).arrayBuffer());

          const keyPair = this.ctx.getKeyPair();
          if (!keyPair) throw new EncryptionError('No ephemeral key pair');

          let encrypted: string;
          let btrFields: BtrEnvelopeFields | undefined;

          if (isBtrMode && btrAdapter?.activeTransferCtx) {
            // BTR mode: encrypt chunk with chain-derived message key (NaCl secretbox)
            const [chainIdx, sealed] = btrAdapter.activeTransferCtx.sealChunk(raw);
            encrypted = toBase64(sealed);
            btrFields = btrAdapter.buildEnvelopeFields(chainIdx, chunkIndex === 0 ? senderRatchetPub : undefined);
          } else {
            // Static ephemeral mode: encrypt chunk with NaCl box
            encrypted = sealBoxPayload(raw, remotePublicKey, keyPair.secretKey);
          }

          const msg: FileChunkMessage = {
            type: 'file-chunk',
            filename: file.name,
            chunk: encrypted,
            chunkIndex,
            totalChunks,
            fileSize: file.size,
            transferId,
            ...(fileHash && chunkIndex === 0 ? { fileHash } : {}),
          };

          // Backpressure — wait for buffer to drain (N1: cancelable by disconnect)
          await this.awaitBackpressureDrain();

          if (this.ctx.getTransferCancelled()) throw new TransferError('Transfer cancelled by user');

          chunksSent++;
          lastProgressAt = Date.now();
          this.ctx.getMetricsCollector()?.recordChunkSend(this.ctx.getDc()!.bufferedAmount, chunksSent);
          this.ctx.sendMessage(msg, btrFields);

          // Progress cadence — policy decides whether to emit
          const now = Date.now();
          const cadence = policy.progressCadence({
            bytesTransferred: end,
            totalBytes: file.size,
            elapsedSinceLastReportMs: now - lastProgressReportMs,
            lastReportedPercent,
            minIntervalMs: 250,
            minPercentDelta: 1,
          });

          if (cadence.shouldEmit) {
            lastProgressReportMs = now;
            lastReportedPercent = cadence.percent;
            this.emitProgress(file.name, chunksSent, totalChunks, end, file.size, 'transferring');
          }
        }

        // Stall detection between rounds
        const stallResult = policy.detectStall({
          bytesAcked: chunksSent * DEFAULT_CHUNK_SIZE,
          totalBytes: file.size,
          msSinceProgress: Date.now() - lastProgressAt,
          stallThresholdMs: STALL_THRESHOLD_MS,
          warnThresholdMs: STALL_WARN_MS,
        });
        if (stallResult.classification === 'warning') {
          console.warn(`[TRANSFER] Stall warning: no progress for ${stallResult.msSinceProgress}ms`);
        } else if (stallResult.classification === 'stalled') {
          console.error(`[TRANSFER] Stall detected: no progress for ${stallResult.msSinceProgress}ms`);
        }

        // Pacing delay between rounds
        if (decision.pacingDelayMs > 0 && chunksSent < totalChunks) {
          await new Promise(r => setTimeout(r, decision.pacingDelayMs));
        }
      }

      console.log(`[TRANSFER] All chunks sent for ${file.name}`);
      this.ctx.getSendTransferIds().delete(file.name);

      // BTR: cleanup transfer context
      if (isBtrMode && btrAdapter) {
        btrAdapter.endTransfer();
        console.log('[BTR_TRANSFER_COMPLETE] Transfer context cleaned up');
      }

      const collector = this.ctx.getMetricsCollector();
      console.log('[TRANSFER_DONE] collector:', !!collector);
      if (collector) {
        const metrics = collector.finish();
        this.ctx.setMetricsCollector(null);
        this.ctx.setMetricsFirstProgressRecorded(false);
        if (metrics) console.log('[TRANSFER_METRICS]', JSON.stringify(summarizeTransfer(metrics)));
      }

      // Emit completion after a brief delay so UI can process final progress
      // UI-XFER-1: guard against false completion after cancel terminal state
      this.ctx.setCompletionTimeout(setTimeout(() => {
        if (this.ctx.getTransferCancelled()) return;
        this.emitProgress(file.name, totalChunks, totalChunks, file.size, file.size, 'completed');
      }, 50));
      this.sendInProgress = false;
    } catch (error) {
      this.sendInProgress = false;
      this.ctx.getSendTransferIds().delete(file.name);

      const collector = this.ctx.getMetricsCollector();
      if (collector) {
        const metrics = collector.finish();
        this.ctx.setMetricsCollector(null);
        this.ctx.setMetricsFirstProgressRecorded(false);
        if (metrics) console.log('[TRANSFER_METRICS]', JSON.stringify(summarizeTransfer(metrics)));
      }

      if (!(error instanceof TransferError && error.message.includes('cancelled'))) {
        // RU3: classify error for user-meaningful toast
        const detail = error instanceof Error ? classifyTransferError(error) : 'Transfer failed';
        this.emitProgress(file.name, 0, totalChunks, 0, file.size, 'error', detail);
      }
      throw error;
    }
  }

  // ─── Backpressure drain helper ───────────────────────────────────

  /**
   * Wait for DC buffer to drain below threshold.
   * Extracted from the send loop for reuse by policy-driven scheduling.
   * Preserves DP-9 timeout fallback and N1 disconnect cancellation.
   */
  private async awaitBackpressureDrain(): Promise<void> {
    const currentDc = this.ctx.getDc();
    if (!currentDc) return;
    // WebSocket: bufferedAmountLowThreshold is undefined (RTCDataChannel-only).
    // WS bufferedAmount drains to kernel instantly — skip backpressure wait entirely.
    if (currentDc.bufferedAmountLowThreshold === undefined || currentDc.bufferedAmount <= currentDc.bufferedAmountLowThreshold) {
      return;
    }

    const gen = this.ctx.getSessionGeneration();
    this.ctx.getMetricsCollector()?.enterBufferDrainWait();
    await new Promise<void>((resolve, reject) => {
      this.ctx.setBackpressureReject(reject);
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        this.ctx.setBackpressureReject(undefined);
        this.ctx.getMetricsCollector()?.exitBufferDrainWait();
        const dcNow = this.ctx.getDc();
        if (dcNow) dcNow.onbufferedamountlow = null;
        if (gen !== this.ctx.getSessionGeneration()) {
          reject(new TransferError('Transfer aborted: session ended'));
          return;
        }
        resolve();
      };
      currentDc.onbufferedamountlow = settle;
      // DP-9: Timeout fallback — poll bufferedAmount if event never fires
      setTimeout(() => {
        if (settled) return;
        const dcCheck = this.ctx.getDc();
        if (!dcCheck || (dcCheck.readyState !== 'open' && (dcCheck.readyState as unknown) !== 1)) {
          settled = true;
          this.ctx.setBackpressureReject(undefined);
          reject(new TransferError('Data channel closed during backpressure wait'));
          return;
        }
        console.warn('[TRANSFER] Backpressure timeout — forcing drain resolve (bufferedAmount=' + dcCheck.bufferedAmount + ')');
        settle();
      }, BACKPRESSURE_TIMEOUT_MS);
    });
  }

  // ─── File Transfer (Receive) ──────────────────────────────────────

  /** Route a decoded inner message (from envelope or legacy plaintext). */
  routeInnerMessage(msg: any): void {
    // ─── Canonical DC control messages (UI-XFER-1) ───────────────────
    if (msg.type === 'pause' && msg.transferId) {
      const filename = this.resolveFilename(msg.transferId);
      this.ctx.setTransferPaused(true);
      this.emitProgress(filename ?? 'unknown', 0, 0, 0, 0, 'paused');
      return;
    }
    if (msg.type === 'resume' && msg.transferId) {
      const filename = this.resolveFilename(msg.transferId);
      this.ctx.setTransferPaused(false);
      this.emitProgress(filename ?? 'unknown', 0, 0, 0, 0, 'transferring');
      return;
    }
    if (msg.type === 'cancel' && msg.transferId) {
      const filename = this.resolveFilename(msg.transferId) ?? 'unknown';
      this.handleRemoteCancelCanonical(msg.transferId, filename, msg.cancelledBy);
      return;
    }

    // ─── Legacy file-chunk control flags (deprecated — receive-only compat) ──
    if (msg.type !== 'file-chunk' || !msg.filename) return;

    if (msg.paused) {
      console.warn('[UI-XFER-1] Legacy pause control received (type=file-chunk) — accepted but deprecated');
      this.ctx.setTransferPaused(true);
      this.emitProgress(msg.filename, 0, 0, 0, 0, 'paused');
      return;
    }
    if (msg.resumed) {
      console.warn('[UI-XFER-1] Legacy resume control received (type=file-chunk) — accepted but deprecated');
      this.ctx.setTransferPaused(false);
      this.emitProgress(msg.filename, 0, 0, 0, 0, 'transferring');
      return;
    }
    if (msg.cancelled) {
      console.warn('[UI-XFER-1] Legacy cancel control received (type=file-chunk) — accepted but deprecated');
      this.handleRemoteCancel(msg);
      return;
    }

    // Data chunk
    this.processChunk(msg);
  }

  /** Resolve filename from transferId by searching all transfer maps. */
  private resolveFilename(transferId: string): string | null {
    // Check guarded transfers (receiver side)
    const guarded = this.ctx.getGuardedTransfers().get(transferId);
    if (guarded) return guarded.filename;
    // Check send transfer IDs (sender side — reverse lookup)
    for (const [fn, tid] of this.ctx.getSendTransferIds()) {
      if (tid === transferId) return fn;
    }
    // Check recv transfer IDs (receiver side — reverse lookup)
    for (const [fn, tid] of this.ctx.getRecvTransferIds()) {
      if (tid === transferId) return fn;
    }
    return null;
  }

  /** UI-XFER-1: Clear pending completion timeout to prevent false completion after cancel. */
  private clearCompletionTimeout(): void {
    const timeout = this.ctx.getCompletionTimeout();
    if (timeout) {
      clearTimeout(timeout);
      this.ctx.setCompletionTimeout(null);
    }
  }

  /** Handle canonical cancel message (type="cancel"). */
  private handleRemoteCancelCanonical(transferId: string, filename: string, cancelledBy?: string): void {
    const status = cancelledBy === 'receiver' ? 'canceled_by_receiver' : 'canceled_by_sender';
    this.ctx.getReceiveBuffers().delete(filename);
    this.ctx.getGuardedTransfers().delete(transferId);
    this.ctx.getRecvTransferIds().delete(filename);
    this.ctx.getSendTransferIds().delete(filename);
    this.ctx.setTransferCancelled(true);
    this.clearCompletionTimeout();
    this.emitProgress(filename, 0, 0, 0, 0, status);
  }

  private handleRemoteCancel(msg: FileChunkMessage): void {
    const status = msg.cancelledBy === 'receiver' ? 'canceled_by_receiver' : 'canceled_by_sender';
    this.ctx.getReceiveBuffers().delete(msg.filename);
    if (msg.transferId) {
      this.ctx.getGuardedTransfers().delete(msg.transferId);
    }
    // Also clean up by filename lookup
    const recvTid = this.ctx.getRecvTransferIds().get(msg.filename);
    if (recvTid) {
      this.ctx.getGuardedTransfers().delete(recvTid);
      this.ctx.getRecvTransferIds().delete(msg.filename);
    }
    this.ctx.setTransferCancelled(true);
    this.clearCompletionTimeout();
    this.emitProgress(msg.filename, 0, 0, 0, 0, status);
  }

  private isValidChunkFields(msg: FileChunkMessage): boolean {
    const { chunkIndex, totalChunks } = msg;
    if (!Number.isFinite(totalChunks) || !Number.isInteger(totalChunks!) || totalChunks! <= 0) {
      console.warn(`[REPLAY_OOB] invalid totalChunks=${totalChunks} — rejected`);
      return false;
    }
    if (!Number.isFinite(chunkIndex) || !Number.isInteger(chunkIndex!) || chunkIndex! < 0 || chunkIndex! >= totalChunks!) {
      console.warn(`[REPLAY_OOB] chunkIndex=${chunkIndex} out of range [0, ${totalChunks}) — rejected`);
      return false;
    }
    return true;
  }

  processChunk(msg: FileChunkMessage): void {
    if (!msg.chunk || typeof msg.chunkIndex !== 'number' || !msg.totalChunks || !msg.fileSize) return;
    if (!this.ctx.getRemotePublicKey()) return;

    // Bounds check applies to BOTH modes
    if (!this.isValidChunkFields(msg)) return;

    if (msg.transferId && this.ctx.isHelloComplete()) {
      this.processChunkGuarded(msg).catch((error) => {
        console.error(`[TRANSFER] Unhandled error in guarded path:`, error);
        this.ctx.onError(error instanceof WebRTCError ? error : new TransferError('Chunk processing failed', error));
      });
    } else {
      if (msg.transferId && !this.ctx.isHelloComplete()) {
        console.warn('[REPLAY_UNGUARDED] transferId present but HELLO incomplete — falling back to legacy');
      } else {
        console.warn('[REPLAY_UNGUARDED] chunk received without transferId — legacy peer');
      }
      this.processChunkLegacy(msg);
    }
  }

  private async processChunkGuarded(msg: FileChunkMessage): Promise<void> {
    const { filename, chunk, chunkIndex, totalChunks, fileSize, transferId } = msg;
    const remoteIdKey = this.ctx.getRemoteIdentityKey();
    const identityKey = remoteIdKey ? toBase64(remoteIdKey) : '';
    const btrAdapter = this.ctx.getBtrAdapter();
    const isBtrMode = this.ctx.getBtrMode() === BTR_FULL && btrAdapter !== null;

    // BTR: extract envelope-level fields from the message (attached by WebRTCService.handleMessage)
    const btrEnvelopeFields: BtrEnvelopeFields | null = (msg as any)._btrEnvelopeFields ?? null;

    // Lookup or create guarded transfer
    const guardedTransfers = this.ctx.getGuardedTransfers();
    let transfer = guardedTransfers.get(transferId!);
    if (!transfer) {
      console.log(`[TRANSFER] Receiving ${filename} (${fileSize} bytes, ${totalChunks} chunks, tid=${transferId})`);
      // Store expectedHash from first chunk if bolt.file-hash negotiated
      const expectedHash = (this.ctx.hasCapability('bolt.file-hash') && msg.fileHash) ? msg.fileHash : undefined;
      transfer = {
        transferId: transferId!,
        filename: filename,
        totalChunks: totalChunks!,
        fileSize: fileSize!,
        buffer: new Array(totalChunks!).fill(null),
        receivedSet: new Set(),
        remoteIdentityKey: identityKey,
        expectedHash,
      };
      guardedTransfers.set(transferId!, transfer);
      this.ctx.getRecvTransferIds().set(filename, transferId!);
      this.ctx.setTransferStartTime(Date.now());
      this.ctx.setPauseDuration(0);

      // RU4: emit "receiving" state so receiver UI shows incoming transfer before progress starts
      this.emitProgress(filename, 0, totalChunks!, 0, fileSize!, 'receiving');

      // BTR: initialize receive-side transfer context on first chunk
      if (isBtrMode && btrEnvelopeFields?.ratchet_public_key) {
        const keyPair = this.ctx.getKeyPair();
        if (!keyPair) throw new EncryptionError('No ephemeral key pair for BTR DH');
        const senderRatchetPub = fromBase64(btrEnvelopeFields.ratchet_public_key);
        // Parse hex transferId to bytes
        const tidBytes = new Uint8Array(16);
        for (let i = 0; i < 16 && i * 2 < transferId!.length; i++) {
          tidBytes[i] = parseInt(transferId!.slice(i * 2, i * 2 + 2), 16);
        }
        btrAdapter.beginReceive(tidBytes, senderRatchetPub, keyPair.secretKey);
        console.log(`[BTR_TRANSFER_RECV] DH ratchet step complete, generation=${btrAdapter.generation}`);
      }
    } else if (transfer.remoteIdentityKey !== identityKey) {
      // Same transferId but different sender identity — cross-peer collision
      console.warn(`[REPLAY_XFER_MISMATCH] transferId=${transferId} bound to different sender identity — ignored`);
      return;
    }

    // Dedup check
    if (transfer.receivedSet.has(chunkIndex!)) {
      console.warn(`[REPLAY_DUP] chunkIndex=${chunkIndex} already received for tid=${transferId} — ignored`);
      return;
    }

    try {
      const keyPair = this.ctx.getKeyPair();
      if (!keyPair) throw new EncryptionError('No ephemeral key pair');

      let decrypted: Uint8Array;
      if (isBtrMode && btrAdapter?.activeTransferCtx && btrEnvelopeFields) {
        // BTR mode: decrypt with chain-derived message key
        const sealed = fromBase64(chunk!);
        decrypted = btrAdapter.activeTransferCtx.openChunk(btrEnvelopeFields.chain_index, sealed);
      } else {
        // Static ephemeral mode: decrypt with NaCl box
        decrypted = openBoxPayload(chunk!, this.ctx.getRemotePublicKey()!, keyPair.secretKey);
      }
      transfer.buffer[chunkIndex!] = new Blob([decrypted as BlobPart]);
      transfer.receivedSet.add(chunkIndex!);

      const received = transfer.receivedSet.size;
      this.emitProgress(filename, received, totalChunks!, received * (fileSize! / totalChunks!), fileSize!, 'transferring');

      // Check completion
      if (received === totalChunks!) {
        const assembledBlob = new Blob(transfer.buffer as Blob[]);

        // Verify file integrity if expectedHash was provided (bolt.file-hash negotiated)
        if (transfer.expectedHash) {
          try {
            const actual = await hashFile(assembledBlob);
            if (actual !== transfer.expectedHash) {
              console.error(`[INTEGRITY_MISMATCH] expected=${transfer.expectedHash} actual=${actual} (tid=${transferId})`);
              guardedTransfers.delete(transferId!);
              this.ctx.getRecvTransferIds().delete(filename);
              this.emitProgress(filename, 0, totalChunks!, 0, fileSize!, 'error', 'File verification failed — data may be corrupted');
              this.ctx.onError(new IntegrityError('File integrity check failed: hash mismatch'));
              this.ctx.sendMessage({
                type: 'error',
                code: 'INTEGRITY_FAILED',
                message: 'File integrity check failed: hash mismatch',
              });
              this.ctx.disconnect();
              return;
            }
            console.log(`[INTEGRITY_OK] hash verified for ${filename} (tid=${transferId})`);
          } catch (hashError) {
            console.error(`[INTEGRITY_ERROR] failed to compute hash for ${filename}:`, hashError);
            // Fail-closed: treat hash computation failure as integrity failure
            guardedTransfers.delete(transferId!);
            this.ctx.getRecvTransferIds().delete(filename);
            this.emitProgress(filename, 0, totalChunks!, 0, fileSize!, 'error', 'File verification failed');
            this.ctx.onError(new IntegrityError('File integrity check failed: hash computation error'));
            this.ctx.disconnect();
            return;
          }
        }

        console.log(`[TRANSFER] Completed receiving ${filename} (tid=${transferId})`);
        guardedTransfers.delete(transferId!);
        this.ctx.getRecvTransferIds().delete(filename);
        // BTR: cleanup receive-side transfer context
        if (isBtrMode && btrAdapter) {
          btrAdapter.endTransfer();
          console.log('[BTR_TRANSFER_COMPLETE] Receive transfer context cleaned up');
        }
        this.emitProgress(filename, totalChunks!, totalChunks!, fileSize!, fileSize!, 'completed');
        this.ctx.onReceiveFile(assembledBlob, filename);
      }
    } catch (error) {
      console.error(`[TRANSFER] Error processing chunk ${chunkIndex} of ${filename} (tid=${transferId}):`, error);
      guardedTransfers.delete(transferId!);
      this.ctx.getRecvTransferIds().delete(filename);
      // BTR: cleanup on error
      if (isBtrMode && btrAdapter) {
        btrAdapter.cancelTransfer();
      }
      const detail = error instanceof Error ? classifyTransferError(error) : 'Transfer failed';
      this.emitProgress(filename, 0, totalChunks!, 0, fileSize!, 'error', detail);
      this.ctx.onError(error instanceof WebRTCError ? error : new TransferError('Chunk processing failed', error));
    }
  }

  private processChunkLegacy(msg: FileChunkMessage): void {
    const { filename, chunk, chunkIndex, totalChunks, fileSize } = msg;

    const receiveBuffers = this.ctx.getReceiveBuffers();
    // Initialize buffer on first chunk
    if (!receiveBuffers.has(filename)) {
      console.log(`[TRANSFER] Receiving ${filename} (${fileSize} bytes, ${totalChunks} chunks) [legacy]`);
      receiveBuffers.set(filename, new Array(totalChunks!).fill(null));
      this.ctx.setTransferStartTime(Date.now());
      this.ctx.setPauseDuration(0);
    }

    try {
      const keyPair = this.ctx.getKeyPair();
      if (!keyPair) throw new EncryptionError('No ephemeral key pair');
      const decrypted = openBoxPayload(chunk!, this.ctx.getRemotePublicKey()!, keyPair.secretKey);
      const buffer = receiveBuffers.get(filename)!;
      buffer[chunkIndex!] = new Blob([decrypted as BlobPart]);

      const received = buffer.filter(Boolean).length;
      this.emitProgress(filename, received, totalChunks!, received * (fileSize! / totalChunks!), fileSize!, 'transferring');

      // Check completion
      if (received === totalChunks!) {
        console.log(`[TRANSFER] Completed receiving ${filename} [legacy]`);
        const file = new Blob(buffer as Blob[]);
        receiveBuffers.delete(filename);
        this.emitProgress(filename, totalChunks!, totalChunks!, fileSize!, fileSize!, 'completed');
        this.ctx.onReceiveFile(file, filename);
      }
    } catch (error) {
      console.error(`[TRANSFER] Error processing chunk ${chunkIndex} of ${filename}:`, error);
      receiveBuffers.delete(filename);
      const detail = error instanceof Error ? classifyTransferError(error) : 'Transfer failed';
      this.emitProgress(filename, 0, totalChunks!, 0, fileSize!, 'error', detail);
      this.ctx.onError(error instanceof WebRTCError ? error : new TransferError('Chunk processing failed', error));
    }
  }

  // ─── Transfer Control ──────────────────────────────────────────────

  pauseTransfer(filename: string, isReceiver: boolean = false): void {
    const transferId = isReceiver
      ? this.ctx.getRecvTransferIds().get(filename)
      : this.ctx.getSendTransferIds().get(filename);
    if (!transferId) {
      console.error(`[UI-XFER-1] pauseTransfer: no transferId for "${filename}" — no control message sent`);
      return;
    }
    this.ctx.setTransferPaused(true);
    this.ctx.setLastPausedAt(Date.now());
    this.ctx.getMetricsCollector()?.markPaused();
    this.sendCanonicalControl({ type: 'pause', transferId });
    this.emitProgress(filename, 0, 0, 0, 0, 'paused');
  }

  resumeTransfer(filename: string, isReceiver: boolean = false): void {
    const transferId = isReceiver
      ? this.ctx.getRecvTransferIds().get(filename)
      : this.ctx.getSendTransferIds().get(filename);
    if (!transferId) {
      console.error(`[UI-XFER-1] resumeTransfer: no transferId for "${filename}" — no control message sent`);
      return;
    }
    const lastPausedAt = this.ctx.getLastPausedAt();
    if (lastPausedAt) {
      this.ctx.setPauseDuration(this.ctx.getPauseDuration() + Date.now() - lastPausedAt);
      this.ctx.setLastPausedAt(null);
    }
    this.ctx.setTransferPaused(false);
    this.ctx.getMetricsCollector()?.markResumed();
    this.sendCanonicalControl({ type: 'resume', transferId });
    this.emitProgress(filename, 0, 0, 0, 0, 'transferring');
  }

  cancelTransfer(filename: string, isReceiver: boolean = false): void {
    const transferId = isReceiver
      ? this.ctx.getRecvTransferIds().get(filename)
      : this.ctx.getSendTransferIds().get(filename);
    if (!transferId) {
      console.error(`[UI-XFER-1] cancelTransfer: no transferId for "${filename}" — no control message sent`);
      // Still set cancelled state locally to stop any in-progress send loop
      this.ctx.setTransferCancelled(true);
      this.clearCompletionTimeout();
      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      this.emitProgress(filename, 0, 0, 0, 0, status);
      return;
    }
    this.ctx.setTransferCancelled(true);
    this.sendCanonicalControl({
      type: 'cancel',
      transferId,
      cancelledBy: isReceiver ? 'receiver' : 'sender',
    });
    this.ctx.getReceiveBuffers().delete(filename);
    this.ctx.getGuardedTransfers().delete(transferId);
    this.ctx.getRecvTransferIds().delete(filename);
    this.ctx.getSendTransferIds().delete(filename);
    this.clearCompletionTimeout();
    const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
    this.emitProgress(filename, 0, 0, 0, 0, status);
  }

  /** UI-XFER-1: Emit a canonical DC control message (no legacy file-chunk shape). */
  private sendCanonicalControl(msg: DcControlMessage): void {
    const dcState = this.ctx.getDc()?.readyState;
    if (!dcState || (dcState !== 'open' && (dcState as unknown) !== 1)) return;
    this.ctx.sendMessage(msg);
  }

  // ─── Progress ──────────────────────────────────────────────────────

  emitProgress(
    filename: string,
    currentChunk: number,
    totalChunks: number,
    loaded: number,
    total: number,
    status: TransferProgress['status'],
    errorDetail?: string,
  ): void {
    const collector = this.ctx.getMetricsCollector();
    if (collector && !this.ctx.getMetricsFirstProgressRecorded()) {
      collector.recordFirstProgress();
      this.ctx.setMetricsFirstProgressRecorded(true);
    }

    const callback = this.ctx.getOnProgressCallback();
    if (!callback) return;

    const elapsed = Math.max(1, Date.now() - this.ctx.getTransferStartTime() - this.ctx.getPauseDuration());
    const speed = loaded > 0 ? loaded / (elapsed / 1000) : 0;
    const remaining = speed > 0 ? (total - loaded) / speed : 0;

    callback({
      filename,
      currentChunk,
      totalChunks,
      loaded,
      total,
      status,
      errorDetail,
      stats: {
        speed,
        averageSpeed: speed,
        estimatedTimeRemaining: remaining,
        retryCount: 0,
        maxRetries: 0,
        startTime: this.ctx.getTransferStartTime(),
        pauseDuration: this.ctx.getPauseDuration(),
        lastPausedAt: this.ctx.getLastPausedAt() ?? undefined,
      },
    });
  }

}
