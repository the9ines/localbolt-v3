import { generateEphemeralKeyPair, toBase64, fromBase64, openBoxPayload, isValidWireErrorCode, scalarMult, BtrMode } from '@the9ines/bolt-core';
import type { BtrModeValue } from '@the9ines/bolt-core';
import { WebRTCError, ConnectionError, TransferError } from '../../types/webrtc-errors.js';
import { getLocalOnlyRTCConfig } from '../../lib/platform-utils.js';
// SignalingProvider/SignalMessage types — extracted to @the9ines/localbolt-browser.
// Inline the minimal type shapes needed here to avoid circular dependency.
interface SignalingProvider {
  connect(localPeerCode: string, deviceName: string, deviceType: any): Promise<void>;
  disconnect(): void;
  onSignal(callback: (signal: any) => void): (() => void);
  onPeerDiscovered(callback: (peer: any) => void): void;
  onPeerLost(callback: (peerCode: string) => void): void;
  sendSignal(type: string, data: any, to: string): Promise<void>;
  isConnected(): boolean;
  setConnectionStateHandler?(handler: () => void): void;
}
interface SignalMessage { from: string; type: string; data: any; to: string; }
import type { TransferMetricsCollector } from './transferMetrics.js';
import { HandshakeManager } from './HandshakeManager.js';
import { TransferManager } from './TransferManager.js';
import { encodeProfileEnvelopeV1, dcSendMessage, extractBtrEnvelopeFields } from './EnvelopeCodec.js';
import { createBtrAdapter } from './BtrTransferAdapter.js';
import type { WasmBtrTransferAdapter, BtrEnvelopeFields } from './BtrTransferAdapter.js';
import type { HandshakeContext } from './context.js';
import type { TransferContext } from './TransferManager.js';

// ─── Types (canonical definitions in ./types.ts; re-exported here for API stability) ──
import type { FileChunkMessage, ActiveTransfer } from './types.js';
import { CANONICAL_CONTROL_TYPES } from './types.js';
export type { TransferStats, TransferProgress, VerificationState, VerificationInfo, WebRTCServiceOptions } from './types.js';
import type { TransferProgress, VerificationInfo, WebRTCServiceOptions } from './types.js';

// ─── WebRTCService ──────────────────────────────────────────────────────────

class WebRTCService {
  // Connection
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private signaling: SignalingProvider;

  // Encryption — generated per session in connect() / handleOffer()
  private keyPair: { publicKey: Uint8Array; secretKey: Uint8Array } | null = null;
  private remotePublicKey: Uint8Array | null = null;

  // Peer codes
  private remotePeerCode: string = '';

  // ICE
  private pendingCandidates: RTCIceCandidateInit[] = [];

  // Transfer state (owned here for test compat; TransferManager accesses via context)
  private transferPaused = false;
  private transferCancelled = false;
  private receiveBuffers: Map<string, (Blob | null)[]> = new Map();
  private guardedTransfers: Map<string, ActiveTransfer> = new Map();
  private sendTransferIds: Map<string, string> = new Map();
  private recvTransferIds: Map<string, string> = new Map();

  // Stats
  private transferStartTime = 0;
  private pauseDuration = 0;
  private lastPausedAt: number | null = null;

  // Metrics (S2B instrumentation, gated by ENABLE_TRANSFER_METRICS)
  private metricsCollector: TransferMetricsCollector | null = null;
  private metricsFirstProgressRecorded = false;

  // Callbacks
  private onProgressCallback?: (progress: TransferProgress) => void;
  private connectionStateHandler?: (state: RTCPeerConnectionState) => void;

  // Connect promise resolution (for caller side)
  private connectResolve: (() => void) | null = null;
  private connectReject: ((err: Error) => void) | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;

  // HELLO / TOFU state (owned here for test compat; HandshakeManager accesses via context)
  private options: WebRTCServiceOptions;
  private helloComplete = false;
  private sessionLegacy = false;
  private sessionState: 'pre_hello' | 'post_hello' | 'closed' = 'pre_hello';
  private helloTimeout: ReturnType<typeof setTimeout> | null = null;
  private helloResolve: (() => void) | null = null;
  private helloProcessing = false; // SA12: reentrancy guard
  private sessionGeneration = 0; // SA14: stale timeout guard

