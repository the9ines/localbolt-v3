import { generateIdentityKeyPair, toBase64, fromBase64 } from '@the9ines/bolt-core';
import type { IdentityKeyPair } from '@the9ines/bolt-core';

// ─── Persistence Interface ──────────────────────────────────────────────────

/** Abstract storage backend for identity keypairs. */
export interface IdentityPersistence {
  load(): Promise<IdentityKeyPair | null>;
  save(pair: IdentityKeyPair): Promise<void>;
}

// ─── IndexedDB Implementation ───────────────────────────────────────────────

const DB_NAME = 'bolt-identity';
const DB_VERSION = 1;
const STORE_NAME = 'keypair';
const KEY_ID = 'local';

function openDB(): Promise<IDBDatabase> {
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

/** IndexedDB-backed identity persistence. */
export class IndexedDBIdentityStore implements IdentityPersistence {
  async load(): Promise<IdentityKeyPair | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_ID);
      req.onsuccess = () => {
        const row = req.result;
        if (!row) { resolve(null); return; }
        resolve({
          publicKey: fromBase64(row.publicKey),
          secretKey: fromBase64(row.secretKey),
        });
      };
      req.onerror = () => reject(req.error);
    });
  }

  async save(pair: IdentityKeyPair): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        publicKey: toBase64(pair.publicKey),
        secretKey: toBase64(pair.secretKey),
      }, KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// ─── Key Zeroization ─────────────────────────────────────────────────────────

/**
 * Best-effort zeroization of an identity keypair's secret key.
 *
 * Fills the secretKey Uint8Array with zeros. This does not guarantee the
 * original bytes are erased from all memory (JavaScript GC may retain copies),
 * but it zeroes the active buffer so the key is not trivially extractable
 * from a heap dump after cleanup.
 *
 * Call this when the identity is no longer needed (disconnect, page unload).
 */
export function zeroizeIdentityKey(pair: IdentityKeyPair): void {
  if (pair.secretKey instanceof Uint8Array) {
    pair.secretKey.fill(0);
  }
}

// ─── In-Memory Implementation (for tests) ───────────────────────────────────

/** In-memory identity persistence for testing. */
export class MemoryIdentityStore implements IdentityPersistence {
  private pair: IdentityKeyPair | null = null;

  async load(): Promise<IdentityKeyPair | null> {
    return this.pair;
  }

  async save(pair: IdentityKeyPair): Promise<void> {
    this.pair = pair;
  }
}

// ─── getOrCreateIdentity ────────────────────────────────────────────────────

/**
 * Load the local identity keypair from storage, or generate and persist
 * a new one if none exists.
 */
export async function getOrCreateIdentity(
  store: IdentityPersistence,
): Promise<IdentityKeyPair> {
  const existing = await store.load();
  if (existing) return existing;

  const pair = generateIdentityKeyPair();
  await store.save(pair);
  return pair;
}
