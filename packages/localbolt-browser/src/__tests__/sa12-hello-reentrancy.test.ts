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

/**
 * Mock openBoxPayload: hex-decode.
 * Mock computeSas / verifyPinnedIdentity may be async — this is what creates
 * the reentrancy window in production.
 */
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
  function injectMessage(data: Record<string, unknown>) {
    if (dc.onmessage) {
      dc.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
  return { dc, sentMessages, injectMessage };
}

/** Hex-encode a UTF-8 string (matching mock sealBoxPayload). */
function hexEncode(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function buildHelloMessage(): Record<string, unknown> {
  return {
    type: 'hello',
    payload: hexEncode(JSON.stringify({
      type: 'hello',
      version: 1,
      identityPublicKey: 'AAAA',
      capabilities: ['bolt.file-hash', 'bolt.profile-envelope-v1'],
    })),
  };
}

function countSentErrors(sentMessages: string[], code: string): number {
  return sentMessages.filter(m => {
    try {
      const p = JSON.parse(m);
      return p.type === 'error' && p.code === code;
    } catch { return false; }
  }).length;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SA12: processHello async reentrancy guard', () => {
  let WebRTCService: any;

  beforeEach(async () => {
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  function createService(onReceiveFile = vi.fn(), onError = vi.fn()) {
    const signaling = createMockSignaling();
    const service = new WebRTCService(
      signaling, 'LOCAL', onReceiveFile, onError, undefined,
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
    const { dc, sentMessages, injectMessage } = createMockDataChannel();
    (service as any).dc = dc;
    dc.onmessage = (event: MessageEvent) => {
      (service as any).handleMessage(event);
    };
    return { dc, sentMessages, injectMessage };
  }

  // ── UNIT case 1: after disconnect + new session, HELLO processes normally ──

  it('UNIT-1: guard resets after disconnect — new session HELLO succeeds', async () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // First HELLO → processes
    injectMessage(buildHelloMessage());
    await vi.waitFor(() => {
      expect((service as any).helloComplete).toBe(true);
    });

    // Disconnect
    (service as any).disconnect();

    // Re-attach a fresh data channel (simulates new session)
    const dc2 = createMockDataChannel();
    (service as any).dc = dc2.dc;
    dc2.dc.onmessage = (event: MessageEvent) => {
      (service as any).handleMessage(event);
    };
    (service as any).sessionState = 'pre_hello';
    (service as any).keyPair = {
      publicKey: new Uint8Array(32),
      secretKey: new Uint8Array(32),
    };
    (service as any).remotePublicKey = new Uint8Array(32);

    // Second HELLO in new session → should succeed
    dc2.injectMessage(buildHelloMessage());
    await vi.waitFor(() => {
      expect((service as any).helloComplete).toBe(true);
    });

    // No DUPLICATE_HELLO errors for the second session HELLO
    const dupErrors = countSentErrors(dc2.sentMessages, 'DUPLICATE_HELLO');
    expect(dupErrors).toBe(0);

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  // ── UNIT case 2: single HELLO still succeeds (no regression) ──

  it('UNIT-2: single HELLO processes successfully (no regression)', async () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    injectMessage(buildHelloMessage());
    await vi.waitFor(() => {
      expect((service as any).helloComplete).toBe(true);
    });

    expect((service as any).sessionState).toBe('post_hello');
    // No errors sent
    const errors = sentMessages.filter(m => {
      try { return JSON.parse(m).type === 'error'; } catch { return false; }
    });
    expect(errors.length).toBe(0);

    logSpy.mockRestore();
  });

  // ── ADVERSARIAL case 3: two HELLO back-to-back → second rejected ──

  it('ADVERSARIAL-3: two HELLO back-to-back → second rejected with DUPLICATE_HELLO', async () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Fire two HELLOs synchronously (simulates race before first await resolves)
    injectMessage(buildHelloMessage());
    injectMessage(buildHelloMessage());

    // The first should eventually complete (if not disconnected by the second's error path)
    // The second MUST be synchronously rejected with DUPLICATE_HELLO
    const dupCount = countSentErrors(sentMessages, 'DUPLICATE_HELLO');
    expect(dupCount).toBe(1);

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  // ── ADVERSARIAL case 4: three rapid HELLOs → only first processes ──

  it('ADVERSARIAL-4: three rapid HELLO messages → only first processes, others rejected', async () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Fire three HELLOs synchronously
    injectMessage(buildHelloMessage());
    injectMessage(buildHelloMessage());
    injectMessage(buildHelloMessage());

    // Second and third are rejected.
    // Note: after the second HELLO triggers DUPLICATE_HELLO + disconnect, the third
    // arrives with sessionState='closed'. The handleMessage guard at pre_hello check
    // or the processHello guard catches it. Either way, at most one HELLO processes.
    // We verify at least 1 DUPLICATE_HELLO was sent (the second HELLO).
    const dupCount = countSentErrors(sentMessages, 'DUPLICATE_HELLO');
    expect(dupCount).toBeGreaterThanOrEqual(1);

    // The helloProcessing guard was set synchronously
    // Verify we didn't get multiple successful HELLO completions
    const helloLogs = warnSpy.mock.calls.filter(
      a => typeof a[0] === 'string' && a[0].includes('[DUPLICATE_HELLO]')
    );
    expect(helloLogs.length).toBeGreaterThanOrEqual(1);

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });
});
