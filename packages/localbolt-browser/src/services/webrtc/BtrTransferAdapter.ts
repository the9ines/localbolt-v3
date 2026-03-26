/**
 * BtrTransferAdapter — WASM-backed BTR for transfer send/receive.
 *
 * TS BTR fallback deleted (RUST-AUTHORITY-MIGRATION-2).
 * Only WasmBtrTransferAdapter remains — all BTR state and crypto
 * live in Rust/WASM opaque handles.
 */

import {
  toBase64,
  createWasmBtrEngine,
} from '@the9ines/bolt-core';
import type { WasmBtrEngineHandle, WasmBtrTransferCtxHandle } from '@the9ines/bolt-core';

/** BTR envelope metadata for a single chunk/message. */
export interface BtrEnvelopeFields {
  ratchet_public_key?: string;  // base64 of 32 bytes (first chunk only)
  ratchet_generation?: number;  // uint32 (with ratchet_public_key)
  chain_index: number;          // uint32 (every chunk)
}

/** Wrapper for WASM transfer context that matches TransferManager's expected interface. */
class TransferCtxBridge {
  constructor(private ctx: WasmBtrTransferCtxHandle) {}

  /** Seal a chunk. Returns [chainIndex, sealed] tuple for TransferManager destructuring. */
  sealChunk(plaintext: Uint8Array): [number, Uint8Array] {
    const result = this.ctx.sealChunk(plaintext);
    return [result.chainIndex, result.sealed];
  }

  /** Open a sealed chunk. */
  openChunk(chainIndex: number, sealed: Uint8Array): Uint8Array {
    return this.ctx.openChunk(chainIndex, sealed);
  }
}

/**
 * WASM-backed BTR adapter. Interface matches what TransferManager expects.
 */
export class WasmBtrTransferAdapter {
  private engine: WasmBtrEngineHandle;
  private activeCtx: TransferCtxBridge | null = null;
  generation: number = 0;
  private lastRatchetPub: Uint8Array | null = null;

  constructor(engine: WasmBtrEngineHandle) {
    this.engine = engine;
    this.generation = engine.ratchetGeneration();
  }

  /** Begin send transfer. Returns [ctxBridge, ratchetPublicKey] for TransferManager. */
  beginSend(transferId: Uint8Array, remotePublicKey: Uint8Array): [TransferCtxBridge, Uint8Array] {
    const ctx = this.engine.beginTransferSend(transferId, remotePublicKey);
    this.activeCtx = new TransferCtxBridge(ctx);
    this.generation = this.engine.ratchetGeneration();
    this.lastRatchetPub = ctx.localRatchetPub();
    return [this.activeCtx, this.lastRatchetPub];
  }

  /** Begin receive transfer. Sets activeTransferCtx. */
  beginReceive(
    transferId: Uint8Array,
    remoteRatchetPub: Uint8Array,
    localSecretKey: Uint8Array,
  ): void {
    const ctx = this.engine.beginTransferReceive(transferId, remoteRatchetPub, localSecretKey);
    this.activeCtx = new TransferCtxBridge(ctx);
    this.generation = this.engine.ratchetGeneration();
  }

  get activeTransferCtx(): TransferCtxBridge | null {
    return this.activeCtx;
  }

  /** Build BTR envelope fields for a chunk. */
  buildEnvelopeFields(chainIndex: number, ratchetPub?: Uint8Array): BtrEnvelopeFields {
    return {
      chain_index: chainIndex,
      ratchet_public_key: ratchetPub ? toBase64(ratchetPub) : undefined,
      ratchet_generation: ratchetPub ? this.generation : undefined,
    };
  }

  endTransfer(): void {
    this.engine.endTransfer();
    this.activeCtx = null;
  }

  cancelTransfer(): void {
    this.engine.endTransfer();
    this.activeCtx = null;
  }

  cleanupDisconnect(): void {
    this.engine.cleanupDisconnect();
    this.activeCtx = null;
  }
}

/**
 * Create a BTR adapter. Returns WASM-backed adapter or null if WASM unavailable.
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
