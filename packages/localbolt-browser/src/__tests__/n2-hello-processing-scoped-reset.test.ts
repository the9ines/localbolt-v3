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
 * controllableComputeSas: returns a promise whose resolution is controlled
 * externally. Used to block processHello mid-flight for reentrancy tests.
 */
let computeSasImpl: (...args: unknown[]) => Promise<string> = async () => 'AABBCC';

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
  computeSas: (...args: unknown[]) => computeSasImpl(...args),
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

describe('N2: helloProcessing scoped reset (try/finally)', () => {
  let WebRTCService: any;

  beforeEach(async () => {
    // Reset computeSas to default (instant resolution)
    computeSasImpl = async () => 'AABBCC';
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

  // ── Test A: Success clears helloProcessing without requiring disconnect() ──

  it('A: success path clears helloProcessing without disconnect', async () => {
    const service = createService();
    attachDataChannel(service);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Directly call processHello — no disconnect involved
    await (service as any).processHello(buildHelloMessage());

    // helloProcessing must be false after successful completion
    expect((service as any).helloProcessing).toBe(false);
    // Session transitioned to post_hello
    expect((service as any).helloComplete).toBe(true);
    expect((service as any).sessionState).toBe('post_hello');

    logSpy.mockRestore();
  });

  // ── Test B: Unexpected throw clears helloProcessing ──

  it('B: unexpected throw inside processHello clears helloProcessing', async () => {
    const service = createService();
    attachDataChannel(service);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Make computeSas throw an unexpected error (after helloProcessing is set true,
    // after all sendErrorAndDisconnect paths, inside the async SAS computation)
    computeSasImpl = async () => { throw new Error('unexpected SAS failure'); };

    let caughtError: Error | null = null;
    try {
      await (service as any).processHello(buildHelloMessage());
    } catch (e) {
      caughtError = e as Error;
    }

    // The error should propagate (not swallowed)
    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe('unexpected SAS failure');

    // CRITICAL: helloProcessing must be false despite the throw
    expect((service as any).helloProcessing).toBe(false);

    logSpy.mockRestore();
  });

  // ── Test C: Reentrancy guard blocks while processHello is in-flight ──

  it('C: reentrancy guard blocks second call while first is in-flight, then resets', async () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create a controllable promise to block processHello mid-flight at computeSas
    let resolveSas!: (value: string) => void;
    const sasPromise = new Promise<string>((resolve) => { resolveSas = resolve; });
    computeSasImpl = async () => sasPromise;

    // Start first processHello — it will block at computeSas
    const firstCall = (service as any).processHello(buildHelloMessage());

    // Allow microtasks to run so processHello reaches the await
    await new Promise(resolve => setTimeout(resolve, 0));

    // helloProcessing must be true (in-flight)
    expect((service as any).helloProcessing).toBe(true);

    // Second call should be rejected by reentrancy guard
    await (service as any).processHello(buildHelloMessage());
    const dupErrors = countSentErrors(sentMessages, 'DUPLICATE_HELLO');
    expect(dupErrors).toBe(1);

    // Release the first call
    resolveSas('AABBCC');
    await firstCall;

    // After first call completes, helloProcessing must be false
    expect((service as any).helloProcessing).toBe(false);
    expect((service as any).helloComplete).toBe(true);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
