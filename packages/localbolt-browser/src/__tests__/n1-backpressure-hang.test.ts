// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    send: vi.fn((data: string) => sentMessages.push(data)),
    close: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null,
    onopen: null as (() => void) | null,
    onclose: null as (() => void) | null,
    onerror: null as ((e: Event) => void) | null,
    onbufferedamountlow: null as (() => void) | null,
  };
  return { dc, sentMessages };
}

function createServiceWithDC(onError = vi.fn()) {
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
  const { dc, sentMessages } = createMockDataChannel();
  (service as any).dc = dc;
  return { service, dc, sentMessages, onError };
}

/** Create a minimal mock File with given size. */
function createMockFile(size: number): File {
  const fileData = new Uint8Array(size);
  return {
    name: 'test.bin',
    size,
    slice: (start: number, end: number) => ({
      arrayBuffer: () => Promise.resolve(fileData.slice(start, end).buffer),
    }),
  } as unknown as File;
}

let WebRTCService: any;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('N1: onbufferedamountlow backpressure hang', () => {
  beforeEach(async () => {
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  // ── UNIT: disconnect() nulls onbufferedamountlow ─────────────────────────

  it('UNIT: disconnect() nulls dc.onbufferedamountlow before close', () => {
    const { service, dc } = createServiceWithDC();

    // Set a handler to prove it gets nulled
    dc.onbufferedamountlow = () => {};

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    service.disconnect();

    expect(dc.onbufferedamountlow).toBeNull();
    expect(dc.close).toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('UNIT: disconnect() nulls onbufferedamountlow even when no backpressure pending', () => {
    const { service, dc } = createServiceWithDC();

    // No backpressureReject set — just a raw handler
    dc.onbufferedamountlow = () => {};

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    service.disconnect();

    // Handler nulled, no crash
    expect(dc.onbufferedamountlow).toBeNull();
    expect((service as any).backpressureReject).toBeUndefined();

    logSpy.mockRestore();
  });

  // ── ADVERSARIAL: backpressure wait does not hang on disconnect ───────────

  it('ADVERSARIAL: sendFile settles when disconnect() is called during backpressure wait', async () => {
    const { service, dc } = createServiceWithDC();

    // Mark HELLO complete so sendFile doesn't wait for handshake
    (service as any).helloComplete = true;
    (service as any).sessionState = 'post_hello';

    // Force high bufferedAmount so sendFile enters backpressure wait
    dc.bufferedAmount = 999999;
    dc.bufferedAmountLowThreshold = 0;

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const file = createMockFile(16384); // single chunk

    // Start sendFile — it will enter backpressure wait
    const sendPromise = service.sendFile(file);

    // Yield to let sendFile reach the backpressure await
    await new Promise(r => setTimeout(r, 10));

    // Confirm backpressure wait is pending
    expect((service as any).backpressureReject).toBeDefined();

    // Disconnect while backpressure wait is pending
    service.disconnect();

    // sendFile must settle (reject) — not hang
    await expect(sendPromise).rejects.toThrow(/aborted|disconnected/i);

    // No unhandled rejection — the promise settled via catch
    logSpy.mockRestore();
    warnSpy.mockRestore();
  }, 5000);

  it('ADVERSARIAL: backpressure resolve after disconnect is a no-op (stale session)', async () => {
    const { service, dc } = createServiceWithDC();

    (service as any).helloComplete = true;
    (service as any).sessionState = 'post_hello';

    dc.bufferedAmount = 999999;
    dc.bufferedAmountLowThreshold = 0;

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const file = createMockFile(16384);

    const sendPromise = service.sendFile(file);

    // Yield to let sendFile reach backpressure await
    await new Promise(r => setTimeout(r, 10));

    // Capture the handler before disconnect nulls it
    const handler = dc.onbufferedamountlow;
    expect(handler).not.toBeNull();

    // Disconnect — this settles the promise via reject
    service.disconnect();

    // Calling the old handler after disconnect is safe (no crash, no state corruption)
    // The handler was already nulled by disconnect, but even if somehow called:
    expect(() => {
      if (handler) handler();
    }).not.toThrow();

    await expect(sendPromise).rejects.toThrow(/aborted|disconnected/i);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  }, 5000);

  it('ADVERSARIAL: normal backpressure resolve works when DC is healthy', async () => {
    const { service, dc } = createServiceWithDC();

    (service as any).helloComplete = true;
    (service as any).sessionState = 'post_hello';

    // Start with high buffer
    dc.bufferedAmount = 999999;
    dc.bufferedAmountLowThreshold = 0;

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const file = createMockFile(16384);

    const sendPromise = service.sendFile(file);

    // Yield to let sendFile reach backpressure await
    await new Promise(r => setTimeout(r, 10));

    // Simulate buffer drain — fire the handler
    dc.bufferedAmount = 0;
    const handler = dc.onbufferedamountlow;
    expect(handler).not.toBeNull();
    handler!();

    // sendFile should complete successfully
    await sendPromise;

    logSpy.mockRestore();
  }, 5000);
});
