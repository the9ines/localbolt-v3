// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  generateEphemeralKeyPair,
  sealBoxPayload,
  openBoxPayload,
  toBase64,
  fromBase64,
  generateIdentityKeyPair,
  KeyMismatchError,
} from '@the9ines/bolt-core';
import { MemoryPinStore, verifyPinnedIdentity } from '../services/identity/pin-store.js';

// ─── HELLO Message Encryption / Decryption ──────────────────────────────────

describe('HELLO message encryption', () => {
  it('encrypts and decrypts HELLO with ephemeral keys', () => {
    const alice = generateEphemeralKeyPair();
    const bob = generateEphemeralKeyPair();
    const identity = generateIdentityKeyPair();

    const hello = JSON.stringify({
      type: 'hello',
      version: 1,
      identityPublicKey: toBase64(identity.publicKey),
    });

    const plaintext = new TextEncoder().encode(hello);
    const encrypted = sealBoxPayload(plaintext, bob.publicKey, alice.secretKey);

    // Bob decrypts with Alice's public key
    const decrypted = openBoxPayload(encrypted, alice.publicKey, bob.secretKey);
    const parsed = JSON.parse(new TextDecoder().decode(decrypted));

    expect(parsed.type).toBe('hello');
    expect(parsed.version).toBe(1);
    expect(fromBase64(parsed.identityPublicKey)).toEqual(identity.publicKey);
  });

  it('decryption fails with wrong key', () => {
    const alice = generateEphemeralKeyPair();
    const bob = generateEphemeralKeyPair();
    const eve = generateEphemeralKeyPair();
    const identity = generateIdentityKeyPair();

    const hello = JSON.stringify({
      type: 'hello',
      version: 1,
      identityPublicKey: toBase64(identity.publicKey),
    });

    const plaintext = new TextEncoder().encode(hello);
    const encrypted = sealBoxPayload(plaintext, bob.publicKey, alice.secretKey);

    // Eve cannot decrypt (she has wrong key)
    expect(() => openBoxPayload(encrypted, alice.publicKey, eve.secretKey)).toThrow();
  });

  it('identity key is only inside encrypted payload, not in outer envelope', () => {
    const alice = generateEphemeralKeyPair();
    const bob = generateEphemeralKeyPair();
    const identity = generateIdentityKeyPair();

    const hello = JSON.stringify({
      type: 'hello',
      version: 1,
      identityPublicKey: toBase64(identity.publicKey),
    });

    const plaintext = new TextEncoder().encode(hello);
    const encrypted = sealBoxPayload(plaintext, bob.publicKey, alice.secretKey);

    // The outer envelope only has type + payload
    const envelope = JSON.stringify({ type: 'hello', payload: encrypted });

    // Identity key must NOT appear in the outer envelope
    const identityB64 = toBase64(identity.publicKey);
    expect(envelope).not.toContain(identityB64);
  });
});

// ─── HELLO + TOFU Integration ───────────────────────────────────────────────

describe('HELLO + TOFU pin verification', () => {
  it('pins identity on first HELLO from a peer', async () => {
    const store = new MemoryPinStore();
    const identity = generateIdentityKeyPair();

    const result = await verifyPinnedIdentity(store, 'REMOTE01', identity.publicKey);
    expect(result).toEqual({ outcome: 'pinned' });

    // Key is now stored with verified=false
    const pin = await store.getPin('REMOTE01');
    expect(pin!.identityPub).toEqual(identity.publicKey);
    expect(pin!.verified).toBe(false);
  });

  it('verifies pinned identity on subsequent HELLO', async () => {
    const store = new MemoryPinStore();
    const identity = generateIdentityKeyPair();

    await verifyPinnedIdentity(store, 'REMOTE01', identity.publicKey);
    const result = await verifyPinnedIdentity(store, 'REMOTE01', identity.publicKey);
    expect(result).toEqual({ outcome: 'verified', verified: false });
  });

  it('rejects mismatched identity (fail-closed)', async () => {
    const store = new MemoryPinStore();
    const real = generateIdentityKeyPair();
    const imposter = generateIdentityKeyPair();

    await verifyPinnedIdentity(store, 'REMOTE01', real.publicKey);
    await expect(
      verifyPinnedIdentity(store, 'REMOTE01', imposter.publicKey),
    ).rejects.toThrow(KeyMismatchError);
  });
});

// ─── HELLO Protocol Flow (Unit) ──────────────────────────────────────────────

describe('HELLO protocol flow', () => {
  it('simulates full HELLO exchange between two peers', () => {
    // Alice and Bob each have ephemeral + identity keys
    const aliceEph = generateEphemeralKeyPair();
    const bobEph = generateEphemeralKeyPair();
    const aliceId = generateIdentityKeyPair();
    const bobId = generateIdentityKeyPair();

    // Alice sends HELLO to Bob
    const aliceHello = JSON.stringify({
      type: 'hello',
      version: 1,
      identityPublicKey: toBase64(aliceId.publicKey),
    });
    const aliceEncrypted = sealBoxPayload(
      new TextEncoder().encode(aliceHello),
      bobEph.publicKey,
      aliceEph.secretKey,
    );

    // Bob sends HELLO to Alice
    const bobHello = JSON.stringify({
      type: 'hello',
      version: 1,
      identityPublicKey: toBase64(bobId.publicKey),
    });
    const bobEncrypted = sealBoxPayload(
      new TextEncoder().encode(bobHello),
      aliceEph.publicKey,
      bobEph.secretKey,
    );

    // Bob decrypts Alice's HELLO
    const aliceDecrypted = JSON.parse(
      new TextDecoder().decode(openBoxPayload(aliceEncrypted, aliceEph.publicKey, bobEph.secretKey)),
    );
    expect(fromBase64(aliceDecrypted.identityPublicKey)).toEqual(aliceId.publicKey);

    // Alice decrypts Bob's HELLO
    const bobDecrypted = JSON.parse(
      new TextDecoder().decode(openBoxPayload(bobEncrypted, bobEph.publicKey, aliceEph.secretKey)),
    );
    expect(fromBase64(bobDecrypted.identityPublicKey)).toEqual(bobId.publicKey);
  });

  it('HELLO version field is present and equals 1', () => {
    const eph = generateEphemeralKeyPair();
    const remote = generateEphemeralKeyPair();
    const id = generateIdentityKeyPair();

    const hello = JSON.stringify({
      type: 'hello',
      version: 1,
      identityPublicKey: toBase64(id.publicKey),
    });

    const encrypted = sealBoxPayload(
      new TextEncoder().encode(hello),
      remote.publicKey,
      eph.secretKey,
    );
    const decrypted = JSON.parse(
      new TextDecoder().decode(openBoxPayload(encrypted, eph.publicKey, remote.secretKey)),
    );

    expect(decrypted.version).toBe(1);
    expect(decrypted.type).toBe('hello');
  });
});
