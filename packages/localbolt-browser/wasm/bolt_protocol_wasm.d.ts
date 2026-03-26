/* tslint:disable */
/* eslint-disable */

/**
 * Opaque handle to BtrEngine. Rust owns all key material.
 * JS holds the handle; Rust validates all state transitions.
 */
export class WasmBtrEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Begin a receive-side transfer using existing ephemeral secret key.
     * Matches TS BtrTransferAdapter.beginReceive() which uses
     * scalarMult(localSecretKey, senderRatchetPub) for the DH step.
     */
    beginTransferReceive(transfer_id: Uint8Array, remote_ratchet_pub: Uint8Array, local_secret_key: Uint8Array): WasmBtrTransferCtx;
    /**
     * Begin a send-side transfer. Returns a WasmBtrTransferCtx handle.
     */
    beginTransferSend(transfer_id: Uint8Array, remote_ratchet_pub: Uint8Array): WasmBtrTransferCtx;
    /**
     * Cleanup on disconnect — zeroize all BTR state.
     */
    cleanupDisconnect(): void;
    /**
     * End the current transfer's replay tracking.
     */
    endTransfer(): void;
    /**
     * Create a new BTR engine from the ephemeral shared secret.
     * Called after HELLO handshake when BTR is negotiated.
     */
    constructor(shared_secret: Uint8Array);
    /**
     * Current ratchet generation (monotonically increasing).
     */
    ratchetGeneration(): number;
}

/**
 * Opaque handle to BtrTransferContext. Per-chunk seal/open hot path.
 */
export class WasmBtrTransferCtx {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Current chain index.
     */
    chainIndex(): number;
    /**
     * Cleanup on transfer cancel.
     */
    cleanupCancel(): void;
    /**
     * Cleanup on transfer complete.
     */
    cleanupComplete(): void;
    /**
     * Ratchet generation for this transfer.
     */
    generation(): number;
    /**
     * Local ratchet public key (for envelope fields).
     */
    localRatchetPub(): Uint8Array;
    /**
     * Decrypt a chunk at expected chain position.
     * HOT PATH — called per 16 KiB chunk.
     */
    openChunk(expected_chain_index: number, sealed: Uint8Array): Uint8Array;
    /**
     * Encrypt a chunk. Returns { chainIndex: number, sealed: Uint8Array }.
     * HOT PATH — called per 16 KiB chunk (~62 times per MiB).
     */
    sealChunk(plaintext: Uint8Array): any;
    /**
     * Transfer ID (16 bytes).
     */
    transferId(): Uint8Array;
}

/**
 * Opaque handle to SendSession. Rust owns transfer-state transitions.
 * TS proposes events (accept, cancel, pause); Rust validates and transitions.
 */
export class WasmSendSession {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Begin an outbound transfer. Transitions Idle → Offered.
     * Returns { transferId, filename, size, totalChunks, chunkSize, fileHash? }.
     */
    beginSend(transfer_id: string, payload: Uint8Array, filename: string, file_hash?: string | null): any;
    /**
     * Finalize. Transitions Transferring → Completed. Returns transfer_id.
     */
    finish(): string;
    /**
     * True if Transferring with chunks remaining.
     */
    isSendActive(): boolean;
    /**
     * Create a new send session in Idle state.
     */
    constructor();
    /**
     * Yield next chunk. Returns { transferId, chunkIndex, totalChunks, data } or null.
     */
    nextChunk(): any;
    /**
     * Receiver accepted. Transitions Offered → Transferring.
     */
    onAccept(transfer_id: string): void;
    /**
     * Cancel. Transitions Offered/Transferring/Paused → Cancelled.
     */
    onCancel(transfer_id: string): void;
    /**
     * Pause sending. Transitions Transferring → Paused.
     */
    onPause(transfer_id: string): void;
    /**
     * Resume sending. Transitions Paused → Transferring.
     */
    onResume(transfer_id: string): void;
    /**
     * Current state as string (for TS display/logging).
     */
    state(): string;
}

/**
 * Compute 6-character SAS from identity + ephemeral public keys.
 *
 * Parity: TS `computeSas(identityA, identityB, ephemeralA, ephemeralB)`.
 * Identical algorithm: SHA-256(sort32(id_a, id_b) || sort32(eph_a, eph_b)),
 * first 6 hex chars, uppercase.
 */
export function computeSas(identity_a: Uint8Array, identity_b: Uint8Array, ephemeral_a: Uint8Array, ephemeral_b: Uint8Array): string;

/**
 * Generate an ephemeral X25519 keypair for session use.
 *
 * Returns a JsValue containing { publicKey: Uint8Array, secretKey: Uint8Array }.
 * Parity: TS `generateEphemeralKeyPair()` (tweetnacl `box.keyPair()`).
 */
