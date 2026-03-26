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

function expectSentError(sentMessages: string[], code: string): void {
  const matched = sentMessages.filter(m => {
    try {
      const p = JSON.parse(m);
      return p.type === 'error' && p.code === code;
    } catch { return false; }
  });
  expect(matched.length).toBe(1);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SA9: Legacy plaintext silent drop elimination', () => {
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

  /** Post-HELLO without envelope (legacy plaintext path). */
  function setPostHelloNoEnvelope(service: any) {
    (service as any).sessionState = 'post_hello';
    (service as any).helloComplete = true;
    (service as any).remoteIdentityKey = new Uint8Array(32);
    (service as any).localCapabilities = ['bolt.file-hash'];
    (service as any).negotiatedCapabilities = ['bolt.file-hash'];
  }

  // ── UNIT case 1: valid file-chunk with valid filename → normal flow ──

  it('UNIT-1: valid file-chunk with valid filename processes normally (no disconnect)', () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);
    setPostHelloNoEnvelope(service);

    injectMessage({
      type: 'file-chunk',
      filename: 'test.bin',
      chunk: 'data',
      chunkIndex: 0,
      totalChunks: 1,
      fileSize: 4,
    });

    // No error sent
    const errors = sentMessages.filter(m => {
      try { return JSON.parse(m).type === 'error'; } catch { return false; }
    });
    expect(errors.length).toBe(0);
    // Still connected (keyPair not nulled)
    expect((service as any).keyPair).not.toBe(null);
  });

  // ── UNIT case 2: file-chunk with empty string filename → INVALID_MESSAGE ──

  it('UNIT-2: file-chunk with empty string filename → INVALID_MESSAGE + disconnect', () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);
    setPostHelloNoEnvelope(service);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    injectMessage({
      type: 'file-chunk',
      filename: '',
      chunk: 'data',
      chunkIndex: 0,
      totalChunks: 1,
      fileSize: 4,
    });

    expectSentError(sentMessages, 'INVALID_MESSAGE');
    expect((service as any).keyPair).toBe(null);

    warnSpy.mockRestore();
  });

  // ── UNIT case 3: file-chunk with missing filename → INVALID_MESSAGE ──

  it('UNIT-3: file-chunk with missing filename field → INVALID_MESSAGE + disconnect', () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);
    setPostHelloNoEnvelope(service);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    injectMessage({
      type: 'file-chunk',
      chunk: 'data',
      chunkIndex: 0,
      totalChunks: 1,
      fileSize: 4,
    });

    expectSentError(sentMessages, 'INVALID_MESSAGE');
    expect((service as any).keyPair).toBe(null);

    warnSpy.mockRestore();
  });

  // ── ADVERSARIAL case 4: unknown type → UNKNOWN_MESSAGE_TYPE ──

  it('ADVERSARIAL-4: unknown type → UNKNOWN_MESSAGE_TYPE + disconnect', () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);
    setPostHelloNoEnvelope(service);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    injectMessage({ type: 'evil-payload', data: 'attack' });

    expectSentError(sentMessages, 'UNKNOWN_MESSAGE_TYPE');
    expect((service as any).keyPair).toBe(null);

    warnSpy.mockRestore();
  });

  // ── ADVERSARIAL case 5: missing type field → UNKNOWN_MESSAGE_TYPE ──

  it('ADVERSARIAL-5: missing type field → UNKNOWN_MESSAGE_TYPE + disconnect', () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);
    setPostHelloNoEnvelope(service);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    injectMessage({ data: 'no-type' });

    expectSentError(sentMessages, 'UNKNOWN_MESSAGE_TYPE');
    expect((service as any).keyPair).toBe(null);

    warnSpy.mockRestore();
  });

  // ── ADVERSARIAL case 6: empty string type → UNKNOWN_MESSAGE_TYPE ──

  it('ADVERSARIAL-6: empty string type → UNKNOWN_MESSAGE_TYPE + disconnect', () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);
    setPostHelloNoEnvelope(service);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    injectMessage({ type: '', data: 'empty-type' });

    expectSentError(sentMessages, 'UNKNOWN_MESSAGE_TYPE');
    expect((service as any).keyPair).toBe(null);

    warnSpy.mockRestore();
  });
});
