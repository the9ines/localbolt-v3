/**
 * WASM-backed protocol adapter (RUSTIFY-BROWSER-CORE-1 RB3+RB4).
 *
 * RB3: crypto/session/SAS functions backed by Rust/WASM.
 * RB4: BTR state (BtrEngine, BtrTransferCtx) + transfer state (SendSession)
 *      backed by Rust/WASM opaque handles.
 *
 * TS tweetnacl/BTR implementations remain as fallback (PM-RB-03: condition-gated).
 */

// Type-only — matches TS crypto.ts signatures exactly
export interface WasmCryptoAdapter {
  generateEphemeralKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array };
  generateIdentityKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array };
  sealBoxPayload(plaintext: Uint8Array, remotePublicKey: Uint8Array, senderSecretKey: Uint8Array): string;
  openBoxPayload(sealed: string, senderPublicKey: Uint8Array, receiverSecretKey: Uint8Array): Uint8Array;
  computeSas(identityA: Uint8Array, identityB: Uint8Array, ephemeralA: Uint8Array, ephemeralB: Uint8Array): string;
  generateSecurePeerCode(): string;
  isValidPeerCode(code: string): boolean;
  sha256Hex(data: Uint8Array): string;
}

/** WASM adapter instance. null until initWasmCrypto() succeeds. */
let _wasmCrypto: WasmCryptoAdapter | null = null;

/** Whether WASM init has been attempted. */
let _initAttempted = false;

/**
 * Get the WASM crypto adapter, or null if not initialized or init failed.
 * Callers should fall back to TS crypto if this returns null.
 */
export function getWasmCrypto(): WasmCryptoAdapter | null {
  return _wasmCrypto;
}

/** BR3: Protocol authority mode for runtime observability. */
export type ProtocolAuthorityMode = 'wasm' | 'ts-fallback' | 'not-initialized';

/**
 * BR3: Query the current protocol authority mode.
 *
 * Returns:
 * - 'wasm': Rust/WASM protocol authority active (all crypto, BTR, transfer SM via Rust)
 * - 'ts-fallback': WASM init was attempted but failed; TS tweetnacl/BTR is authoritative
 * - 'not-initialized': initProtocolWasm() has not been called yet
 */
export function getProtocolAuthorityMode(): ProtocolAuthorityMode {
  if (_wasmCrypto) return 'wasm';
  if (_initAttempted) return 'ts-fallback';
  return 'not-initialized';
}

/**
 * Initialize WASM crypto from a pre-loaded WASM module.
 *
 * BR2: Accepts an already-loaded+initialized WASM module (provided by
 * transport-web's initProtocolWasm()). This avoids bare module specifier
 * issues — the loader lives in transport-web where the artifact is embedded.
 *
 * PM-RB-03: TS fallback remains operational if this is never called.
 *
 * @param wasmModule - The loaded bolt-protocol-wasm module (with exported functions)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function initWasmCryptoFromModule(wasmModule: any): boolean {
  if (_wasmCrypto) return true;

  try {
    _wasmModule = wasmModule;

    _wasmCrypto = {
      generateEphemeralKeyPair: () => wasmModule.generateEphemeralKeyPair(),
      generateIdentityKeyPair: () => wasmModule.generateIdentityKeyPair(),
      sealBoxPayload: (p: Uint8Array, rpk: Uint8Array, sk: Uint8Array) => wasmModule.sealBoxPayload(p, rpk, sk),
      openBoxPayload: (s: string, spk: Uint8Array, rsk: Uint8Array) => wasmModule.openBoxPayload(s, spk, rsk),
      computeSas: (ia: Uint8Array, ib: Uint8Array, ea: Uint8Array, eb: Uint8Array) => wasmModule.computeSas(ia, ib, ea, eb),
      generateSecurePeerCode: () => wasmModule.generateSecurePeerCode(),
      isValidPeerCode: (c: string) => wasmModule.isValidPeerCode(c),
      sha256Hex: (d: Uint8Array) => wasmModule.sha256Hex(d),
    };

    console.log('[BOLT-WASM] Protocol authority initialized (Rust/WASM: crypto + BTR + transfer)');
    return true;
  } catch (e) {
    console.warn('[BOLT-WASM] Failed to initialize from module:', e);
    _wasmCrypto = null;
    _wasmModule = null;
    return false;
  }
}

/**
 * Initialize WASM crypto. Legacy entry point — attempts dynamic import.
 * Prefer initProtocolWasm() from @the9ines/bolt-transport-web instead.
 */
