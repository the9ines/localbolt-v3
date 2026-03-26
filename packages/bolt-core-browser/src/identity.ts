import tweetnacl from 'tweetnacl';
const { box } = tweetnacl;
import { BoltError } from './errors.js';
import { getWasmCrypto } from './wasm-crypto.js';

/** Long-lived X25519 identity keypair. Persisted by the transport layer. */
export interface IdentityKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/**
 * Generate a persistent identity keypair (X25519).
 *
 * RB3: Uses Rust/WASM when available, falls back to tweetnacl.
 */
export function generateIdentityKeyPair(): IdentityKeyPair {
  const wasm = getWasmCrypto();
  if (wasm) return wasm.generateIdentityKeyPair();
  return box.keyPair();
}

/**
 * Thrown when a peer's identity public key does not match a previously
 * pinned value. This is a TOFU violation — the session MUST be aborted.
 */
export class KeyMismatchError extends BoltError {
  constructor(
    public readonly peerCode: string,
    public readonly expected: Uint8Array,
    public readonly received: Uint8Array,
  ) {
    super(`Identity key mismatch for peer ${peerCode}`);
    this.name = 'KeyMismatchError';
  }
}
