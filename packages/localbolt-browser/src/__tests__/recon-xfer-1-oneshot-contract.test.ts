// @vitest-environment jsdom
/**
 * RECON-XFER-1 — SDK one-shot service lifecycle contract test.
 *
 * Documents and validates the invariant: WebRTCService follows a one-shot
 * lifecycle. After disconnect(), the signaling listener is permanently removed
 * and the service cannot receive new offer/answer/ICE signals.
 *
 * Consumers (localbolt-v3, localbolt, localbolt-app) MUST create a new
 * WebRTCService instance for each connection attempt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SignalingProvider } from '../services/signaling/SignalingProvider.js';

// ─── Stub @the9ines/bolt-core ─────────────────────────────────────────────

vi.mock('@the9ines/bolt-core', () => ({
  sealBoxPayload: (_data: Uint8Array) => 'encrypted-stub',
  openBoxPayload: () => new Uint8Array(0),
  generateEphemeralKeyPair: () => ({
    publicKey: new Uint8Array(32),
    secretKey: new Uint8Array(32),
  }),
  generateIdentityKeyPair: () => ({
    publicKey: new Uint8Array(32),
    secretKey: new Uint8Array(64),
  }),
  toBase64: () => 'base64-stub',
  fromBase64: () => new Uint8Array(32),
  DEFAULT_CHUNK_SIZE: 16384,
  BoltError: class extends Error {
    details?: unknown;
    constructor(m: string, d?: unknown) { super(m); this.details = d; }
  },
  EncryptionError: class extends Error {
    constructor(m: string) { super(m); this.name = 'EncryptionError'; }
  },
  ConnectionError: class extends Error {
    constructor(m: string) { super(m); this.name = 'ConnectionError'; }
  },
  TransferError: class extends Error {
    constructor(m: string) { super(m); this.name = 'TransferError'; }
  },
  IntegrityError: class extends Error {
    constructor(m = 'integrity') { super(m); this.name = 'IntegrityError'; }
  },
  KeyMismatchError: class extends Error {
    constructor(m: string) { super(m); this.name = 'KeyMismatchError'; }
  },
  computeSas: () => 'AABBCC',
  bufferToHex: () => '',
  hashFile: async () => 'a'.repeat(64),
  WIRE_ERROR_CODES: [
    'VERSION_MISMATCH', 'ENCRYPTION_FAILED', 'INTEGRITY_FAILED',
    'REPLAY_DETECTED', 'TRANSFER_FAILED', 'LIMIT_EXCEEDED',
    'CONNECTION_LOST', 'PEER_NOT_FOUND', 'ALREADY_CONNECTED',
    'INVALID_STATE', 'KEY_MISMATCH', 'DUPLICATE_HELLO',
    'ENVELOPE_REQUIRED', 'ENVELOPE_UNNEGOTIATED', 'ENVELOPE_DECRYPT_FAIL',
    'ENVELOPE_INVALID', 'HELLO_PARSE_ERROR', 'HELLO_DECRYPT_FAIL',
    'HELLO_SCHEMA_ERROR', 'INVALID_MESSAGE', 'UNKNOWN_MESSAGE_TYPE',
    'PROTOCOL_VIOLATION',
  ],
  isValidWireErrorCode: (x: unknown) => typeof x === 'string',
  negotiateBtr: () => 'STATIC_EPHEMERAL',
  btrLogToken: () => null,
  BtrMode: { FullBtr: 'FULL_BTR', Downgrade: 'DOWNGRADE', StaticEphemeral: 'STATIC_EPHEMERAL', Reject: 'REJECT' },
  scalarMult: () => new Uint8Array(32),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────

function createMockSignaling(): SignalingProvider & {
  signalCallbacks: Array<(signal: any) => void>;
  fireSignal: (signal: any) => void;
} {
  const signalCallbacks: Array<(signal: any) => void> = [];
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    onSignal: vi.fn((cb) => {
      signalCallbacks.push(cb);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        const idx = signalCallbacks.indexOf(cb);
        if (idx >= 0) signalCallbacks.splice(idx, 1);
      };
    }),
    onPeerDiscovered: vi.fn(),
    onPeerLost: vi.fn(),
    sendSignal: vi.fn().mockResolvedValue(undefined),
    getPeers: vi.fn().mockReturnValue([]),
    disconnect: vi.fn(),
    name: 'mock',
    signalCallbacks,
    fireSignal(signal: any) {
      // Snapshot to avoid mutation during iteration
      [...signalCallbacks].forEach((cb) => cb(signal));
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('RECON-XFER-1: SDK one-shot service lifecycle contract', () => {
  let WebRTCService: any;

  beforeEach(async () => {
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  it('constructor registers exactly one signaling listener', () => {
    const signaling = createMockSignaling();
    new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());

    expect(signaling.onSignal).toHaveBeenCalledOnce();
    expect(signaling.signalCallbacks).toHaveLength(1);
  });

  it('disconnect() removes the signaling listener', () => {
    const signaling = createMockSignaling();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());

    expect(signaling.signalCallbacks).toHaveLength(1);

    service.disconnect();

    expect(signaling.signalCallbacks).toHaveLength(0);
  });

  it('after disconnect(), signals are not delivered to the service', () => {
    const signaling = createMockSignaling();
    const onError = vi.fn();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), onError);

    service.disconnect();

    // Fire a signal that would normally be handled
    signaling.fireSignal({
      type: 'offer',
      from: 'REMOTE',
      to: 'LOCAL',
      data: { offer: {}, publicKey: 'key' },
    });

    // Service should not process the signal (no error, no state change)
    // The signal simply has no listener to deliver to
    expect(signaling.signalCallbacks).toHaveLength(0);
  });

  it('sessionGeneration increments on disconnect', () => {
    const signaling = createMockSignaling();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());

    const gen0 = (service as any).sessionGeneration;
    service.disconnect();
    const gen1 = (service as any).sessionGeneration;

    expect(gen1).toBe(gen0 + 1);
  });

  it('double disconnect is idempotent and safe', () => {
    const signaling = createMockSignaling();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());

    service.disconnect();
    const gen1 = (service as any).sessionGeneration;

    // Second disconnect should not throw
    expect(() => service.disconnect()).not.toThrow();
    const gen2 = (service as any).sessionGeneration;

    // Generation should still increment (idempotent but not no-op)
    expect(gen2).toBe(gen1 + 1);
    expect(signaling.signalCallbacks).toHaveLength(0);
  });

  it('transfer state maps are cleared on disconnect', () => {
    const signaling = createMockSignaling();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());

    // Inject some transfer state
    (service as any).sendTransferIds.set('file.bin', 'xfer-1');
    (service as any).recvTransferIds.set('file.bin', 'xfer-2');
    (service as any).guardedTransfers.set('xfer-2', { transferId: 'xfer-2' });
    (service as any).receiveBuffers.set('file.bin', [null, null]);
    (service as any).transferPaused = true;
    (service as any).transferCancelled = true;

    service.disconnect();

    expect((service as any).sendTransferIds.size).toBe(0);
    expect((service as any).recvTransferIds.size).toBe(0);
    expect((service as any).guardedTransfers.size).toBe(0);
    expect((service as any).receiveBuffers.size).toBe(0);
    expect((service as any).transferPaused).toBe(false);
    expect((service as any).transferCancelled).toBe(false);
  });

  it('creating a new service after old one is disconnected works cleanly', () => {
    const signaling = createMockSignaling();

    // Service A
    const serviceA = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());
    expect(signaling.signalCallbacks).toHaveLength(1);

    serviceA.disconnect();
    expect(signaling.signalCallbacks).toHaveLength(0);

    // Service B — fresh listener registered
    const serviceB = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());
    expect(signaling.signalCallbacks).toHaveLength(1);

    // Service B is independent — has its own generation
    expect((serviceB as any).sessionGeneration).toBe(0);
    expect((serviceA as any).sessionGeneration).toBe(1);
  });

  it('HELLO/TOFU state reset on disconnect', () => {
    const signaling = createMockSignaling();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());

    // Simulate post-handshake state
    (service as any).helloComplete = true;
    (service as any).sessionState = 'post_hello';
    (service as any).remoteIdentityKey = new Uint8Array(32);
    (service as any).verificationInfo = { state: 'verified', sasCode: 'AABBCC' };

    service.disconnect();

    expect((service as any).helloComplete).toBe(false);
    expect((service as any).sessionState).toBe('closed');
    expect((service as any).remoteIdentityKey).toBeNull();
    expect((service as any).verificationInfo.state).toBe('legacy');
    expect((service as any).verificationInfo.sasCode).toBeNull();
  });
});
