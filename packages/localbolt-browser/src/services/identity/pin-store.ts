import { toBase64, fromBase64, KeyMismatchError } from '@the9ines/bolt-core';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Stored pin record. `identityPub` is the TOFU key-continuity anchor (mismatch → abort).
 *
 * Item-6 / pre-EA1: `verified` is a legacy field and is NOT trusted — nothing writes
 * `true` anymore and `verifyPinnedIdentity` ignores any pre-existing `true`. It is kept
 * only for record-shape compatibility until a real EA1/PAKE verification exists.
 */
export interface PinRecord {
  identityPub: Uint8Array;
  verified: boolean;
}

/** Result of verifyPinnedIdentity. */
export type PinVerifyResult =
  | { outcome: 'pinned' }
  | { outcome: 'verified'; verified: boolean };

// ─── Pin Persistence Interface ──────────────────────────────────────────────

/** Abstract storage backend for TOFU peer pins. */
export interface PinPersistence {
  getPin(peerCode: string): Promise<PinRecord | null>;
  setPin(peerCode: string, identityPublicKey: Uint8Array, verified?: boolean): Promise<void>;
  removePin(peerCode: string): Promise<void>;
  markVerified(peerCode: string): Promise<void>;
}

// ─── IndexedDB Implementation ───────────────────────────────────────────────

const DB_NAME = 'bolt-pins';
const DB_VERSION = 1;
const STORE_NAME = 'pins';

function openPinDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB-backed pin persistence with lazy migration from v1 format. */
export class IndexedDBPinStore implements PinPersistence {
  async getPin(peerCode: string): Promise<PinRecord | null> {
    const db = await openPinDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(peerCode);
      req.onsuccess = () => {
        const val = req.result;
        if (!val) { resolve(null); return; }

        try {
          if (typeof val === 'string') {
            // v1 format: plain base64 string → migrate to PinRecord
            // Old entries were never user-verified, so verified=false is correct.
            // Write back immediately so stale string entries don't persist.
            const record: PinRecord = { identityPub: fromBase64(val), verified: false };
            this.setPin(peerCode, record.identityPub, false).catch(() => {});
            resolve(record);
            return;
          }
          // v2 format: { identityPub: base64, verified: boolean }
          resolve({ identityPub: fromBase64(val.identityPub), verified: !!val.verified });
        } catch {
          // Corrupted entry - treat as absent
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async setPin(peerCode: string, identityPublicKey: Uint8Array, verified = false): Promise<void> {
    const db = await openPinDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ identityPub: toBase64(identityPublicKey), verified }, peerCode);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async removePin(peerCode: string): Promise<void> {
    const db = await openPinDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(peerCode);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Item-6 / pre-EA1: no-op. Session approval is NOT persisted as a verified pin —
  // there is no cryptographic device verification yet, so nothing may write
  // `verified: true`. Kept for interface compatibility; deliberately writes nothing.
  async markVerified(_peerCode: string): Promise<void> {
    /* intentionally no persistence pre-EA1 */
  }
}

// ─── In-Memory Implementation (for tests) ───────────────────────────────────

/** In-memory pin persistence for testing. */
export class MemoryPinStore implements PinPersistence {
  private pins = new Map<string, PinRecord>();

  async getPin(peerCode: string): Promise<PinRecord | null> {
    return this.pins.get(peerCode) ?? null;
  }

  async setPin(peerCode: string, identityPublicKey: Uint8Array, verified = false): Promise<void> {
    this.pins.set(peerCode, { identityPub: identityPublicKey, verified });
  }

  async removePin(peerCode: string): Promise<void> {
    this.pins.delete(peerCode);
  }

  // Item-6 / pre-EA1: no-op (see IndexedDBPinStore.markVerified). Session approval is
  // not persisted as a verified pin.
  async markVerified(_peerCode: string): Promise<void> {
    /* intentionally no persistence pre-EA1 */
  }
}

// ─── Verification ───────────────────────────────────────────────────────────

function uint8Equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Verify a peer's identity against the pin store.
 *
 * - If no pin exists: pin the identity (first contact / TOFU), verified=false
 * - If pin matches: return with current verified status
 * - If pin mismatches: throw KeyMismatchError (fail-closed)
 */
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
    // Key-continuity match (TOFU): the identity key is unchanged since first contact.
    // Item-6 / pre-EA1: a stored `verified` flag is NOT proof of device identity, so it
    // is never surfaced as verified here. `verified: false` is returned unconditionally
    // (old `verified: true` records are ignored, not migrated); callers must treat this
    // as unverified and re-request user approval.
    return { outcome: 'verified', verified: false };
  }

  throw new KeyMismatchError(peerCode, existing.identityPub, identityPublicKey);
}
