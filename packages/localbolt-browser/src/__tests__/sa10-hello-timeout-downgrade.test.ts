// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SignalingProvider } from '../services/signaling/SignalingProvider.js';

// ─── Stub @the9ines/bolt-core ────────────────────────────────────────────────

class MockBoltError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'BoltError';
    this.details = details;
  }
}

vi.mock('@the9ines/bolt-core', () => ({
  sealBoxPayload: (data: Uint8Array) => {
    return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  openBoxPayload: (sealed: string) => {
    const bytes = new Uint8Array(sealed.length / 2);
    for (let i = 0; i < sealed.length; i += 2) {
      bytes[i / 2] = parseInt(sealed.substring(i, i + 2), 16);
    }
    return bytes;
  },
  generateEphemeralKeyPair: () => ({
    publicKey: new Uint8Array(32),
    secretKey: new Uint8Array(32),
  }),
  generateIdentityKeyPair: () => ({
    publicKey: new Uint8Array(32),
    secretKey: new Uint8Array(64),
  }),
  toBase64: (arr: Uint8Array) =>
    Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(''),
  fromBase64: () => new Uint8Array(32),
  DEFAULT_CHUNK_SIZE: 16384,
  BoltError: MockBoltError,
  EncryptionError: class extends MockBoltError {
    constructor(m: string, d?: unknown) { super(m, d); this.name = 'EncryptionError'; }
  },
  ConnectionError: class extends MockBoltError {
    constructor(m: string, d?: unknown) { super(m, d); this.name = 'ConnectionError'; }
  },
  TransferError: class extends MockBoltError {
    constructor(m: string, d?: unknown) { super(m, d); this.name = 'TransferError'; }
  },
  IntegrityError: class extends MockBoltError {
    constructor(m: string = 'File integrity check failed') { super(m); this.name = 'IntegrityError'; }
  },
  KeyMismatchError: class extends MockBoltError {
    constructor(m: string, d?: unknown) { super(m, d); this.name = 'KeyMismatchError'; }
  },
  computeSas: () => 'AABBCC',
  bufferToHex: (buffer: ArrayBuffer) =>
    Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''),
  hashFile: async () => 'a'.repeat(64),
  WIRE_ERROR_CODES: [
    'VERSION_MISMATCH', 'ENCRYPTION_FAILED', 'INTEGRITY_FAILED', 'REPLAY_DETECTED',
    'TRANSFER_FAILED', 'LIMIT_EXCEEDED', 'CONNECTION_LOST', 'PEER_NOT_FOUND',
    'ALREADY_CONNECTED', 'INVALID_STATE', 'KEY_MISMATCH',
    'DUPLICATE_HELLO', 'ENVELOPE_REQUIRED', 'ENVELOPE_UNNEGOTIATED', 'ENVELOPE_DECRYPT_FAIL',
    'ENVELOPE_INVALID', 'HELLO_PARSE_ERROR', 'HELLO_DECRYPT_FAIL', 'HELLO_SCHEMA_ERROR',
    'INVALID_MESSAGE', 'UNKNOWN_MESSAGE_TYPE', 'PROTOCOL_VIOLATION',
  ],
  isValidWireErrorCode: (x: unknown) =>
    typeof x === 'string' && [
      'VERSION_MISMATCH', 'ENCRYPTION_FAILED', 'INTEGRITY_FAILED', 'REPLAY_DETECTED',
      'TRANSFER_FAILED', 'LIMIT_EXCEEDED', 'CONNECTION_LOST', 'PEER_NOT_FOUND',
      'ALREADY_CONNECTED', 'INVALID_STATE', 'KEY_MISMATCH',
      'DUPLICATE_HELLO', 'ENVELOPE_REQUIRED', 'ENVELOPE_UNNEGOTIATED', 'ENVELOPE_DECRYPT_FAIL',
      'ENVELOPE_INVALID', 'HELLO_PARSE_ERROR', 'HELLO_DECRYPT_FAIL', 'HELLO_SCHEMA_ERROR',
      'INVALID_MESSAGE', 'UNKNOWN_MESSAGE_TYPE', 'PROTOCOL_VIOLATION',
    ].includes(x as string),
  negotiateBtr: () => 'STATIC_EPHEMERAL',
  btrLogToken: () => null,
  BtrMode: { FullBtr: 'FULL_BTR', Downgrade: 'DOWNGRADE', StaticEphemeral: 'STATIC_EPHEMERAL', Reject: 'REJECT' },
  scalarMult: () => new Uint8Array(32),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function createMockDataChannel() {
  const sentMessages: string[] = [];
  const dc = {
    readyState: 'open',
    bufferedAmount: 0,
    bufferedAmountLowThreshold: 0,
    binaryType: 'arraybuffer',
    send: (data: string) => sentMessages.push(data),
    close: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null,
    onopen: null as (() => void) | null,
    onclose: null as (() => void) | null,
    onerror: null as ((e: Event) => void) | null,
    onbufferedamountlow: null as (() => void) | null,
  };
  return { dc, sentMessages };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SA10: Fail-closed on HELLO timeout (no downgrade)', () => {
  let WebRTCService: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Create service WITH identity configured (HELLO expected). */
  function createServiceWithIdentity(onError = vi.fn()) {
    const signaling = createMockSignaling();
    const service = new WebRTCService(
      signaling, 'LOCAL', vi.fn(), onError, undefined,
      { identityPublicKey: new Uint8Array(32) },
    );
    (service as any).remotePublicKey = new Uint8Array(32);
    (service as any).keyPair = {
      publicKey: new Uint8Array(32),
      secretKey: new Uint8Array(32),
    };
    return service;
  }

  /** Create service WITHOUT identity configured (legacy mode). */
  function createServiceWithoutIdentity(onError = vi.fn()) {
    const signaling = createMockSignaling();
    const service = new WebRTCService(
      signaling, 'LOCAL', vi.fn(), onError, undefined,
      {},
    );
    (service as any).remotePublicKey = new Uint8Array(32);
    (service as any).keyPair = {
      publicKey: new Uint8Array(32),
      secretKey: new Uint8Array(32),
    };
    return service;
  }

  function attachDataChannel(service: any) {
    const { dc, sentMessages } = createMockDataChannel();
    (service as any).dc = dc;
    return { dc, sentMessages };
  }

  // ── ADVERSARIAL A: identity configured, HELLO suppressed → fail-closed ──

  it('ADVERSARIAL-A: identity configured, HELLO suppressed → disconnect + onError, no legacy', () => {
    const onError = vi.fn();
    const service = createServiceWithIdentity(onError);
    attachDataChannel(service);

    const disconnectSpy = vi.spyOn(service as any, 'disconnect');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Trigger HELLO flow — arms timeout
    (service as any).initiateHello();

    // Confirm timeout is armed
    expect((service as any).helloTimeout).not.toBeNull();
    // HELLO not delivered — advance past timeout
    vi.advanceTimersByTime(5000);

    // Fail-closed: disconnect called
    expect(disconnectSpy).toHaveBeenCalled();

    // onError surfaced with HELLO timeout message
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toMatch(/HELLO handshake timed out/i);

    // MUST NOT enter legacy mode
    expect((service as any).sessionLegacy).toBe(false);

    errSpy.mockRestore();
    logSpy.mockRestore();
  });

  // ── ADVERSARIAL B: partial signaling without HELLO completion → fail-closed ──

  it('ADVERSARIAL-B: partial signaling activity without HELLO completion → fail-closed', () => {
    const onError = vi.fn();
    const service = createServiceWithIdentity(onError);
    const { dc } = attachDataChannel(service);

    const disconnectSpy = vi.spyOn(service as any, 'disconnect');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Trigger HELLO flow — arms timeout
    (service as any).initiateHello();

    // Simulate partial activity (non-HELLO messages arrive — e.g., signaling noise)
    // but helloComplete stays false. Advance partway:
    vi.advanceTimersByTime(2000);
    expect((service as any).helloComplete).toBe(false);
    expect(disconnectSpy).not.toHaveBeenCalled();

    // Advance past the full timeout
    vi.advanceTimersByTime(3000);

    // Fail-closed
    expect(disconnectSpy).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toMatch(/HELLO handshake timed out/i);

    // No legacy mode
    expect((service as any).sessionLegacy).toBe(false);

    errSpy.mockRestore();
    logSpy.mockRestore();
  });

  // ── UNIT C: no identity configured → immediate legacy, no timeout armed ──

  it('UNIT-C: no identity configured → immediate legacy mode, no timeout armed', () => {
    const onError = vi.fn();
    const service = createServiceWithoutIdentity(onError);
    attachDataChannel(service);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Trigger HELLO flow — should take legacy early-return path
    (service as any).initiateHello();

    // Legacy mode entered immediately
    expect((service as any).sessionLegacy).toBe(true);
    expect((service as any).helloComplete).toBe(true);
    expect((service as any).sessionState).toBe('post_hello');

    // Timeout MUST NOT be armed
    expect((service as any).helloTimeout).toBeNull();

    // No error surfaced
    expect(onError).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