  // SA6: signaling listener unsubscribe handle
  private signalUnsub?: () => void;

  // N1: backpressure cancel hook — settled by disconnect() to prevent hang
  private backpressureReject?: (err: Error) => void;

  // N10: completion timer — cleared by disconnect() to prevent stale event
  private completionTimeout: ReturnType<typeof setTimeout> | null = null;

  // SAS verification state
  private remoteIdentityKey: Uint8Array | null = null;
  private verificationInfo: VerificationInfo = { state: 'legacy', sasCode: null };

  // Capabilities negotiation
  private localCapabilities: string[];
  private remoteCapabilities: string[] = [];
  private negotiatedCapabilities: string[] = [];

  // BTR state — WASM-backed when available, TS fallback otherwise (RB5)
  private btrMode: BtrModeValue | null = null;
  private btrAdapter: WasmBtrTransferAdapter | null = null;

  // ─── Decomposed managers ────────────────────────────────────────
  private handshake: HandshakeManager;
  private transfer: TransferManager;

  constructor(
    signaling: SignalingProvider,
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    onProgress?: (progress: TransferProgress) => void,
    options?: WebRTCServiceOptions,
  ) {
    console.log('[INIT] WebRTCService with peer code:', localPeerCode);
    this.onProgressCallback = onProgress;
    this.options = options ?? {};
    this.signaling = signaling;
    this.signalUnsub = this.signaling.onSignal((signal) => this.handleSignal(signal));

    // Build capabilities list — BTR capability only when kill switch is on
    this.localCapabilities = ['bolt.file-hash', 'bolt.profile-envelope-v1'];
    if (this.options.btrEnabled) {
      this.localCapabilities.push('bolt.transfer-ratchet-v1');
    }

    // Build context bridges and instantiate managers
    this.handshake = new HandshakeManager(this.buildHandshakeContext());
    this.transfer = new TransferManager(this.buildTransferContext());
  }

  // ─── Context bridges ──────────────────────────────────────────────────

  /** Build the HandshakeContext bridge — maps to fields on this instance. */
  private buildHandshakeContext(): HandshakeContext {
    return {
      getKeyPair: () => this.keyPair,
      getRemotePublicKey: () => this.remotePublicKey,
      getDc: () => this.dc,
      getLocalPeerCode: () => this.localPeerCode,
      getRemotePeerCode: () => this.remotePeerCode,
      getOptions: () => this.options,
      onFatalError: (code, message) => this.sendErrorAndDisconnect(code, message),
      onError: (error) => this.onError(error instanceof WebRTCError ? error : new ConnectionError('Manager error', error)),
      disconnect: () => this.disconnect(),
      isHelloComplete: () => this.helloComplete,
      setHelloComplete: (v) => { this.helloComplete = v; },
      getSessionState: () => this.sessionState,
      setSessionState: (v) => { this.sessionState = v; },
      getSessionGeneration: () => this.sessionGeneration,
      isHelloProcessing: () => this.helloProcessing,
      setHelloProcessing: (v) => { this.helloProcessing = v; },
      getHelloTimeout: () => this.helloTimeout,
      setHelloTimeout: (v) => { this.helloTimeout = v; },
      getHelloResolve: () => this.helloResolve,
      setHelloResolve: (v) => { this.helloResolve = v; },
      setSessionLegacy: (v) => { this.sessionLegacy = v; },
      getVerificationInfo: () => this.verificationInfo,
      setVerificationInfo: (v) => { this.verificationInfo = v; },
      getRemoteIdentityKey: () => this.remoteIdentityKey,
      setRemoteIdentityKey: (v) => { this.remoteIdentityKey = v; },
      getLocalCapabilities: () => this.localCapabilities,
      getNegotiatedCapabilities: () => this.negotiatedCapabilities,
      setNegotiatedCapabilities: (v) => { this.negotiatedCapabilities = v; },
      setRemoteCapabilities: (v) => { this.remoteCapabilities = v; },
      getBtrMode: () => this.btrMode,
      setBtrMode: (v) => {
        this.btrMode = v as BtrModeValue | null;
        // Initialize BTR adapter when FullBtr negotiated
        if (v === BtrMode.FullBtr && this.keyPair && this.remotePublicKey) {
          const sharedSecret = scalarMult(this.keyPair.secretKey, this.remotePublicKey);
          this.btrAdapter = createBtrAdapter(sharedSecret);
        }
      },
    };
  }

