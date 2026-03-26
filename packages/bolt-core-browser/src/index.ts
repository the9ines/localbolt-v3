// Constants (§14)
export {
  NONCE_LENGTH,
  PUBLIC_KEY_LENGTH,
  SECRET_KEY_LENGTH,
  DEFAULT_CHUNK_SIZE,
  PEER_CODE_LENGTH,
  PEER_CODE_ALPHABET,
  SAS_LENGTH,
  BOLT_VERSION,
  TRANSFER_ID_LENGTH,
  SAS_ENTROPY,
  FILE_HASH_ALGORITHM,
  FILE_HASH_LENGTH,
  CAPABILITY_NAMESPACE,
} from './constants.js';

// Encoding
export { toBase64, fromBase64 } from './encoding.js';

// Crypto primitives
export { generateEphemeralKeyPair, sealBoxPayload, openBoxPayload } from './crypto.js';

// Peer codes
export {
  generateSecurePeerCode,
  generateLongPeerCode,
  isValidPeerCode,
  normalizePeerCode,
} from './peer-code.js';

// Hashing
export { sha256, bufferToHex, hashFile } from './hash.js';

// SAS
export { computeSas } from './sas.js';

// Identity
export { generateIdentityKeyPair, KeyMismatchError } from './identity.js';
export type { IdentityKeyPair } from './identity.js';

// Errors
export { BoltError, EncryptionError, ConnectionError, TransferError, IntegrityError } from './errors.js';

// Wire error code registry (PROTOCOL.md §10)
export { WIRE_ERROR_CODES, isValidWireErrorCode } from './errors.js';
export type { WireErrorCode } from './errors.js';

// WASM protocol adapter (RUSTIFY-BROWSER-CORE-1 RB3+RB4)
export { initWasmCrypto, initWasmCryptoFromModule, getWasmCrypto, getWasmModule, createWasmBtrEngine, createWasmSendSession, getProtocolAuthorityMode } from './wasm-crypto.js';
export type { ProtocolAuthorityMode } from './wasm-crypto.js';
export type { WasmCryptoAdapter, WasmBtrEngineHandle, WasmBtrTransferCtxHandle, WasmSendSessionHandle } from './wasm-crypto.js';

// Bolt Transfer Ratchet (BTR) — DELETED.
// TS BTR implementation removed. WASM is sole BTR authority.
// Use createWasmBtrEngine() from wasm-crypto for BTR operations.

// BTR support (mode enum, negotiate, scalar mult — from deleted BTR module)
export { scalarMult, BtrMode, negotiateBtr, btrLogToken } from './crypto.js';
export type { BtrModeValue } from './crypto.js';

// BTR transfer context — alias to WASM handle (TS BTR deleted)
export type { WasmBtrTransferCtxHandle as BtrTransferContext } from './wasm-crypto.js';
