import { describe, it, expect } from 'vitest';
import { KeyMismatchError } from '@the9ines/bolt-core';
import { MemoryPinStore, verifyPinnedIdentity } from '../services/identity/pin-store.js';

function randomKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}

describe('MemoryPinStore', () => {
  it('returns null for unknown peer', async () => {
    const store = new MemoryPinStore();
    expect(await store.getPin('UNKNOWN')).toBeNull();
  });

  it('stores and retrieves a pin', async () => {
    const store = new MemoryPinStore();
    const key = randomKey();
    await store.setPin('PEER01', key);

    const pin = await store.getPin('PEER01');
    expect(pin).not.toBeNull();
    expect(pin!.identityPub).toEqual(key);
    expect(pin!.verified).toBe(false);
  });

  it('removes a pin', async () => {
    const store = new MemoryPinStore();
    await store.setPin('PEER01', randomKey());
    await store.removePin('PEER01');
    expect(await store.getPin('PEER01')).toBeNull();
  });

  it('isolates pins by peer code', async () => {
    const store = new MemoryPinStore();
    const k1 = randomKey();
    const k2 = randomKey();
    await store.setPin('PEER01', k1);
    await store.setPin('PEER02', k2);

    expect((await store.getPin('PEER01'))!.identityPub).toEqual(k1);
    expect((await store.getPin('PEER02'))!.identityPub).toEqual(k2);
  });
});

describe('verifyPinnedIdentity', () => {
  it('pins on first contact and returns outcome "pinned"', async () => {
    const store = new MemoryPinStore();
    const key = randomKey();

    const result = await verifyPinnedIdentity(store, 'NEWPEER', key);
    expect(result).toEqual({ outcome: 'pinned' });

    // Key is now stored with verified=false
    const pin = await store.getPin('NEWPEER');
    expect(pin!.identityPub).toEqual(key);
    expect(pin!.verified).toBe(false);
  });

  it('returns outcome "verified" when pinned key matches', async () => {
    const store = new MemoryPinStore();
    const key = randomKey();
    await store.setPin('PEER01', key);

    const result = await verifyPinnedIdentity(store, 'PEER01', key);
    expect(result).toEqual({ outcome: 'verified', verified: false });
  });

  it('throws KeyMismatchError when pinned key differs', async () => {
    const store = new MemoryPinStore();
    const pinned = randomKey();
    const imposter = randomKey();
    await store.setPin('PEER01', pinned);

    await expect(
      verifyPinnedIdentity(store, 'PEER01', imposter),
    ).rejects.toThrow(KeyMismatchError);
  });

  it('KeyMismatchError contains expected and received keys', async () => {
    const store = new MemoryPinStore();
    const pinned = randomKey();
    const imposter = randomKey();
    await store.setPin('PEER01', pinned);

    try {
      await verifyPinnedIdentity(store, 'PEER01', imposter);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(KeyMismatchError);
      const e = err as KeyMismatchError;
      expect(e.peerCode).toBe('PEER01');
      expect(e.expected).toEqual(pinned);
      expect(e.received).toEqual(imposter);
    }
  });
});