export function generateEphemeralKeyPair(): any;

/**
 * Generate a persistent identity X25519 keypair.
 *
 * Returns a JsValue containing { publicKey: Uint8Array, secretKey: Uint8Array }.
 * Parity: TS `generateIdentityKeyPair()`.
 */
export function generateIdentityKeyPair(): any;

/**
 * Generate a 6-character secure peer code.
 *
 * Parity: TS `generateSecurePeerCode()`.
 */
export function generateSecurePeerCode(): string;

/**
 * Initialize panic hook for browser console error reporting.
 * Called once at WASM module load time.
 */
export function init(): void;

/**
 * Validate a peer code (6 or 8 chars, optional hyphens, unambiguous alphabet).
 *
 * Parity: TS `isValidPeerCode(code)`.
 */
export function isValidPeerCode(code: string): boolean;

/**
 * Negotiate BTR mode from capability flags.
 */
export function negotiateBtr(local_supports: boolean, remote_supports: boolean, remote_well_formed: boolean): string;

/**
 * Open a sealed NaCl box payload. Expects base64(nonce || ciphertext).
 *
 * Parity: TS `openBoxPayload(sealed, senderPublicKey, receiverSecretKey)`.
 */
export function openBoxPayload(sealed: string, sender_public_key: Uint8Array, receiver_secret_key: Uint8Array): Uint8Array;

/**
 * Seal plaintext using NaCl box. Returns base64(nonce || ciphertext).
 *
 * Parity: TS `sealBoxPayload(plaintext, remotePublicKey, senderSecretKey)`.
 * Identical wire format. Random nonce generated internally via CSPRNG.
 */
export function sealBoxPayload(plaintext: Uint8Array, remote_public_key: Uint8Array, sender_secret_key: Uint8Array): string;

/**
 * Compute SHA-256 hex digest of data.
 *
 * Parity: TS `sha256Hex(data)`.
 */
export function sha256Hex(data: Uint8Array): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmbtrengine_free: (a: number, b: number) => void;
    readonly __wbg_wasmbtrtransferctx_free: (a: number, b: number) => void;
    readonly __wbg_wasmsendsession_free: (a: number, b: number) => void;
    readonly computeSas: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number, number];
    readonly generateEphemeralKeyPair: () => [number, number, number];
    readonly generateIdentityKeyPair: () => [number, number, number];
    readonly generateSecurePeerCode: () => [number, number];
    readonly isValidPeerCode: (a: number, b: number) => number;
    readonly negotiateBtr: (a: number, b: number, c: number) => [number, number];
    readonly openBoxPayload: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly sealBoxPayload: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly sha256Hex: (a: number, b: number) => [number, number];
    readonly wasmbtrengine_beginTransferReceive: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly wasmbtrengine_beginTransferSend: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly wasmbtrengine_cleanupDisconnect: (a: number) => void;
    readonly wasmbtrengine_endTransfer: (a: number) => void;
    readonly wasmbtrengine_new: (a: number, b: number) => [number, number, number];
    readonly wasmbtrengine_ratchetGeneration: (a: number) => number;
    readonly wasmbtrtransferctx_chainIndex: (a: number) => number;
    readonly wasmbtrtransferctx_cleanupCancel: (a: number) => void;
    readonly wasmbtrtransferctx_cleanupComplete: (a: number) => void;
    readonly wasmbtrtransferctx_generation: (a: number) => number;
    readonly wasmbtrtransferctx_localRatchetPub: (a: number) => [number, number];
    readonly wasmbtrtransferctx_openChunk: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly wasmbtrtransferctx_sealChunk: (a: number, b: number, c: number) => [number, number, number];
    readonly wasmbtrtransferctx_transferId: (a: number) => [number, number];
    readonly wasmsendsession_beginSend: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number];
    readonly wasmsendsession_finish: (a: number) => [number, number, number, number];
    readonly wasmsendsession_isSendActive: (a: number) => number;
    readonly wasmsendsession_new: () => number;
    readonly wasmsendsession_nextChunk: (a: number) => [number, number, number];
    readonly wasmsendsession_onAccept: (a: number, b: number, c: number) => [number, number];
    readonly wasmsendsession_onCancel: (a: number, b: number, c: number) => [number, number];
    readonly wasmsendsession_onPause: (a: number, b: number, c: number) => [number, number];
    readonly wasmsendsession_onResume: (a: number, b: number, c: number) => [number, number];
    readonly wasmsendsession_state: (a: number) => [number, number];
    readonly init: () => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