  /** Build the TransferContext bridge — maps to fields on this instance. */
  private buildTransferContext(): TransferContext {
    return {
      getKeyPair: () => this.keyPair,
      getRemotePublicKey: () => this.remotePublicKey,
      getDc: () => this.dc,
      isHelloComplete: () => this.helloComplete,
      getSessionGeneration: () => this.sessionGeneration,
      hasCapability: (name) => this.negotiatedCapabilities.includes(name),
      negotiatedEnvelopeV1: () => this.negotiatedCapabilities.includes('bolt.profile-envelope-v1'),
      getTransferPaused: () => this.transferPaused,
      setTransferPaused: (v) => { this.transferPaused = v; },
      getTransferCancelled: () => this.transferCancelled,
      setTransferCancelled: (v) => { this.transferCancelled = v; },
      getReceiveBuffers: () => this.receiveBuffers,
      getGuardedTransfers: () => this.guardedTransfers,
      getSendTransferIds: () => this.sendTransferIds,
      getRecvTransferIds: () => this.recvTransferIds,
      getTransferStartTime: () => this.transferStartTime,
      setTransferStartTime: (v) => { this.transferStartTime = v; },
      getPauseDuration: () => this.pauseDuration,
      setPauseDuration: (v) => { this.pauseDuration = v; },
      getLastPausedAt: () => this.lastPausedAt,
      setLastPausedAt: (v) => { this.lastPausedAt = v; },
      getMetricsCollector: () => this.metricsCollector,
      setMetricsCollector: (v) => { this.metricsCollector = v; },
      getMetricsFirstProgressRecorded: () => this.metricsFirstProgressRecorded,
      setMetricsFirstProgressRecorded: (v) => { this.metricsFirstProgressRecorded = v; },
      getBackpressureReject: () => this.backpressureReject,
      setBackpressureReject: (v) => { this.backpressureReject = v; },
      getCompletionTimeout: () => this.completionTimeout,
      setCompletionTimeout: (v) => { this.completionTimeout = v; },
      getOnProgressCallback: () => this.onProgressCallback,
      getRemoteIdentityKey: () => this.remoteIdentityKey,
      onReceiveFile: (file, filename) => this.onReceiveFile(file, filename),
      onError: (error) => this.onError(error instanceof WebRTCError ? error : new TransferError('Transfer error', error)),
      disconnect: () => this.disconnect(),
      sendMessage: (innerMsg, btrFields?) => this.dcSendMessage(innerMsg, btrFields),
      waitForHello: () => this.waitForHello(),
      getBtrMode: () => this.btrMode,
      getBtrAdapter: () => this.btrAdapter,
    };
  }

  // ─── Signaling ──────────────────────────────────────────────────────────

  private async sendSignal(type: SignalMessage['type'], data: any, to: string) {
    console.log('[SIGNALING] Sending', type, 'to', to);
    await this.signaling.sendSignal(type, data, to);
  }

  private async handleSignal(signal: SignalMessage) {
    if (signal.to !== this.localPeerCode) return;
    if (signal.type !== 'offer' && signal.type !== 'answer' && signal.type !== 'ice-candidate') return;

    console.log('[SIGNALING] Received', signal.type, 'from', signal.from);
    if (signal.from) this.remotePeerCode = signal.from;

    try {
      switch (signal.type) {
        case 'offer':
          await this.handleOffer(signal);
          break;
        case 'answer':
          await this.handleAnswer(signal);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(signal);
          break;
      }
    } catch (error) {
      console.error('[SIGNAL] Error handling', signal.type, ':', error);
      this.disconnect();
      this.onError(error instanceof WebRTCError ? error : new ConnectionError('Signal handling failed', error));
    }
  }

  private async handleOffer(signal: SignalMessage) {
    this.keyPair = generateEphemeralKeyPair();
    console.log('[SIGNALING] Processing offer from', signal.from);
    this.remotePublicKey = fromBase64(signal.data.publicKey);

    const pc = this.createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(signal.data.offer));
    console.log('[SIGNALING] Remote description set (offer)');

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log('[SIGNALING] Local description set (answer)');

    await this.sendSignal('answer', {
      answer,
      publicKey: toBase64(this.keyPair!.publicKey),
      peerCode: this.localPeerCode,
    }, signal.from);

