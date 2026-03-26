// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SignalingProvider } from '../services/signaling/SignalingProvider.js';

// ─── Stub @the9ines/bolt-core ────────────────────────────────────────────────

// Real WIRE_ERROR_CODES and isValidWireErrorCode for validation testing
const WIRE_ERROR_CODES = [
  'VERSION_MISMATCH', 'ENCRYPTION_FAILED', 'INTEGRITY_FAILED', 'REPLAY_DETECTED',
  'TRANSFER_FAILED', 'LIMIT_EXCEEDED', 'CONNECTION_LOST', 'PEER_NOT_FOUND',
  'ALREADY_CONNECTED', 'INVALID_STATE', 'KEY_MISMATCH',
  'DUPLICATE_HELLO', 'ENVELOPE_REQUIRED', 'ENVELOPE_UNNEGOTIATED', 'ENVELOPE_DECRYPT_FAIL',
  'ENVELOPE_INVALID', 'HELLO_PARSE_ERROR', 'HELLO_DECRYPT_FAIL', 'HELLO_SCHEMA_ERROR',
  'INVALID_MESSAGE', 'UNKNOWN_MESSAGE_TYPE', 'PROTOCOL_VIOLATION',
] as const;

function isValidWireErrorCode(x: unknown): boolean {
  return typeof x === 'string' && (WIRE_ERROR_CODES as readonly string[]).includes(x);
}

class MockBoltError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'BoltError';
    this.details = details;
  }
}

let mockOpenThrow = false;

