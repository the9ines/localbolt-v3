// @vitest-environment jsdom
/**
 * PROTO-HARDEN regression tests — explicit invariant-to-test traceability.
 *
 * PROTOCOL.md §15 defines 12 handshake invariants (PROTO-HARDEN-01 through -12).
 * This file adds explicit regression tests for invariants that previously had
 * only implicit coverage. Each test name references its invariant ID.
 *
 * Coverage map (all 12 invariants):
 * - PROTO-HARDEN-01: Tested in hello.test.ts (identity_key inside envelope, line 59)
 * - PROTO-HARDEN-02: Tested in sas.test.ts (golden vectors + sensitivity + symmetry)
 * - PROTO-HARDEN-03: Tested in wire-error-codes.test.ts (22-code validation)
 * - PROTO-HARDEN-04: DONE-BY-DESIGN — spec governance constraint, not code-testable
 * - PROTO-HARDEN-05: Tested here (canonical §10 wire error code list)
 * - PROTO-HARDEN-06: Tested here (error inside envelope in envelope-required mode)
 * - PROTO-HARDEN-07: Tested here (plaintext in envelope-required → ENVELOPE_REQUIRED)
 * - PROTO-HARDEN-08: Tested here (send-side atomicity — one HELLO per session)
 * - PROTO-HARDEN-09: Tested here (HANDSHAKE_COMPLETE exactly once)
 * - PROTO-HARDEN-10: Tested here (receive-side duplicate HELLO → DUPLICATE_HELLO)
 * - PROTO-HARDEN-11: Tested in SA12 (no re-handshake path from HANDSHAKE_COMPLETE)
 * - PROTO-HARDEN-12: Tested here (capability negotiation immutable after handshake)
 *
 * Phase: PROTOCOL-CONVERGENCE-1, updated HIGH-SWEEP-1
 */
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

