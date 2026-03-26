// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import type { SignalingProvider } from '../services/signaling/SignalingProvider.js';

// ─── Stub @the9ines/bolt-core to isolate from real crypto ─────────────────────

vi.mock('@the9ines/bolt-core', () => ({
  sealBoxPayload: () => 'encrypted-stub',
  openBoxPayload: () => new Uint8Array(0),
  generateEphemeralKeyPair: () => ({
    publicKey: new Uint8Array(32),
    secretKey: new Uint8Array(32),
  }),
  generateIdentityKeyPair: () => ({
    publicKey: new Uint8Array(32),
    secretKey: new Uint8Array(64),
  }),
  toBase64: () => '',
  fromBase64: () => new Uint8Array(32),
  DEFAULT_CHUNK_SIZE: 16384,
  BoltError: class extends Error {},
  EncryptionError: class extends Error {},
  ConnectionError: class extends Error {},
  TransferError: class extends Error {},
  IntegrityError: class extends Error {},
  KeyMismatchError: class extends Error {},
  computeSas: () => 'AABBCC',
  bufferToHex: () => '',
  hashFile: async () => 'a'.repeat(64),
  WIRE_ERROR_CODES: [],
  isValidWireErrorCode: () => false,
  negotiateBtr: () => 'STATIC_EPHEMERAL',
  btrLogToken: () => null,
  BtrMode: { FullBtr: 'FULL_BTR', Downgrade: 'DOWNGRADE', StaticEphemeral: 'STATIC_EPHEMERAL', Reject: 'REJECT' },
  scalarMult: () => new Uint8Array(32),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockSignaling(): SignalingProvider {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    onSignal: vi.fn(),
    onPeerDiscovered: vi.fn(),
    onPeerLost: vi.fn(),
    sendSignal: vi.fn().mockResolvedValue(undefined),
    getPeers: vi.fn().mockReturnValue([]),
    disconnect: vi.fn(),
    name: 'mock',
  };
}

async function createService() {
  const mod = await import('../services/webrtc/WebRTCService.js');
  const WebRTCService = mod.default;
  return new WebRTCService(
    createMockSignaling(),
    'TEST',
    vi.fn(),
    vi.fn(),
  );
}

// ─── SA7 + SA19: Key Buffer Zeroization on Disconnect ────────────────────────

describe('MEMORY-HARDEN-1A: remote key buffer zeroization', () => {
  it('SA19: remotePublicKey buffer is zeroed before being nulled', async () => {
    const service = await createService();
    const buf = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    (service as any).remotePublicKey = buf;

    service.disconnect();

    // Buffer reference should now be all zeros
    expect(buf.every(b => b === 0)).toBe(true);
    // Field should be null
    expect((service as any).remotePublicKey).toBeNull();
  });

  it('SA7: remoteIdentityKey buffer is zeroed before being nulled', async () => {
    const service = await createService();
    const buf = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD]);
    (service as any).remoteIdentityKey = buf;

    service.disconnect();

    // Buffer reference should now be all zeros
    expect(buf.every(b => b === 0)).toBe(true);
    // Field should be null
    expect((service as any).remoteIdentityKey).toBeNull();
  });

  it('disconnect() does not throw when both keys are already null', async () => {
    const service = await createService();
    (service as any).remotePublicKey = null;
    (service as any).remoteIdentityKey = null;

    expect(() => service.disconnect()).not.toThrow();
    expect((service as any).remotePublicKey).toBeNull();
    expect((service as any).remoteIdentityKey).toBeNull();
  });

  it('disconnect() called twice does not throw and buffers remain zeroed', async () => {
    const service = await createService();
    const pubBuf = new Uint8Array([10, 20, 30]);
    const idBuf = new Uint8Array([40, 50, 60]);
    (service as any).remotePublicKey = pubBuf;
    (service as any).remoteIdentityKey = idBuf;

    service.disconnect();
    expect(pubBuf.every(b => b === 0)).toBe(true);
    expect(idBuf.every(b => b === 0)).toBe(true);

    // Second disconnect — must not throw, buffers stay zeroed
    expect(() => service.disconnect()).not.toThrow();
    expect(pubBuf.every(b => b === 0)).toBe(true);
    expect(idBuf.every(b => b === 0)).toBe(true);
    expect((service as any).remotePublicKey).toBeNull();
    expect((service as any).remoteIdentityKey).toBeNull();
  });

  it('disconnect() handles zero-length buffers without throwing', async () => {
    const service = await createService();
    (service as any).remotePublicKey = new Uint8Array(0);
    (service as any).remoteIdentityKey = new Uint8Array(0);

    expect(() => service.disconnect()).not.toThrow();
    expect((service as any).remotePublicKey).toBeNull();
    expect((service as any).remoteIdentityKey).toBeNull();
  });

  it('disconnect() handles non-standard buffer lengths without throwing', async () => {
    const service = await createService();
    // 1-byte and 128-byte — unusual but valid Uint8Arrays
    const small = new Uint8Array([0xFF]);
    const large = new Uint8Array(128).fill(0x42);
    (service as any).remotePublicKey = small;
    (service as any).remoteIdentityKey = large;

    expect(() => service.disconnect()).not.toThrow();
    expect(small.every(b => b === 0)).toBe(true);
    expect(large.every(b => b === 0)).toBe(true);
    expect((service as any).remotePublicKey).toBeNull();
    expect((service as any).remoteIdentityKey).toBeNull();
  });
});
