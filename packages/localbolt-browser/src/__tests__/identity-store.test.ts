import { describe, it, expect } from 'vitest';
import { generateIdentityKeyPair } from '@the9ines/bolt-core';
import { MemoryIdentityStore, getOrCreateIdentity } from '../services/identity/identity-store.js';

describe('MemoryIdentityStore', () => {
  it('returns null when empty', async () => {
    const store = new MemoryIdentityStore();
    expect(await store.load()).toBeNull();
  });

  it('persists a saved keypair', async () => {
    const store = new MemoryIdentityStore();
    const kp = generateIdentityKeyPair();
    await store.save(kp);

    const loaded = await store.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.publicKey).toEqual(kp.publicKey);
    expect(loaded!.secretKey).toEqual(kp.secretKey);
  });

  it('overwrites on second save', async () => {
    const store = new MemoryIdentityStore();
    const kp1 = generateIdentityKeyPair();
    const kp2 = generateIdentityKeyPair();

    await store.save(kp1);
    await store.save(kp2);

    const loaded = await store.load();
    expect(loaded!.publicKey).toEqual(kp2.publicKey);
  });
});

describe('getOrCreateIdentity', () => {
  it('generates and persists on first call', async () => {
    const store = new MemoryIdentityStore();
    const identity = await getOrCreateIdentity(store);

    expect(identity.publicKey).toBeInstanceOf(Uint8Array);
    expect(identity.publicKey.length).toBe(32);

    // Persisted
    const loaded = await store.load();
    expect(loaded!.publicKey).toEqual(identity.publicKey);
  });

  it('returns same identity on subsequent calls', async () => {
    const store = new MemoryIdentityStore();
    const first = await getOrCreateIdentity(store);
    const second = await getOrCreateIdentity(store);

    expect(first.publicKey).toEqual(second.publicKey);
    expect(first.secretKey).toEqual(second.secretKey);
  });
});
