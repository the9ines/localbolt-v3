import tweetnacl from 'tweetnacl';
const { box, randomBytes, scalarMult: naclScalarMult } = tweetnacl;
import { toBase64, fromBase64 } from './encoding.js';
import { EncryptionError } from './errors.js';
import { getWasmCrypto } from './wasm-crypto.js';

/**
 * Generate a fresh ephemeral X25519 keypair for a single connection.
 * Discard after session ends.
 *
 * RB3: Uses Rust/WASM when available, falls back to tweetnacl.
 */
export function generateEphemeralKeyPair(): {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
} {
  const wasm = getWasmCrypto();
  if (wasm) return wasm.generateEphemeralKeyPair();
  return box.keyPair();
}

/**
 * Seal a plaintext payload using NaCl box (XSalsa20-Poly1305).
 *
 * Wire format: base64(nonce || ciphertext)
 *
 * RB3: Uses Rust/WASM when available, falls back to tweetnacl.
 */
export function sealBoxPayload(
  plaintext: Uint8Array,
  remotePublicKey: Uint8Array,
  senderSecretKey: Uint8Array,
): string {
  const wasm = getWasmCrypto();
  if (wasm) return wasm.sealBoxPayload(plaintext, remotePublicKey, senderSecretKey);

  const nonce = randomBytes(box.nonceLength);
  const encrypted = box(plaintext, nonce, remotePublicKey, senderSecretKey);
  if (!encrypted) {
    nonce.fill(0); // Zeroize on error path too
    throw new EncryptionError('Encryption returned null');
  }
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  nonce.fill(0); // Best-effort nonce zeroization (ENDPOINT-SECURITY-1, F-MED-01)
  return toBase64(combined);
}

/**
 * Open a sealed payload using NaCl box.open.
 *
 * Expects wire format: base64(nonce || ciphertext)
 *
 * RB3: Uses Rust/WASM when available, falls back to tweetnacl.
 */
export function openBoxPayload(
  sealed: string,
  senderPublicKey: Uint8Array,
  receiverSecretKey: Uint8Array,
): Uint8Array {
  const wasm = getWasmCrypto();
  if (wasm) return wasm.openBoxPayload(sealed, senderPublicKey, receiverSecretKey);

  const data = fromBase64(sealed);
  if (data.length < box.nonceLength) {
    throw new EncryptionError('Sealed payload too short');
  }
  const nonce = data.slice(0, box.nonceLength);
  const ciphertext = data.slice(box.nonceLength);
  const decrypted = box.open(ciphertext, nonce, senderPublicKey, receiverSecretKey);
  nonce.fill(0); // Best-effort nonce zeroization (ENDPOINT-SECURITY-1, F-MED-01)
  if (!decrypted) throw new EncryptionError('Decryption failed');
  return decrypted;
}

/**
 * X25519 scalar multiplication (Diffie-Hellman shared secret).
 * Used by transport adapters for BTR engine initialization.
 */
export function scalarMult(secretKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return naclScalarMult(secretKey, publicKey);
}

/**
 * BTR capability mode enum. Used by transport adapters to check
 * whether BTR was negotiated for this session.
 */
export const BtrMode = {
  None: 'NONE',
  FullBtr: 'FULL_BTR',
  Downgrade: 'DOWNGRADE',
  Reject: 'REJECT',
} as const;
export type BtrModeValue = typeof BtrMode[keyof typeof BtrMode];

/**
 * Negotiate BTR mode from local and remote capability lists.
 * Simplified from the deleted btr/negotiate module.
 */
export function negotiateBtr(
  localSupports: boolean,
  remoteSupports: boolean,
  _remoteWellFormed?: boolean,
): BtrModeValue {
  if (localSupports && remoteSupports) return BtrMode.FullBtr;
  if (localSupports || remoteSupports) return BtrMode.Downgrade;
  return BtrMode.None;
}

/** Log token for BTR mode. */
export function btrLogToken(mode: BtrModeValue | null): string {
  switch (mode) {
    case BtrMode.FullBtr: return '[BTR_FULL]';
    case BtrMode.Downgrade: return '[BTR_DOWNGRADE]';
    case BtrMode.Reject: return '[BTR_REJECT]';
    default: return '[BTR_NONE]';
  }
}