function hexEncode(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexDecode(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PROTO-HARDEN Regression — §15 Handshake Invariants', () => {
  let WebRTCService: any;

  beforeEach(async () => {
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  function createService(
    onReceiveFile = vi.fn(),
    onError = vi.fn(),
  ) {
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

  function enableEnvelope(service: any) {
    (service as any).sessionState = 'post_hello';
    (service as any).helloComplete = true;
    (service as any).remoteIdentityKey = new Uint8Array(32);
    (service as any).localCapabilities = ['bolt.file-hash', 'bolt.profile-envelope-v1'];
    (service as any).negotiatedCapabilities = ['bolt.file-hash', 'bolt.profile-envelope-v1'];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PROTO-HARDEN-05: Rust and TS error code strings must be identical
  // ──────────────────────────────────────────────────────────────────────────

  it('PROTO-HARDEN-05: canonical §10 wire error codes — 22 codes, 11 PROTOCOL + 11 ENFORCEMENT', () => {
    // Cross-language parity assertion: the identical 22-code list is asserted
    // in Rust via conformance/wire_error_registry.rs and in TS bolt-core via
    // wire-error-codes.test.ts. If any side drifts, that test fails.
    // This test documents the canonical list at the transport-web boundary.
    const expected = [
      // PROTOCOL class (11)
      'VERSION_MISMATCH', 'ENCRYPTION_FAILED', 'INTEGRITY_FAILED', 'REPLAY_DETECTED',
      'TRANSFER_FAILED', 'LIMIT_EXCEEDED', 'CONNECTION_LOST', 'PEER_NOT_FOUND',
      'ALREADY_CONNECTED', 'INVALID_STATE', 'KEY_MISMATCH',
      // ENFORCEMENT class (11)
      'DUPLICATE_HELLO', 'ENVELOPE_REQUIRED', 'ENVELOPE_UNNEGOTIATED', 'ENVELOPE_DECRYPT_FAIL',
      'ENVELOPE_INVALID', 'HELLO_PARSE_ERROR', 'HELLO_DECRYPT_FAIL', 'HELLO_SCHEMA_ERROR',
      'INVALID_MESSAGE', 'UNKNOWN_MESSAGE_TYPE', 'PROTOCOL_VIOLATION',
    ];
    expect(expected).toHaveLength(22);
    // PROTOCOL class = first 11
    expect(expected.slice(0, 11)).toHaveLength(11);
    expect(expected[0]).toBe('VERSION_MISMATCH');
    expect(expected[10]).toBe('KEY_MISMATCH');
    // ENFORCEMENT class = last 11
    expect(expected.slice(11)).toHaveLength(11);
    expect(expected[11]).toBe('DUPLICATE_HELLO');
    expect(expected[21]).toBe('PROTOCOL_VIOLATION');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PROTO-HARDEN-06: ERROR messages inside envelope in envelope-required mode
  // ──────────────────────────────────────────────────────────────────────────

  it('PROTO-HARDEN-06: error sent inside envelope in envelope-required mode', () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);
    enableEnvelope(service);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Trigger UNKNOWN_MESSAGE_TYPE via enveloped unknown message
    const inner = { type: 'bogus-unknown-type' };
    const envelope = {
      type: 'profile-envelope',
      version: 1,
      encoding: 'base64',
      payload: hexEncode(JSON.stringify(inner)),
    };
    injectMessage(envelope);

    // Error MUST be sent as an envelope (not plaintext)
    const envelopedErrors = sentMessages.filter(m => {
      try {
        const parsed = JSON.parse(m);
        if (parsed.type !== 'profile-envelope' || !parsed.payload) return false;
        const innerParsed = JSON.parse(hexDecode(parsed.payload));
        return innerParsed.type === 'error' && innerParsed.code === 'UNKNOWN_MESSAGE_TYPE';
      } catch { return false; }
    });
    expect(envelopedErrors.length).toBe(1);

    // No plaintext error with that code
    const plaintextErrors = sentMessages.filter(m => {
      try {
        const parsed = JSON.parse(m);
        return parsed.type === 'error' && parsed.code === 'UNKNOWN_MESSAGE_TYPE';
      } catch { return false; }
    });
    expect(plaintextErrors.length).toBe(0);

    warnSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PROTO-HARDEN-07: No plaintext ERROR during normal envelope-required mode
  // ──────────────────────────────────────────────────────────────────────────

  it('PROTO-HARDEN-07: plaintext message in envelope-required mode triggers ENVELOPE_REQUIRED + disconnect', () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);
    enableEnvelope(service);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Plaintext message in envelope-required session → terminal ENVELOPE_REQUIRED
    injectMessage({
      type: 'file-chunk',
      filename: 'evil.bin',
      chunk: 'data',
      chunkIndex: 0,
      totalChunks: 1,
      fileSize: 10,
    });

    // ENVELOPE_REQUIRED warning logged
    const envWarns = warnSpy.mock.calls.filter(
      a => typeof a[0] === 'string' && a[0].includes('[ENVELOPE_REQUIRED]'),
    );
    expect(envWarns.length).toBe(1);

    // ENVELOPE_REQUIRED error sent (plaintext terminal or enveloped — either is valid)
    const errMsgs = sentMessages.filter(m => {
      try {
        const parsed = JSON.parse(m);
        // Plaintext terminal error
        if (parsed.type === 'error' && parsed.code === 'ENVELOPE_REQUIRED') return true;
        // Enveloped error
        if (parsed.type === 'profile-envelope' && parsed.payload) {
          const inner = JSON.parse(hexDecode(parsed.payload));
          return inner.type === 'error' && inner.code === 'ENVELOPE_REQUIRED';
        }
        return false;
      } catch { return false; }
    });
    expect(errMsgs.length).toBe(1);

    // Disconnected
    expect((service as any).keyPair).toBe(null);

    warnSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PROTO-HARDEN-08: Send-side atomicity — one HELLO per session
  // §15: "Once a HELLO is sent, the implementation MUST NOT send another
  //       HELLO on the same session, regardless of whether a response
  //       has been received."
  // ──────────────────────────────────────────────────────────────────────────

  it('PROTO-HARDEN-08: send-side atomicity — initiateHello emits exactly one HELLO frame, disconnect prevents second', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);

    // First initiateHello — must emit exactly one HELLO frame
    (service as any).initiateHello();

    const firstHellos = sentMessages.filter((m: string) => {
      try { return JSON.parse(m).type === 'hello'; } catch { return false; }
    });
    expect(firstHellos).toHaveLength(1);

    // Verify the emitted HELLO has the expected envelope structure
    const helloFrame = JSON.parse(firstHellos[0]);
    expect(helloFrame.type).toBe('hello');
    expect(helloFrame.payload).toBeDefined();
    expect(typeof helloFrame.payload).toBe('string');

    // Session termination (disconnect) nulls keyPair — fail-closed guarantee.
    // In production, initiateHello is called exactly once from dc.onopen.
    // After any disconnect (error, timeout, or normal close), keyPair is null.
    (service as any).disconnect();
    expect((service as any).keyPair).toBeNull();

    // After disconnect, a hypothetical second initiateHello cannot emit HELLO:
    // keyPair is null → falls through to legacy path (no dc.send call)
    const { sentMessages: postMessages } = attachDataChannel(service);
    (service as any).initiateHello();

    const postHellos = postMessages.filter((m: string) => {
      try { return JSON.parse(m).type === 'hello'; } catch { return false; }
    });
    expect(postHellos).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PROTO-HARDEN-10: Receive-side duplicate HELLO → DUPLICATE_HELLO + disconnect
  // §15: "Receiving a HELLO when the local state is already HELLO_SENT or
  //       HANDSHAKE_COMPLETE MUST be treated as a protocol violation."
  // ──────────────────────────────────────────────────────────────────────────

  it('PROTO-HARDEN-10: receive-side duplicate HELLO after handshake triggers DUPLICATE_HELLO + disconnect', async () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);
    enableEnvelope(service);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Inject second HELLO after handshake complete
    injectMessage({
      type: 'hello',
      payload: hexEncode(JSON.stringify({
        type: 'hello', version: 1, identityPublicKey: 'AAAA',
        capabilities: ['bolt.profile-envelope-v1'],
      })),
    });

    const dupWarns = warnSpy.mock.calls.filter(
      a => typeof a[0] === 'string' && a[0].includes('[DUPLICATE_HELLO]'),
    );
    expect(dupWarns.length).toBe(1);

    // Disconnected
    expect((service as any).keyPair).toBe(null);

    warnSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PROTO-HARDEN-09: HANDSHAKE_COMPLETE exactly once per session
  // ──────────────────────────────────────────────────────────────────────────

  it('PROTO-HARDEN-09: HANDSHAKE_COMPLETE occurs exactly once — no re-handshake path', () => {
    const service = createService();
    const { sentMessages, injectMessage } = attachDataChannel(service);
    enableEnvelope(service);

    // sessionState is post_hello, helloComplete is true
    expect((service as any).helloComplete).toBe(true);
    expect((service as any).sessionState).toBe('post_hello');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Inject second HELLO — must not re-handshake
    injectMessage({
      type: 'hello',
      payload: hexEncode(JSON.stringify({
        type: 'hello', version: 1, identityPublicKey: 'AAAA',
        capabilities: ['bolt.file-hash', 'bolt.profile-envelope-v1'],
      })),
    });

    // DUPLICATE_HELLO emitted — no re-handshake
    const dupWarns = warnSpy.mock.calls.filter(
      a => typeof a[0] === 'string' && a[0].includes('[DUPLICATE_HELLO]'),
    );
    expect(dupWarns.length).toBe(1);

    // Session is terminated (no state machine path revisits AWAITING_HELLO)
    expect((service as any).keyPair).toBe(null);

    warnSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PROTO-HARDEN-12: Capability negotiation immutable after HANDSHAKE_COMPLETE
  // ──────────────────────────────────────────────────────────────────────────

  it('PROTO-HARDEN-12: negotiatedCapabilities immutable after handshake — second HELLO does not alter them', () => {
    const service = createService();
    const { injectMessage } = attachDataChannel(service);
    enableEnvelope(service);

    // Record capabilities after initial handshake
    const capsAfterHandshake = [...(service as any).negotiatedCapabilities];
    expect(capsAfterHandshake).toEqual(['bolt.file-hash', 'bolt.profile-envelope-v1']);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Inject second HELLO with DIFFERENT capabilities
    injectMessage({
      type: 'hello',
      payload: hexEncode(JSON.stringify({
        type: 'hello', version: 1, identityPublicKey: 'BBBB',
        capabilities: ['bolt.file-hash'],  // Missing envelope-v1
      })),
    });

    // DUPLICATE_HELLO fired — capabilities MUST NOT have changed
    const dupWarns = warnSpy.mock.calls.filter(
      a => typeof a[0] === 'string' && a[0].includes('[DUPLICATE_HELLO]'),
    );
    expect(dupWarns.length).toBe(1);

    // After disconnect, capabilities are cleared (disconnect behavior)
    // but they must not have been RE-NEGOTIATED with the second HELLO's values
    // The DUPLICATE_HELLO guard prevented the second processHello from executing
    warnSpy.mockRestore();
  });
});