vi.mock('@the9ines/bolt-core', () => ({
  sealBoxPayload: (data: Uint8Array) => {
    return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  openBoxPayload: (sealed: string) => {
    if (mockOpenThrow) throw new Error('Decryption failed');
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
  WIRE_ERROR_CODES,
  isValidWireErrorCode,
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

function hexEncode(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function buildEnvelope(innerMsg: Record<string, unknown>): Record<string, unknown> {
  const payload = hexEncode(JSON.stringify(innerMsg));
  return { type: 'profile-envelope', version: 1, encoding: 'base64', payload };
}

function hexDecode(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

/** Check that a PROTOCOL_VIOLATION error was sent (plaintext or enveloped). */
function expectProtocolViolation(sentMessages: string[], service: any) {
  const violations = sentMessages.filter(m => {
    try {
      const p = JSON.parse(m);
      if (p.type === 'error' && p.code === 'PROTOCOL_VIOLATION') return true;
      if (p.type === 'profile-envelope' && p.payload) {
        const inner = JSON.parse(hexDecode(p.payload));
        return inner.type === 'error' && inner.code === 'PROTOCOL_VIOLATION';
      }
      return false;
    } catch { return false; }
  });
  expect(violations.length).toBe(1);
  expect((service as any).keyPair).toBe(null);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PROTO-HARDEN-2A: Inbound Error Code Validation', () => {
  let WebRTCService: any;

  beforeEach(async () => {
    mockOpenThrow = false;
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  function createService(onError = vi.fn()) {
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
    const { dc, sentMessages, injectMessage } = createMockDataChannel();
    (service as any).dc = dc;
    dc.onmessage = (event: MessageEvent) => {
      (service as any).handleMessage(event);
    };
    return { dc, sentMessages, injectMessage };
  }

  function completeHandshake(service: any) {
    (service as any).sessionState = 'active';
    (service as any).helloComplete = true;
    (service as any).negotiatedCapabilities = ['bolt.profile-envelope-v1'];
  }

  // ─── Enveloped inbound error validation ──────────────────────────────────

  describe('enveloped error (post-handshake)', () => {
    it('rejects error with missing code → PROTOCOL_VIOLATION + disconnect', () => {
      const service = createService();
      const { sentMessages, injectMessage } = attachDataChannel(service);
      completeHandshake(service);

      injectMessage(buildEnvelope({ type: 'error', message: 'something bad' }));
      expectProtocolViolation(sentMessages, service);
    });

    it('rejects error with non-string code → PROTOCOL_VIOLATION + disconnect', () => {
      const service = createService();
      const { sentMessages, injectMessage } = attachDataChannel(service);
      completeHandshake(service);

      injectMessage(buildEnvelope({ type: 'error', code: 42, message: 'bad' }));
      expectProtocolViolation(sentMessages, service);
    });

    it('rejects error with empty code → PROTOCOL_VIOLATION + disconnect', () => {
      const service = createService();
      const { sentMessages, injectMessage } = attachDataChannel(service);
      completeHandshake(service);

      injectMessage(buildEnvelope({ type: 'error', code: '', message: 'bad' }));
      expectProtocolViolation(sentMessages, service);
    });

    it('rejects error with unknown code → PROTOCOL_VIOLATION + disconnect', () => {
      const service = createService();
      const { sentMessages, injectMessage } = attachDataChannel(service);
      completeHandshake(service);

      injectMessage(buildEnvelope({ type: 'error', code: 'NOT_A_REAL_CODE', message: 'bad' }));
      expectProtocolViolation(sentMessages, service);
    });

    it('rejects error with non-string message → PROTOCOL_VIOLATION + disconnect', () => {
      const service = createService();
      const { sentMessages, injectMessage } = attachDataChannel(service);
      completeHandshake(service);

      injectMessage(buildEnvelope({ type: 'error', code: 'INVALID_STATE', message: 123 }));
      expectProtocolViolation(sentMessages, service);
    });

    it('accepts valid error with code + string message', () => {
      const onError = vi.fn();
      const service = createService(onError);
      const { sentMessages, injectMessage } = attachDataChannel(service);
      completeHandshake(service);

      injectMessage(buildEnvelope({ type: 'error', code: 'INVALID_STATE', message: 'wrong state' }));
      // Should NOT send PROTOCOL_VIOLATION — should accept and disconnect gracefully
      const violations = sentMessages.filter(m => {
        try {
          const p = JSON.parse(m);
          if (p.type === 'error' && p.code === 'PROTOCOL_VIOLATION') return true;
          if (p.type === 'profile-envelope' && p.payload) {
            const inner = JSON.parse(hexDecode(p.payload));
            return inner.type === 'error' && inner.code === 'PROTOCOL_VIOLATION';
          }
          return false;
        } catch { return false; }
      });
      expect(violations.length).toBe(0);
      expect(onError).toHaveBeenCalled();
      // Disconnected
      expect((service as any).keyPair).toBe(null);
    });

    it('accepts valid error with code only (no message)', () => {
      const onError = vi.fn();
      const service = createService(onError);
      const { sentMessages, injectMessage } = attachDataChannel(service);
      completeHandshake(service);

      injectMessage(buildEnvelope({ type: 'error', code: 'ENCRYPTION_FAILED' }));
      const violations = sentMessages.filter(m => {
        try {
          const p = JSON.parse(m);
          if (p.type === 'error' && p.code === 'PROTOCOL_VIOLATION') return true;
          if (p.type === 'profile-envelope' && p.payload) {
            const inner = JSON.parse(hexDecode(p.payload));
            return inner.type === 'error' && inner.code === 'PROTOCOL_VIOLATION';
          }
          return false;
        } catch { return false; }
      });
      expect(violations.length).toBe(0);
      expect(onError).toHaveBeenCalled();
    });
  });

  // ─── Plaintext inbound error validation ──────────────────────────────────

  describe('plaintext error (pre-envelope)', () => {
    it('rejects plaintext error with unknown code → PROTOCOL_VIOLATION', () => {
      const service = createService();
      const { sentMessages, injectMessage } = attachDataChannel(service);
      // No envelope negotiated — plaintext path
      (service as any).sessionState = 'active';
      (service as any).helloComplete = true;

      injectMessage({ type: 'error', code: 'FAKE_CODE', message: 'bad' });
      const violations = sentMessages.filter(m => {
        try { return JSON.parse(m).code === 'PROTOCOL_VIOLATION'; } catch { return false; }
      });
      expect(violations.length).toBe(1);
      expect((service as any).keyPair).toBe(null);
    });

    it('accepts plaintext error with valid code', () => {
      const onError = vi.fn();
      const service = createService(onError);
      const { sentMessages, injectMessage } = attachDataChannel(service);
      (service as any).sessionState = 'active';
      (service as any).helloComplete = true;

      injectMessage({ type: 'error', code: 'VERSION_MISMATCH', message: 'no common version' });
      const violations = sentMessages.filter(m => {
        try { return JSON.parse(m).code === 'PROTOCOL_VIOLATION'; } catch { return false; }
      });
      expect(violations.length).toBe(0);
      expect(onError).toHaveBeenCalled();
    });
  });

  // ─── Outbound guard ────────────────────────────────────────────────────

  describe('outbound guard', () => {
    it('sendErrorAndDisconnect refuses non-canonical code', () => {
      const service = createService();
      const { sentMessages } = attachDataChannel(service);
      // Directly invoke the private method with a non-canonical code
      (service as any).sendErrorAndDisconnect('BOGUS_CODE', 'should not be sent');
      // No error message should have been sent
      expect(sentMessages.length).toBe(0);
      // But should still disconnect
      expect((service as any).keyPair).toBe(null);
    });

    it('sendErrorAndDisconnect allows canonical code', () => {
      const service = createService();
      const { sentMessages } = attachDataChannel(service);
      (service as any).sendErrorAndDisconnect('INVALID_STATE', 'test');
      // Should have sent exactly one error
      expect(sentMessages.length).toBe(1);
      const sent = JSON.parse(sentMessages[0]);
      expect(sent.code).toBe('INVALID_STATE');
    });
  });
});