    await this.flushPendingCandidates();
  }

  private async handleAnswer(signal: SignalMessage) {
    console.log('[SIGNALING] Processing answer from', signal.from);
    this.remotePublicKey = fromBase64(signal.data.publicKey);

    if (!this.pc) throw new ConnectionError('No peer connection for answer');
    console.log('[SIGNALING] Signaling state:', this.pc.signalingState);
    if (this.pc.signalingState !== 'have-local-offer') {
      throw new ConnectionError('Received answer in invalid state: ' + this.pc.signalingState);
    }

    await this.pc.setRemoteDescription(new RTCSessionDescription(signal.data.answer));
    console.log('[SIGNALING] Remote description set (answer)');
    await this.flushPendingCandidates();
  }

  private async handleIceCandidate(signal: SignalMessage) {
    const candidate = new RTCIceCandidate(signal.data);
    console.log('[ICE] Remote candidate:', candidate.type, candidate.address, candidate.protocol);

    if (!this.pc || !this.pc.remoteDescription) {
      console.log('[ICE] Queuing candidate (no PC or remote desc)');
      this.pendingCandidates.push(signal.data);
      return;
    }

    try {
      await this.pc.addIceCandidate(candidate);
      console.log('[ICE] Added remote candidate');
    } catch (err) {
      console.warn('[ICE] Failed to add candidate, queuing:', err);
      this.pendingCandidates.push(signal.data);
    }
  }

  private async flushPendingCandidates() {
    if (!this.pc) return;
    console.log('[ICE] Flushing', this.pendingCandidates.length, 'pending candidates');
    while (this.pendingCandidates.length > 0) {
      const c = this.pendingCandidates.shift()!;
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (error) {
        console.warn('[ICE] Failed to add pending candidate:', error);
      }
    }
  }

  // ─── Connection ─────────────────────────────────────────────────────────

  private createPeerConnection(): RTCPeerConnection {
    if (this.pc) {
      console.log('[WEBRTC] Closing existing peer connection');
      this.pc.onconnectionstatechange = null;
      this.pc.onicecandidate = null;
      this.pc.ondatachannel = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }

    const config = getLocalOnlyRTCConfig();
    console.log('[WEBRTC] Creating peer connection with config:', JSON.stringify(config));
    this.pc = new RTCPeerConnection(config);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        if (event.candidate.type === 'relay') {
          console.log('[ICE] Blocking relay candidate (same-network policy)');
          return;
        }
        console.log('[ICE] Local candidate:', event.candidate.type, event.candidate.address, event.candidate.protocol);
        this.sendSignal('ice-candidate', event.candidate.toJSON(), this.remotePeerCode)
          .catch(err => console.error('[ICE] Failed to send candidate:', err));
      } else {
        console.log('[ICE] Candidate gathering complete');
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('[ICE] Connection state:', this.pc?.iceConnectionState);
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log('[WEBRTC] Connection state:', state);
      if (!state) return;

      if (this.connectionStateHandler) this.connectionStateHandler(state);

      if (state === 'connected') {
        console.log('[WEBRTC] Connection established!');
        this.enforceSameNetworkPolicy();
        if (this.connectResolve) {
          if (this.connectTimeout) clearTimeout(this.connectTimeout);
          this.connectResolve();
          this.connectResolve = null;
          this.connectReject = null;
          this.connectTimeout = null;
        }
      } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        if (this.connectReject && (state === 'failed' || state === 'closed')) {
          if (this.connectTimeout) clearTimeout(this.connectTimeout);
          this.connectReject(new ConnectionError('Connection ' + state));
          this.connectResolve = null;
          this.connectReject = null;
          this.connectTimeout = null;
        }
        if (state === 'failed' || state === 'closed') {
          this.onError(new ConnectionError('WebRTC connection ' + state));
        }
      }
    };

    this.pc.ondatachannel = (event) => {
      console.log('[DC] Received data channel from remote peer');
      this.setupDataChannel(event.channel);
    };

    return this.pc;
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dc = channel;
    this.dc.binaryType = 'arraybuffer';
    // DP-9: Set threshold so onbufferedamountlow fires before buffer fully drains to 0.
    // Default (0) causes the event to never fire reliably on received data channels.
    this.dc.bufferedAmountLowThreshold = 262144; // 256 KB
    this.sessionState = 'pre_hello';
    this.dc.onmessage = (event) => this.handleMessage(event);
    this.dc.onopen = () => {
      console.log('[DC] Data channel open');
      this.initiateHello();
    };
    this.dc.onclose = () => console.log('[DC] Data channel closed');
    this.dc.onerror = (e) => console.error('[DC] Error:', e);
  }

  private async enforceSameNetworkPolicy() {
    if (!this.pc) return;

    try {
      const stats = await this.pc.getStats();
      const reports = Array.from(stats.values());
      const pair = reports.find((r: any) => r.type === 'candidate-pair' && (r.selected || r.nominated));
      if (!pair) {
        console.log('[POLICY] No selected candidate pair found (will check again later)');
        return;
      }

      const local = reports.find((r: any) => r.id === (pair as any).localCandidateId) as any;
      const remote = reports.find((r: any) => r.id === (pair as any).remoteCandidateId) as any;
      if (!local || !remote) return;

      console.log('[POLICY] Selected pair — local:', local.candidateType, local.address, '→ remote:', remote.candidateType, remote.address);

      if (local.candidateType === 'relay' || remote.candidateType === 'relay') {
        throw new ConnectionError('Same-network policy violation: relay candidate selected');
      }

      if (
        (local.candidateType === 'srflx' || remote.candidateType === 'srflx') &&
        local.address && remote.address &&
        local.address !== remote.address
      ) {
        throw new ConnectionError('Same-network policy violation: different public addresses');
      }

      console.log('[POLICY] Same-network check passed');
    } catch (error) {
      if (error instanceof ConnectionError) {
        console.error('[POLICY]', error.message);
        this.onError(error);
        this.disconnect();
      }
    }
  }

  /** Send an error frame and disconnect. Wraps in envelope when negotiated. */
  private sendErrorAndDisconnect(code: string, message: string): void {
    if (!isValidWireErrorCode(code)) {
      console.error(`[BUG] sendErrorAndDisconnect called with non-canonical code: ${code}`);
      this.disconnect();
      return;
    }
    if (this.dc && this.dc.readyState === 'open') {
      const errorMsg = { type: 'error', code, message };
      if (this.negotiatedEnvelopeV1() && this.helloComplete && this.keyPair && this.remotePublicKey) {
        this.dc.send(JSON.stringify(encodeProfileEnvelopeV1(errorMsg, this.remotePublicKey, this.keyPair.secretKey)));
      } else {
        this.dc.send(JSON.stringify(errorMsg));
      }
    }
    this.disconnect();
  }

  // ─── HELLO Protocol (delegated to HandshakeManager) ─────────────────────

  private initiateHello() {
    this.handshake.initiateHello();
  }

  private async processHello(msg: { type: 'hello'; payload: string }) {
    return this.handshake.processHello(msg);
  }

  waitForHello(): Promise<void> {
    if (this.helloComplete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.helloResolve = resolve;
    });
  }

  isLegacySession(): boolean {
    return this.sessionLegacy;
  }

  // ─── Connection Lifecycle ──────────────────────────────────────────────

  async connect(remotePeerCode: string): Promise<void> {
    this.keyPair = generateEphemeralKeyPair();
    console.log('[WEBRTC] Connecting to peer:', remotePeerCode);
    this.remotePeerCode = remotePeerCode;
    const pc = this.createPeerConnection();

    const dc = pc.createDataChannel('fileTransfer', { ordered: true });
    this.setupDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log('[SIGNALING] Local description set (offer)');

    await this.sendSignal('offer', {
      offer,
      publicKey: toBase64(this.keyPair!.publicKey),
      peerCode: this.localPeerCode,
    }, remotePeerCode);

    const connectionPromise = new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.connectTimeout = setTimeout(() => {
        this.connectResolve = null;
        this.connectReject = null;
        this.connectTimeout = null;
        reject(new ConnectionError('Connection timeout (30s)'));
      }, 30000);
    });

    try {
      await connectionPromise;
    } catch (error) {
      this.disconnect();
      throw error instanceof WebRTCError ? error : new ConnectionError('Connection failed', error);
    }
  }

  disconnect() {
    console.log('[WEBRTC] Disconnecting');
    // SA14: increment generation so stale timeout callbacks from this session become no-ops
    this.sessionGeneration++;
    // SA6: unregister signaling listener first to prevent further signal delivery
    this.signalUnsub?.();
    this.signalUnsub = undefined;
    // Zero and discard ephemeral key material
    if (this.keyPair) {
      this.keyPair.secretKey.fill(0);
      this.keyPair = null;
    }
    // Clear any pending connect promise
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.connectResolve = null;
    this.connectReject = null;
    this.connectTimeout = null;

    // N1: settle any pending backpressure wait before closing DC
    if (this.backpressureReject) {
      this.backpressureReject(new TransferError('Transfer aborted: disconnected'));
      this.backpressureReject = undefined;
    }

    // N10: clear pending completion timer to prevent stale event after teardown
    if (this.completionTimeout) {
      clearTimeout(this.completionTimeout);
      this.completionTimeout = null;
    }

    if (this.dc) {
      this.dc.onmessage = null;
      this.dc.onopen = null;
      this.dc.onclose = null;
      this.dc.onerror = null;
      this.dc.onbufferedamountlow = null;
      try { this.dc.close(); } catch { /* ignore */ }
      this.dc = null;
    }
    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.onicecandidate = null;
      this.pc.ondatachannel = null;
      this.pc.oniceconnectionstatechange = null;
      try { this.pc.close(); } catch { /* ignore */ }
      this.pc = null;
    }
    if (this.remotePublicKey instanceof Uint8Array) this.remotePublicKey.fill(0);
    this.remotePublicKey = null;
    this.remotePeerCode = '';
    this.pendingCandidates = [];
    this.transferPaused = false;
    this.transferCancelled = false;
    this.receiveBuffers.clear();
    this.guardedTransfers.clear();
    this.sendTransferIds.clear();
    this.recvTransferIds.clear();

    if (this.metricsCollector) {
      this.metricsCollector.reset();
      this.metricsCollector = null;
      this.metricsFirstProgressRecorded = false;
    }

    // Clear HELLO / TOFU / SAS state
    this.sessionState = 'closed';
    if (this.helloTimeout) {
      clearTimeout(this.helloTimeout);
      this.helloTimeout = null;
    }
    this.helloComplete = false;
    this.helloProcessing = false;
    this.sessionLegacy = false;
    this.helloResolve = null;
    if (this.remoteIdentityKey instanceof Uint8Array) this.remoteIdentityKey.fill(0);
    this.remoteIdentityKey = null;
    this.verificationInfo = { state: 'legacy', sasCode: null };

    // Clear capabilities
    this.remoteCapabilities = [];
    this.negotiatedCapabilities = [];

    // Clear BTR state
    if (this.btrAdapter) {
      this.btrAdapter.cleanupDisconnect();
      this.btrAdapter = null;
    }
    this.btrMode = null;
  }

  // ─── Message Routing ──────────────────────────────────────────────────

  private handleMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data);

      // ─── HELLO routing (exactly-once) ──────────────────────────
      if (msg.type === 'hello' && msg.payload) {
        if (this.sessionState !== 'pre_hello') {
          console.warn('[DUPLICATE_HELLO] HELLO received after handshake complete — disconnecting');
          this.sendErrorAndDisconnect('DUPLICATE_HELLO', 'Duplicate HELLO');
          return;
        }
        this.processHello(msg).catch((error) => {
          console.error('[HELLO] Unexpected error:', error);
          this.sendErrorAndDisconnect('PROTOCOL_VIOLATION', 'Unexpected HELLO processing error');
        });
        return;
      }

      // ─── Pre-handshake gate ────────────────────────────────────
      if (this.sessionState === 'pre_hello') {
        console.warn('[INVALID_STATE] non-HELLO message before handshake complete — disconnecting');
        this.onError(new ConnectionError('Received message before handshake complete'));
        this.sendErrorAndDisconnect('INVALID_STATE', 'Handshake not complete');
        return;
      }

      // ─── Profile Envelope v1: unwrap if negotiated ─────────────
      if (msg.type === 'profile-envelope') {
        if (!this.negotiatedEnvelopeV1()) {
          console.warn('[ENVELOPE_UNNEGOTIATED] profile-envelope received but not negotiated — disconnecting');
          this.sendErrorAndDisconnect('ENVELOPE_UNNEGOTIATED', 'Profile envelope not negotiated');
          return;
        }
        if (msg.version !== 1 || msg.encoding !== 'base64' || typeof msg.payload !== 'string') {
          console.warn('[ENVELOPE_INVALID] invalid profile-envelope version/encoding — disconnecting');
          this.sendErrorAndDisconnect('ENVELOPE_INVALID', 'Invalid profile envelope format');
          return;
        }
        let innerBytes: Uint8Array;
        try {
          innerBytes = openBoxPayload(msg.payload, this.remotePublicKey!, this.keyPair!.secretKey);
        } catch {
          console.warn('[ENVELOPE_DECRYPT_FAIL] failed to decrypt profile-envelope — disconnecting');
          this.sendErrorAndDisconnect('ENVELOPE_DECRYPT_FAIL', 'Failed to decrypt profile envelope');
          return;
        }
        let inner: any;
        try {
          inner = JSON.parse(new TextDecoder().decode(innerBytes));
        } catch {
          console.warn('[INVALID_MESSAGE] failed to parse inner message JSON — disconnecting');
          this.sendErrorAndDisconnect('INVALID_MESSAGE', 'Invalid inner message');
          return;
        }
        if (inner.type === 'error') {
          if (!isValidWireErrorCode(inner.code)) {
            console.warn(`[PROTOCOL_VIOLATION] enveloped error with invalid code: ${JSON.stringify(inner.code)} — disconnecting`);
            this.sendErrorAndDisconnect('PROTOCOL_VIOLATION', 'Invalid inbound error code');
            return;
          }
          if (inner.message !== undefined && typeof inner.message !== 'string') {
            console.warn(`[PROTOCOL_VIOLATION] enveloped error with non-string message — disconnecting`);
            this.sendErrorAndDisconnect('PROTOCOL_VIOLATION', 'Invalid inbound error message type');
            return;
          }
          console.warn(`[REMOTE_ERROR] enveloped error: code=${inner.code}, message=${inner.message}`);
          this.onError(new WebRTCError(inner.message || 'Remote error'));
          this.disconnect();
          return;
        }
        // UI-XFER-1: canonical control messages (pause/resume/cancel) route to transfer manager
        if (CANONICAL_CONTROL_TYPES.has(inner.type)) {
          if (!inner.transferId) {
            console.warn(`[INVALID_MESSAGE] enveloped ${inner.type} missing transferId — disconnecting`);
            this.sendErrorAndDisconnect('INVALID_MESSAGE', `${inner.type} missing transferId`);
            return;
          }
          this.transfer.routeInnerMessage(inner);
          return;
        }
        if (inner.type !== 'file-chunk') {
          console.warn(`[UNKNOWN_MESSAGE_TYPE] unknown inner type "${inner.type}" — disconnecting`);
          this.sendErrorAndDisconnect('UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${inner.type}`);
          return;
        }
        // NF-1: reject malformed file-chunk (missing/empty filename) — mirrors plaintext path
        if (!inner.filename) {
          console.warn('[INVALID_MESSAGE] enveloped file-chunk with missing/empty filename — disconnecting');
          this.sendErrorAndDisconnect('INVALID_MESSAGE', 'file-chunk missing filename');
          return;
        }
        // BTR-4: extract envelope-level BTR fields and attach to inner message for transfer routing
        const btrFields = extractBtrEnvelopeFields(msg);
        if (btrFields) {
          inner._btrEnvelopeFields = btrFields;
        }
        this.transfer.routeInnerMessage(inner);
        return;
      }

      // ─── Envelope-required enforcement ─────────────────────────
      if (this.negotiatedEnvelopeV1()) {
        console.warn('[ENVELOPE_REQUIRED] plaintext message received in envelope-required session — disconnecting');
        this.sendErrorAndDisconnect('ENVELOPE_REQUIRED', 'Envelope required');
        return;
      }

      // ─── Plaintext error handling (pre-envelope) ────────────────
      if (msg.type === 'error') {
        if (!isValidWireErrorCode(msg.code)) {
          console.warn(`[PROTOCOL_VIOLATION] plaintext error with invalid code: ${JSON.stringify(msg.code)} — disconnecting`);
          this.sendErrorAndDisconnect('PROTOCOL_VIOLATION', 'Invalid inbound error code');
          return;
        }
        if (msg.message !== undefined && typeof msg.message !== 'string') {
          console.warn(`[PROTOCOL_VIOLATION] plaintext error with non-string message — disconnecting`);
          this.sendErrorAndDisconnect('PROTOCOL_VIOLATION', 'Invalid inbound error message type');
          return;
        }
        console.warn(`[REMOTE_ERROR] plaintext error: code=${msg.code}, message=${msg.message}`);
        this.onError(new WebRTCError(msg.message || 'Remote error'));
        this.disconnect();
        return;
      }

      // UI-XFER-1: canonical control messages (pause/resume/cancel) route to transfer manager
      if (CANONICAL_CONTROL_TYPES.has(msg.type)) {
        if (!msg.transferId) {
          console.warn(`[INVALID_MESSAGE] plaintext ${msg.type} missing transferId — disconnecting`);
          this.sendErrorAndDisconnect('INVALID_MESSAGE', `${msg.type} missing transferId`);
          return;
        }
        this.transfer.routeInnerMessage(msg);
        return;
      }
      // SA9: reject unknown type (non-file-chunk) — no silent drops
      if (msg.type !== 'file-chunk') {
        console.warn(`[UNKNOWN_MESSAGE_TYPE] unknown plaintext type "${msg.type}" — disconnecting`);
        this.sendErrorAndDisconnect('UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${msg.type}`);
        return;
      }
      // SA9: reject malformed file-chunk (missing/empty filename) — no silent drops
      if (!msg.filename) {
        console.warn('[INVALID_MESSAGE] file-chunk with missing/empty filename — disconnecting');
        this.sendErrorAndDisconnect('INVALID_MESSAGE', 'file-chunk missing filename');
        return;
      }
      this.transfer.routeInnerMessage(msg);
    } catch (error) {
      console.error('[PROTOCOL_VIOLATION] Error processing message:', error);
      this.sendErrorAndDisconnect('PROTOCOL_VIOLATION', 'Protocol violation');
    }
  }

  // ─── Transfer (delegated to TransferManager) ───────────────────────────

  // Forwarding methods for test compat — tests call these via (service as any).methodName
  private processChunk(msg: FileChunkMessage) {
    this.transfer.processChunk(msg);
  }

  private handleRemoteCancel(msg: FileChunkMessage) {
    // Forward by routing as cancelled message
    this.transfer.routeInnerMessage(msg);
  }

  private routeInnerMessage(msg: any) {
    this.transfer.routeInnerMessage(msg);
  }

  private emitProgress(
    filename: string,
    currentChunk: number,
    totalChunks: number,
    loaded: number,
    total: number,
    status: TransferProgress['status']
  ) {
    this.transfer.emitProgress(filename, currentChunk, totalChunks, loaded, total, status);
  }

  async sendFile(file: File): Promise<void> {
    return this.transfer.sendFile(file);
  }

  pauseTransfer(filename: string, isReceiver: boolean = false) {
    this.transfer.pauseTransfer(filename, isReceiver);
  }

  resumeTransfer(filename: string, isReceiver: boolean = false) {
    this.transfer.resumeTransfer(filename, isReceiver);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    this.transfer.cancelTransfer(filename, isReceiver);
  }

  // ─── Public Accessors ──────────────────────────────────────────────────

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    this.onProgressCallback = callback;
  }

  getRemotePeerCode(): string {
    return this.remotePeerCode;
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.connectionStateHandler = handler;
  }

  getVerificationInfo(): VerificationInfo {
    return this.verificationInfo;
  }

  hasCapability(name: string): boolean {
    return this.negotiatedCapabilities.includes(name);
  }

  async markPeerVerified(): Promise<void> {
    return this.handshake.markPeerVerified();
  }

  // ─── Profile Envelope v1 ─────────────────────────────────────────────

  private negotiatedEnvelopeV1(): boolean {
    return this.negotiatedCapabilities.includes('bolt.profile-envelope-v1');
  }

  // SA18: decodeProfileEnvelopeV1 removed — dead code with silent null return.
  // Inline decryption in handleMessage() is the active path (fail-closed).

  private dcSendMessage(innerMsg: any, btrFields?: BtrEnvelopeFields): void {
    dcSendMessage(this.dc, innerMsg, this.negotiatedEnvelopeV1(), this.helloComplete, this.keyPair, this.remotePublicKey, btrFields);
  }
}

export default WebRTCService;
