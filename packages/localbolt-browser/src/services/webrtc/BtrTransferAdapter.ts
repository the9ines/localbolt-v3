/**
 * BtrTransferAdapter — thin wrapper bridging BTR core primitives
 * to the transport layer's transfer send/receive operations.
 *
 * RB5: When WASM is available, WasmBtrTransferAdapter delegates all BTR
 * state and crypto to Rust/WASM opaque handles. The TS BtrTransferAdapter
 * remains as fallback-only (PM-RB-03).
 *
 * Use createBtrAdapter() factory to get the appropriate implementation.
 */

import {
  deriveSessionRoot,
  deriveTransferRoot,
  deriveRatchetedSessionRoot,
  generateRatchetKeypair,
  scalarMult,
  BtrTransferContext,
  toBase64,
  fromBase64,
  createWasmBtrEngine,
} from '@the9ines/bolt-core';
import type { WasmBtrEngineHandle, WasmBtrTransferCtxHandle } from '@the9ines/bolt-core';

/** BTR envelope metadata for a single chunk/message. */
export interface BtrEnvelopeFields {
  ratchet_public_key?: string;  // base64 of 32 bytes (first chunk only)
  ratchet_generation?: number;  // uint32 (with ratchet_public_key)
  chain_index: number;          // uint32 (every chunk)
}

export class BtrTransferAdapter {
  private sessionRootKey: Uint8Array;
  private ratchetGeneration: number;
  private activeCtx: BtrTransferContext | null = null;
  private lastLocalRatchetPub: Uint8Array | null = null;

  constructor(ephemeralSharedSecret: Uint8Array) {
    this.sessionRootKey = deriveSessionRoot(ephemeralSharedSecret);
    this.ratchetGeneration = 0;
  }

  /** Current ratchet generation. */
  get generation(): number {
    return this.ratchetGeneration;
  }

  /** Active transfer context (null if no transfer in progress). */
  get activeTransferCtx(): BtrTransferContext | null {
    return this.activeCtx;
  }

  /**
   * Sender side: begin a new transfer with DH ratchet step.
   *
   * Generates fresh ratchet keypair, performs DH with remote peer's
   * current ratchet public key (initially their ephemeral pub).
   *
   * Returns [BtrTransferContext, localRatchetPublicKey].
   */
  beginSend(
    transferId: Uint8Array,
    remoteRatchetPub: Uint8Array,
  ): [BtrTransferContext, Uint8Array] {
    const localKp = generateRatchetKeypair();
    const dhOutput = scalarMult(localKp.secretKey, remoteRatchetPub);

    const newSrk = deriveRatchetedSessionRoot(this.sessionRootKey, dhOutput);
    // Zeroize old session root key
    this.sessionRootKey.fill(0);
    this.sessionRootKey = newSrk;
    this.ratchetGeneration += 1;

    const transferRoot = deriveTransferRoot(this.sessionRootKey, transferId);

    // Zeroize DH output and local secret key
    dhOutput.fill(0);
    localKp.secretKey.fill(0);

    this.activeCtx = new BtrTransferContext(
      new Uint8Array(transferId),
      this.ratchetGeneration,
      transferRoot,
    );
    this.lastLocalRatchetPub = localKp.publicKey;

    return [this.activeCtx, localKp.publicKey];
  }

  /**
   * Receiver side: begin receiving a transfer with DH ratchet step.
   *
   * Uses the receiver's existing secret key (ephemeral or last ratchet)
   * with the sender's ratchet public key from the envelope. This produces
   * the same DH output as the sender (DH commutativity).
   */
  beginReceive(
    transferId: Uint8Array,
    senderRatchetPub: Uint8Array,
    localSecretKey: Uint8Array,
  ): BtrTransferContext {
    const dhOutput = scalarMult(localSecretKey, senderRatchetPub);

    const newSrk = deriveRatchetedSessionRoot(this.sessionRootKey, dhOutput);
    // Zeroize old session root key
    this.sessionRootKey.fill(0);
    this.sessionRootKey = newSrk;
    this.ratchetGeneration += 1;

    const transferRoot = deriveTransferRoot(this.sessionRootKey, transferId);

    // Zeroize DH output (don't zeroize localSecretKey — caller owns it)
    dhOutput.fill(0);

    this.activeCtx = new BtrTransferContext(
      new Uint8Array(transferId),
      this.ratchetGeneration,
      transferRoot,
    );

    return this.activeCtx;
  }

  /**
   * Build BTR envelope fields for a chunk.
   *
   * First chunk (chainIndex 0) includes ratchet_public_key + ratchet_generation.
   * Subsequent chunks include only chain_index.
   */
  buildEnvelopeFields(chainIndex: number, localRatchetPub?: Uint8Array): BtrEnvelopeFields {
    if (chainIndex === 0 && localRatchetPub) {
      return {
        ratchet_public_key: toBase64(localRatchetPub),
        ratchet_generation: this.ratchetGeneration,
        chain_index: chainIndex,
      };
    }
    return { chain_index: chainIndex };
  }

