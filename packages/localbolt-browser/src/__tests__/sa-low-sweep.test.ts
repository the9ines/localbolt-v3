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

function attachDataChannel(service: any) {
  const { dc, sentMessages } = createMockDataChannel();
  (service as any).dc = dc;
  return { dc, sentMessages };
}

/** Build an encrypted HELLO message (mock: hex-encoded JSON). */
function buildMockHello(capabilities: string[] = ['bolt.profile-envelope-v1']) {
  const inner = JSON.stringify({
    type: 'hello',
    version: 1,
    identityPublicKey: '0'.repeat(64),
    capabilities,
  });
  const bytes = new TextEncoder().encode(inner);
  const payload = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return { type: 'hello', payload };
}

let WebRTCService: any;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SA13: DC handlers nulled before close', () => {
  beforeEach(async () => {
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  it('UNIT: disconnect() nulls DC handlers before calling close()', () => {
    const signaling = createMockSignaling();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());
    const { dc } = attachDataChannel(service);

    // Set up handlers
    dc.onmessage = () => {};
    dc.onopen = () => {};
    dc.onclose = () => {};
    dc.onerror = () => {};

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    service.disconnect();

    // After disconnect, DC handlers must be null (nulled before close)
    expect(dc.onmessage).toBeNull();
    expect(dc.onopen).toBeNull();
    expect(dc.onclose).toBeNull();
    expect(dc.onerror).toBeNull();
    expect(dc.close).toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('UNIT: post-close event does not fire handler', () => {
    const signaling = createMockSignaling();
    const onError = vi.fn();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), onError);
    const { dc } = attachDataChannel(service);

    const messageHandler = vi.fn();
    dc.onmessage = messageHandler;

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    service.disconnect();

    // Simulate a post-close buffered message event
    // Since handlers are nulled, calling dc.onmessage would be null
    expect(dc.onmessage).toBeNull();

    logSpy.mockRestore();
  });
});

describe('SA14: helloTimeout stale callback race', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('UNIT: sessionGeneration increments on disconnect', () => {
    const service = createServiceWithIdentity();
    attachDataChannel(service);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const gen0 = (service as any).sessionGeneration;
    service.disconnect();
    const gen1 = (service as any).sessionGeneration;
    expect(gen1).toBe(gen0 + 1);

    logSpy.mockRestore();
  });

  it('UNIT: stale timeout from session N does not fire into session N+1', () => {
    const onError = vi.fn();
    const service = createServiceWithIdentity(onError);
    attachDataChannel(service);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Session 1: initiate HELLO, arms timeout
    (service as any).initiateHello();
    expect((service as any).helloTimeout).not.toBeNull();

    // Session 1: disconnect before timeout fires
    // (helloTimeout is cleared in disconnect, but the setTimeout callback
    // is already scheduled — the generation guard is the safety net)
    const staleTimeout = (service as any).helloTimeout;
    service.disconnect();

    // Session 2: simulate re-setup (new session)
    (service as any).keyPair = { publicKey: new Uint8Array(32), secretKey: new Uint8Array(32) };
    (service as any).remotePublicKey = new Uint8Array(32);
    (service as any).sessionState = 'pre_hello';
    (service as any).helloComplete = false;

    // Advance time past original timeout — stale callback fires
    vi.advanceTimersByTime(6000);

    // The stale timeout MUST NOT trigger onError or disconnect in session 2
    // (disconnect was called once in session 1, but not again by stale timer)
    // onError should not have been called (stale timer was guarded by generation)
    expect(onError).not.toHaveBeenCalled();

    logSpy.mockRestore();
    errSpy.mockRestore();
  });
});

describe('SA17: Max capabilities length enforcement (transport-web)', () => {
  beforeEach(async () => {
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  it('UNIT: capabilities at max 32 are accepted', async () => {
    const onError = vi.fn();
    const service = createServiceWithIdentity(onError);
    const { dc, sentMessages } = attachDataChannel(service);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Build HELLO with exactly 32 capabilities (include required envelope-v1)
    const caps = ['bolt.profile-envelope-v1', ...Array.from({ length: 31 }, (_, i) => `cap-${i}`)];
    const helloMsg = buildMockHello(caps);

    // Process HELLO
    await (service as any).processHello(helloMsg);

    // Should NOT have disconnected with PROTOCOL_VIOLATION
    const violations = sentMessages.filter(m => m.includes('PROTOCOL_VIOLATION'));
    expect(violations.length).toBe(0);

    // Remote capabilities should be set
    expect((service as any).remoteCapabilities.length).toBe(32);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('UNIT: capabilities exceeding 32 triggers PROTOCOL_VIOLATION + disconnect', async () => {
    const onError = vi.fn();
    const service = createServiceWithIdentity(onError);
    const { dc, sentMessages } = attachDataChannel(service);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Build HELLO with 33 capabilities
    const caps = Array.from({ length: 33 }, (_, i) => `cap-${i}`);
    const helloMsg = buildMockHello(caps);

    await (service as any).processHello(helloMsg);

    // Should have sent PROTOCOL_VIOLATION error
    const violations = sentMessages.filter(m => m.includes('PROTOCOL_VIOLATION'));
    expect(violations.length).toBeGreaterThan(0);

    // Remote capabilities should NOT be stored
    expect((service as any).remoteCapabilities.length).toBe(0);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe('N8: Per-capability string length bound (transport-web)', () => {
  beforeEach(async () => {
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  it('UNIT: capability of 65 bytes triggers PROTOCOL_VIOLATION + disconnect', async () => {
    const onError = vi.fn();
    const service = createServiceWithIdentity(onError);
    const { sentMessages } = attachDataChannel(service);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Build HELLO with required envelope-v1 + one 65-byte ASCII capability
    const longCap = 'a'.repeat(65);
    const helloMsg = buildMockHello(['bolt.profile-envelope-v1', longCap]);

    await (service as any).processHello(helloMsg);

    // Should have sent PROTOCOL_VIOLATION with 'capability too long'
    const violations = sentMessages.filter(m => m.includes('PROTOCOL_VIOLATION'));
    expect(violations.length).toBeGreaterThan(0);
    expect(sentMessages.some(m => m.includes('capability too long'))).toBe(true);

    // helloComplete must remain false
    expect((service as any).helloComplete).toBe(false);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('UNIT: capability of 64 bytes is accepted (no N8 rejection)', async () => {
    const onError = vi.fn();
    const service = createServiceWithIdentity(onError);
    const { sentMessages } = attachDataChannel(service);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Build HELLO with required envelope-v1 + one 64-byte ASCII capability
    const cap64 = 'b'.repeat(64);
    const helloMsg = buildMockHello(['bolt.profile-envelope-v1', cap64]);

    await (service as any).processHello(helloMsg);

    // Should NOT have disconnected with PROTOCOL_VIOLATION for capability length
    const capLenViolations = sentMessages.filter(m => m.includes('capability too long'));
    expect(capLenViolations.length).toBe(0);

    // Remote capabilities should include our 64-byte cap
    expect((service as any).remoteCapabilities).toContain(cap64);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe('SA18: decodeProfileEnvelopeV1 dead code removed', () => {
  beforeEach(async () => {
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  it('UNIT: decodeProfileEnvelopeV1 method does not exist on prototype', () => {
    const signaling = createMockSignaling();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());
    expect((service as any).decodeProfileEnvelopeV1).toBeUndefined();
  });
});
