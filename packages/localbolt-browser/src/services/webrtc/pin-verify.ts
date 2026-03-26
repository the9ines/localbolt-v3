// Minimal pin verification inlined from identity/pin-store (extracted to localbolt-browser).
// This file exists only to break a circular dependency during TS extraction.
// It will be removed when WebRTCService/HandshakeManager move to localbolt-browser in Phase 3.

import { KeyMismatchError } from '@the9ines/bolt-core';

export interface PinPersistence {
  getPin(peerCode: string): Promise<{ identityPub: Uint8Array; verified: boolean } | null>;
  setPin(peerCode: string, identityPublicKey: Uint8Array, verified: boolean): Promise<void>;
  markVerified(peerCode: string): Promise<void>;
}

export interface PinVerifyResult {
  outcome: 'pinned' | 'verified';
  verified?: boolean;
}

function uint8Equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return false; }
  return true;
}

export async function verifyPinnedIdentity(
  pinStore: PinPersistence,
  peerCode: string,
  identityPublicKey: Uint8Array,
): Promise<PinVerifyResult> {
  const existing = await pinStore.getPin(peerCode);
  if (!existing) {
    await pinStore.setPin(peerCode, identityPublicKey, false);
    return { outcome: 'pinned' };
  }
  if (uint8Equal(existing.identityPub, identityPublicKey)) {
    return { outcome: 'verified', verified: existing.verified };
  }
  throw new KeyMismatchError(peerCode, existing.identityPub, identityPublicKey);
}