  /** End the current transfer (FILE_FINISH). Zeroizes transfer-scoped state. */
  endTransfer(): void {
    this.activeCtx?.cleanupComplete();
    this.activeCtx = null;
  }

  /** Cancel the current transfer. Zeroizes transfer-scoped state. */
  cancelTransfer(): void {
    this.activeCtx?.cleanupCancel();
    this.activeCtx = null;
  }

  /** Cleanup on disconnect — zeroize ALL BTR state. */
  cleanupDisconnect(): void {
    this.sessionRootKey.fill(0);
    this.ratchetGeneration = 0;
    this.activeCtx?.cleanupCancel();
    this.activeCtx = null;
    this.lastLocalRatchetPub = null;
  }
}

// ══════════════════════════════════════════════════════════════════
// RB5: WASM-backed BTR adapter (production path when WASM available)
// ══════════════════════════════════════════════════════════════════

/**
 * Thin wrapper over WasmBtrTransferCtxHandle matching the interface
 * that TransferManager expects from BtrTransferContext (.sealChunk, .openChunk).
 */
class WasmBtrTransferCtxBridge {
  constructor(private handle: WasmBtrTransferCtxHandle) {}

  sealChunk(plaintext: Uint8Array): [number, Uint8Array] {
    const result = this.handle.sealChunk(plaintext);
    return [result.chainIndex, result.sealed];
  }

  openChunk(expectedIndex: number, sealed: Uint8Array): Uint8Array {
    return this.handle.openChunk(expectedIndex, sealed);
  }

  get chainIndex(): number { return this.handle.chainIndex(); }

  cleanupComplete(): void { this.handle.cleanupComplete(); }
  cleanupCancel(): void { this.handle.cleanupCancel(); }
}

/**
 * WASM-backed BtrTransferAdapter. Same interface as the TS version,
 * but all BTR state and crypto live in Rust/WASM opaque handles.
 */
export class WasmBtrTransferAdapter {
  private engine: WasmBtrEngineHandle;
  private activeCtx: WasmBtrTransferCtxBridge | null = null;

  constructor(engine: WasmBtrEngineHandle) {
    this.engine = engine;
  }

  get generation(): number {
    return this.engine.ratchetGeneration();
  }

  get activeTransferCtx(): WasmBtrTransferCtxBridge | null {
    return this.activeCtx;
  }

  beginSend(
    transferId: Uint8Array,
    _remoteRatchetPub: Uint8Array,
  ): [WasmBtrTransferCtxBridge, Uint8Array] {
    const ctx = this.engine.beginTransferSend(transferId, _remoteRatchetPub);
    this.activeCtx = new WasmBtrTransferCtxBridge(ctx);
    return [this.activeCtx, new Uint8Array(ctx.localRatchetPub())];
  }

  beginReceive(
    transferId: Uint8Array,
    senderRatchetPub: Uint8Array,
    localSecretKey: Uint8Array,
  ): WasmBtrTransferCtxBridge {
    // Pass localSecretKey to Rust so it does scalarMult(localSk, senderPub)
    // matching the TS BtrTransferAdapter.beginReceive() DH behavior exactly.
    const ctx = this.engine.beginTransferReceive(transferId, senderRatchetPub, localSecretKey);
    this.activeCtx = new WasmBtrTransferCtxBridge(ctx);
    return this.activeCtx;
  }

  buildEnvelopeFields(chainIndex: number, localRatchetPub?: Uint8Array): BtrEnvelopeFields {
    if (chainIndex === 0 && localRatchetPub) {
      return {
        ratchet_public_key: toBase64(localRatchetPub),
        ratchet_generation: this.engine.ratchetGeneration(),
        chain_index: chainIndex,
      };
    }
    return { chain_index: chainIndex };
  }

  endTransfer(): void {
    this.activeCtx?.cleanupComplete();
    this.activeCtx = null;
    this.engine.endTransfer();
  }

  cancelTransfer(): void {
    this.activeCtx?.cleanupCancel();
    this.activeCtx = null;
  }

  cleanupDisconnect(): void {
    this.activeCtx?.cleanupCancel();
    this.activeCtx = null;
    this.engine.cleanupDisconnect();
  }
}

/**
 * Factory: create the best available BTR adapter.
 * Returns WasmBtrTransferAdapter (Rust authority) if WASM is initialized,
 * otherwise falls back to BtrTransferAdapter (TS authority).
 */
/**
 * Create a BTR adapter backed by Rust/WASM authority.
 *
 * Returns null if WASM BTR is unavailable. In that case, BTR capability
 * should not be advertised and transfers use static NaCl box encryption.
 * The TS BTR fallback has been removed (RUST-AUTHORITY-MIGRATION-2) —
 * Rust/WASM is the only BTR authority.
 */
export function createBtrAdapter(sharedSecret: Uint8Array): WasmBtrTransferAdapter | null {
  const engine = createWasmBtrEngine(sharedSecret);
  if (engine) {
    console.log('[BTR_INIT] WASM-backed BTR adapter (Rust authority)');
    return new WasmBtrTransferAdapter(engine);
  }
  console.warn('[BTR_INIT] WASM BTR unavailable — BTR disabled (Rust authority required)');
  return null;
}