export async function initWasmCrypto(): Promise<boolean> {
  if (_initAttempted) return _wasmCrypto !== null;
  _initAttempted = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wasm: any = await (Function('return import("bolt-protocol-wasm")')());
    await wasm.default();
    return initWasmCryptoFromModule(wasm);
  } catch (e) {
    console.warn('[BOLT-WASM] Failed to initialize — falling back to TS protocol:', e);
    _wasmCrypto = null;
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
// RB4: BTR + Transfer State Authority
// ══════════════════════════════════════════════════════════════════

/** WASM module reference for constructing opaque handles. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _wasmModule: any = null;

/**
 * Get the raw WASM module for constructing BTR/transfer handles.
 * Returns null if WASM not initialized.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getWasmModule(): any {
  return _wasmModule;
}

/**
 * Opaque BTR engine handle. Rust owns all key material.
 * Wraps WasmBtrEngine from bolt-protocol-wasm.
 *
 * Usage:
 *   const engine = createWasmBtrEngine(sharedSecret);
 *   const ctx = engine.beginTransferSend(transferId, remoteRatchetPub);
 *   const { chainIndex, sealed } = ctx.sealChunk(plaintext);
 *   engine.free();  // zeroize when done
 */
export interface WasmBtrEngineHandle {
  beginTransferSend(transferId: Uint8Array, remoteRatchetPub: Uint8Array): WasmBtrTransferCtxHandle;
  beginTransferReceive(transferId: Uint8Array, remoteRatchetPub: Uint8Array, localSecretKey: Uint8Array): WasmBtrTransferCtxHandle;
  ratchetGeneration(): number;
  endTransfer(): void;
  cleanupDisconnect(): void;
  free(): void;
}

export interface WasmBtrTransferCtxHandle {
  sealChunk(plaintext: Uint8Array): { chainIndex: number; sealed: Uint8Array };
  openChunk(expectedIndex: number, sealed: Uint8Array): Uint8Array;
  chainIndex(): number;
  generation(): number;
  transferId(): Uint8Array;
  localRatchetPub(): Uint8Array;
  cleanupComplete(): void;
  cleanupCancel(): void;
  free(): void;
}

export interface WasmSendSessionHandle {
  beginSend(transferId: string, payload: Uint8Array, filename: string, fileHash?: string): {
    transferId: string; filename: string; size: number; totalChunks: number; chunkSize: number; fileHash?: string;
  };
  onAccept(transferId: string): void;
  onCancel(transferId: string): void;
  onPause(transferId: string): void;
  onResume(transferId: string): void;
  nextChunk(): { transferId: string; chunkIndex: number; totalChunks: number; data: Uint8Array } | null;
  finish(): string;
  state(): string;
  isSendActive(): boolean;
  free(): void;
}

/**
 * Create a WASM-backed BTR engine. Returns null if WASM not available.
 * Caller must call .free() when done to zeroize key material.
 */
export function createWasmBtrEngine(sharedSecret: Uint8Array): WasmBtrEngineHandle | null {
  if (!_wasmModule) return null;
  try {
    return new _wasmModule.WasmBtrEngine(sharedSecret);
  } catch {
    return null;
  }
}

/**
 * Create a WASM-backed send session. Returns null if WASM not available.
 * Rust owns transfer-state transitions. TS proposes events; Rust validates.
 */
export function createWasmSendSession(): WasmSendSessionHandle | null {
  if (!_wasmModule) return null;
  try {
    return new _wasmModule.WasmSendSession();
  } catch {
    return null;
  }
}
