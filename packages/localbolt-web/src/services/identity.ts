/**
 * Local identity persistence - H5-v3.
 *
 * Uses SDK-provided IndexedDBIdentityStore to persist a long-lived X25519
 * identity keypair in the browser. Keys survive page reloads and browser
 * restarts but are NOT encrypted-at-rest in IndexedDB.
 *
 * SHARED-DEVICE RISK: On shared computers, any origin-level script can read
 * IndexedDB. Users on shared devices should use private/incognito windows.
 */

import { IndexedDBIdentityStore, getOrCreateIdentity } from '@the9ines/localbolt-browser';
import type { IdentityKeyPair } from '@the9ines/bolt-core';

const identityStore = new IndexedDBIdentityStore();

let cachedIdentity: IdentityKeyPair | null = null;

/**
 * Load or create the local identity keypair.
 * Safe to call multiple times - returns cached result after first call.
 */
export async function initIdentity(): Promise<IdentityKeyPair> {
  if (cachedIdentity) return cachedIdentity;
  cachedIdentity = await getOrCreateIdentity(identityStore);
  return cachedIdentity;
}

// Best-effort key zeroization on page unload (ENDPOINT-SECURITY-1, F-HIGH-01).
// Fills the secretKey Uint8Array with zeros before the page is torn down.
// JavaScript GC may retain copies, but this zeroes the active buffer.
// Inline implementation avoids dependency on unpublished SDK export.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (cachedIdentity) {
      if (cachedIdentity.secretKey instanceof Uint8Array) {
        cachedIdentity.secretKey.fill(0);
      }
      cachedIdentity = null;
    }
  });
}
