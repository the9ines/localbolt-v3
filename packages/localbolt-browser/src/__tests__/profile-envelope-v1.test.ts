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
 * Mock sealBoxPayload/openBoxPayload: deterministic round-trip.
 * sealBoxPayload returns a JSON string wrapping the plaintext hex.
 * openBoxPayload reverses it.
 * This allows tests to verify that dcSendMessage correctly wraps
 * inner messages in an envelope whose payload decrypts to the inner JSON.
 */
let mockSealThrow = false;
let mockOpenThrow = false;

vi.mock('@the9ines/bolt-core', () => ({
  sealBoxPayload: (data: Uint8Array) => {
    if (mockSealThrow) throw new Error('seal failed');
    // Encode plaintext bytes as hex — simulates base64 output from real sealBoxPayload
    return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  openBoxPayload: (sealed: string) => {
    if (mockOpenThrow) throw new Error('Decryption failed');
    // Reverse: hex string → Uint8Array
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

/**
 * Build a valid profile-envelope by encrypting an inner message.
 * Uses the same mock sealBoxPayload (hex-encodes UTF-8 bytes).
 */
function buildEnvelope(innerMsg: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(innerMsg);
  const bytes = new TextEncoder().encode(json);
  const payload = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return { type: 'profile-envelope', version: 1, encoding: 'base64', payload };
}

function makeChunkMsg(overrides: Record<string, unknown> = {}) {
  return {
    type: 'file-chunk',
    filename: 'test.bin',
    chunk: `chunk-data-${overrides.chunkIndex ?? 0}`,
    chunkIndex: 0,
    totalChunks: 3,
    fileSize: 48,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Phase M1: Profile Envelope v1', () => {
  let WebRTCService: any;

  beforeEach(async () => {
    mockSealThrow = false;
    mockOpenThrow = false;
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  function createService(
    onReceiveFile = vi.fn(),
    onError = vi.fn(),
    onProgress?: (p: any) => void,
    options?: any,
  ) {
    const signaling = createMockSignaling();
    const service = new WebRTCService(
      signaling, 'LOCAL', onReceiveFile, onError, onProgress,
      options ?? { identityPublicKey: new Uint8Array(32) },
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

  /** Enable envelope negotiation: helloComplete + both capabilities negotiated. */
  function enableEnvelope(service: any) {
    (service as any).sessionState = 'post_hello';
    (service as any).helloComplete = true;
    (service as any).remoteIdentityKey = new Uint8Array(32);
    (service as any).localCapabilities = ['bolt.file-hash', 'bolt.profile-envelope-v1'];
    (service as any).negotiatedCapabilities = ['bolt.file-hash', 'bolt.profile-envelope-v1'];
  }

  /** HELLO complete but envelope NOT negotiated (remote doesn't support it). */
  function disableEnvelope(service: any) {
    (service as any).sessionState = 'post_hello';
    (service as any).helloComplete = true;
    (service as any).remoteIdentityKey = new Uint8Array(32);
    (service as any).localCapabilities = ['bolt.file-hash', 'bolt.profile-envelope-v1'];
    (service as any).negotiatedCapabilities = ['bolt.file-hash'];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Negotiation
  // ──────────────────────────────────────────────────────────────────────────

  describe('Negotiation', () => {
    it('1. both peers advertise → sender wraps file-chunk in profile-envelope', async () => {
      const service = createService();
      const { sentMessages } = attachDataChannel(service);
      enableEnvelope(service);

      const file = {
        name: 'envelope-test.bin',
        size: 100,
        slice: (start: number, end: number) => ({
          arrayBuffer: () => Promise.resolve(new Uint8Array(end - start).buffer),
        }),
      } as unknown as File;

      await service.sendFile(file);

      // All sent messages should be profile-envelope
      expect(sentMessages.length).toBeGreaterThan(0);
      for (const raw of sentMessages) {
        const parsed = JSON.parse(raw);
        expect(parsed.type).toBe('profile-envelope');
        expect(parsed.version).toBe(1);
        expect(parsed.encoding).toBe('base64');
        expect(typeof parsed.payload).toBe('string');
      }

      service.disconnect();
    });

    it('2. remote does not advertise → sender sends legacy plaintext', async () => {
      const service = createService();
      const { sentMessages } = attachDataChannel(service);
      disableEnvelope(service);

      const file = {
        name: 'legacy-test.bin',
        size: 100,
        slice: (start: number, end: number) => ({
          arrayBuffer: () => Promise.resolve(new Uint8Array(end - start).buffer),
        }),
      } as unknown as File;

      await service.sendFile(file);

      expect(sentMessages.length).toBeGreaterThan(0);
      for (const raw of sentMessages) {
        const parsed = JSON.parse(raw);
        expect(parsed.type).toBe('file-chunk');
        expect(parsed.filename).toBe('legacy-test.bin');
      }

      service.disconnect();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Handshake gating
  // ──────────────────────────────────────────────────────────────────────────

  describe('Handshake gating', () => {
    it('3. profile-envelope before helloComplete → INVALID_STATE + disconnect', () => {
      const onError = vi.fn();
      const service = createService(vi.fn(), onError);
      const { sentMessages, injectMessage } = attachDataChannel(service);
      // helloComplete is false by default

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      injectMessage({
        type: 'profile-envelope',
        version: 1,
        encoding: 'base64',
        payload: 'some-payload',
      });

      const invalidState = warnSpy.mock.calls.filter(
        (a) => typeof a[0] === 'string' && a[0].includes('[INVALID_STATE]')
      );
      expect(invalidState.length).toBe(1);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].message).toContain('before handshake');

      // Error control message sent as plaintext (pre-handshake)
      const errorMsgs = sentMessages.filter(m => {
        try {
          const p = JSON.parse(m);
          return p.type === 'error' && p.code === 'INVALID_STATE';
        } catch { return false; }
      });
      expect(errorMsgs.length).toBe(1);

      // Disconnected
      expect((service as any).keyPair).toBe(null);

      warnSpy.mockRestore();
    });

    it('4. legacy file-chunk before helloComplete → INVALID_STATE (8D regression)', () => {
      const onError = vi.fn();
      const service = createService(vi.fn(), onError);
      const { sentMessages, injectMessage } = attachDataChannel(service);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      injectMessage({
        type: 'file-chunk',
        filename: 'evil.bin',
        chunk: 'data',
        chunkIndex: 0,
        totalChunks: 1,
        fileSize: 10,
      });

      const invalidState = warnSpy.mock.calls.filter(
        (a) => typeof a[0] === 'string' && a[0].includes('[INVALID_STATE]')
      );
      expect(invalidState.length).toBe(1);
      expect(onError).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Decode path
  // ──────────────────────────────────────────────────────────────────────────

  describe('Decode path', () => {
    it('5. valid envelope decodes and routes to processChunk', async () => {
      const onReceiveFile = vi.fn();
      const service = createService(onReceiveFile);
      const { injectMessage } = attachDataChannel(service);
      enableEnvelope(service);

      const innerChunk = makeChunkMsg({
        chunkIndex: 0, totalChunks: 1, transferId: 'env-decode-1',
      });
      const envelope = buildEnvelope(innerChunk);
      injectMessage(envelope);

      // Wait for async guarded path
      await new Promise(r => setTimeout(r, 20));

      expect(onReceiveFile).toHaveBeenCalledTimes(1);
      expect(onReceiveFile.mock.calls[0][1]).toBe('test.bin');

      service.disconnect();
    });

    it('6. invalid version triggers ENVELOPE_INVALID + disconnect', () => {
      const onError = vi.fn();
      const service = createService(vi.fn(), onError);
      const { sentMessages, injectMessage } = attachDataChannel(service);
      enableEnvelope(service);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      injectMessage({
        type: 'profile-envelope',
        version: 2,
        encoding: 'base64',
        payload: 'some-data',
      });

      const invalid = warnSpy.mock.calls.filter(
        (a) => typeof a[0] === 'string' && a[0].includes('[ENVELOPE_INVALID]')
      );
      expect(invalid.length).toBe(1);

      // Disconnected
      expect((service as any).keyPair).toBe(null);

      warnSpy.mockRestore();
    });

    it('7. decrypt failure triggers ENVELOPE_DECRYPT_FAIL + disconnect', () => {
      const onError = vi.fn();
      const service = createService(vi.fn(), onError);
      const { sentMessages, injectMessage } = attachDataChannel(service);
      enableEnvelope(service);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Set openBoxPayload to throw
      mockOpenThrow = true;

      injectMessage({
        type: 'profile-envelope',
        version: 1,
        encoding: 'base64',
        payload: 'encrypted-data-that-will-fail',
      });

      const decryptFail = warnSpy.mock.calls.filter(
        (a) => typeof a[0] === 'string' && a[0].includes('[ENVELOPE_DECRYPT_FAIL]')
      );
      expect(decryptFail.length).toBe(1);

      // Disconnected
      expect((service as any).keyPair).toBe(null);

      warnSpy.mockRestore();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Mixed peer compatibility
  // ──────────────────────────────────────────────────────────────────────────

  describe('Mixed peer', () => {
    it('8. when envelope negotiated, plaintext rejected with ENVELOPE_REQUIRED (H2)', () => {
      const onError = vi.fn();
      const service = createService(vi.fn(), onError);
      const { sentMessages, injectMessage } = attachDataChannel(service);
      enableEnvelope(service);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Send plaintext (not envelope) — should be rejected in envelope-required mode
      injectMessage(makeChunkMsg({
        chunkIndex: 0, totalChunks: 1, transferId: 'envelope-required-1',
      }));

      const envRequired = warnSpy.mock.calls.filter(
        (a) => typeof a[0] === 'string' && a[0].includes('[ENVELOPE_REQUIRED]')
      );
      expect(envRequired.length).toBe(1);

      // Error frame sent (may be enveloped when envelope negotiated — I5 fix)
      const errorMsgs = sentMessages.filter(m => {
        try {
          const p = JSON.parse(m);
          if (p.type === 'error' && p.code === 'ENVELOPE_REQUIRED') return true;
          if (p.type === 'profile-envelope' && p.payload) {
            const innerHex = p.payload as string;
            const bytes = new Uint8Array(innerHex.length / 2);
            for (let i = 0; i < innerHex.length; i += 2) bytes[i / 2] = parseInt(innerHex.substring(i, i + 2), 16);
            const inner = JSON.parse(new TextDecoder().decode(bytes));
            return inner.type === 'error' && inner.code === 'ENVELOPE_REQUIRED';
          }
          return false;
        } catch { return false; }
      });
      expect(errorMsgs.length).toBe(1);

      // Disconnected
      expect((service as any).keyPair).toBe(null);

      warnSpy.mockRestore();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. M2 interaction (file hash through envelope)
  // ──────────────────────────────────────────────────────────────────────────

  describe('M2 interaction', () => {
    it('9. envelope + fileHash on first chunk → expectedHash stored for verification', async () => {
      const onReceiveFile = vi.fn();
      const service = createService(onReceiveFile);
      const { injectMessage } = attachDataChannel(service);
      enableEnvelope(service);

      const hash = 'a'.repeat(64);
      const chunk0 = makeChunkMsg({
        chunkIndex: 0, totalChunks: 2, transferId: 'hash-env-1', fileHash: hash,
      });
      const chunk1 = makeChunkMsg({
        chunkIndex: 1, totalChunks: 2, transferId: 'hash-env-1',
      });

      // Send both chunks as envelopes
      injectMessage(buildEnvelope(chunk0));
      injectMessage(buildEnvelope(chunk1));

      await new Promise(r => setTimeout(r, 20));

      // Hash matches (mock hashFile returns 'a'.repeat(64)) → file delivered
      expect(onReceiveFile).toHaveBeenCalledTimes(1);

      service.disconnect();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Control messages
  // ──────────────────────────────────────────────────────────────────────────

  describe('Control messages', () => {
    it('10. pause/cancel/resume sent via dcSendMessage are enveloped when negotiated', () => {
      const service = createService();
      const { sentMessages } = attachDataChannel(service);
      enableEnvelope(service);

      (service as any).sendTransferIds.set('ctrl.bin', 'ctrl-tid');

      service.pauseTransfer('ctrl.bin');
      service.resumeTransfer('ctrl.bin');
      service.cancelTransfer('ctrl.bin', false);

      // All 3 should be profile-envelope
      expect(sentMessages.length).toBe(3);
      for (const raw of sentMessages) {
        const parsed = JSON.parse(raw);
        expect(parsed.type).toBe('profile-envelope');
        expect(parsed.version).toBe(1);
      }

      service.disconnect();
    });

    it('11. error control messages enveloped when envelope negotiated (I5 fix)', () => {
      const onError = vi.fn();
      const service = createService(vi.fn(), onError);
      const { sentMessages, injectMessage } = attachDataChannel(service);
      enableEnvelope(service);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Trigger ENVELOPE_INVALID by sending invalid version (decode-path failure)
      injectMessage({
        type: 'profile-envelope',
        version: 999,  // invalid version
        encoding: 'base64',
        payload: 'data',
      });

      // I5 fix: World B (envelope negotiated + keys present) → error enveloped
      const errorMsgs = sentMessages.filter(m => {
        try {
          const p = JSON.parse(m);
          if (p.type === 'error' && p.code === 'ENVELOPE_INVALID') return true;
          if (p.type === 'profile-envelope' && p.payload) {
            const innerHex = p.payload as string;
            const bytes = new Uint8Array(innerHex.length / 2);
            for (let i = 0; i < innerHex.length; i += 2) bytes[i / 2] = parseInt(innerHex.substring(i, i + 2), 16);
            const inner = JSON.parse(new TextDecoder().decode(bytes));
            return inner.type === 'error' && inner.code === 'ENVELOPE_INVALID';
          }
          return false;
        } catch { return false; }
      });
      expect(errorMsgs.length).toBe(1);

      // Disconnected
      expect((service as any).keyPair).toBe(null);

      warnSpy.mockRestore();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Regression
  // ──────────────────────────────────────────────────────────────────────────

  describe('Regression', () => {
    it('12. replay protection still works on decrypted inner messages', async () => {
      const service = createService();
      const { injectMessage } = attachDataChannel(service);
      enableEnvelope(service);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Send same chunk twice via envelope
      const chunk = makeChunkMsg({
        chunkIndex: 0, totalChunks: 3, transferId: 'replay-env-1',
      });
      injectMessage(buildEnvelope(chunk));
      injectMessage(buildEnvelope(chunk));

      await new Promise(r => setTimeout(r, 20));

      const dup = warnSpy.mock.calls.filter(
        (a) => typeof a[0] === 'string' && a[0].includes('[REPLAY_DUP]')
      );
      expect(dup.length).toBe(1);

      warnSpy.mockRestore();
      service.disconnect();
    });

    it('13. envelope unnegotiated → fail-closed with ENVELOPE_UNNEGOTIATED', () => {
      const onError = vi.fn();
      const service = createService(vi.fn(), onError);
      const { sentMessages, injectMessage } = attachDataChannel(service);
      // HELLO complete but envelope NOT negotiated
      disableEnvelope(service);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      injectMessage({
        type: 'profile-envelope',
        version: 1,
        encoding: 'base64',
        payload: 'some-payload',
      });

      const unneg = warnSpy.mock.calls.filter(
        (a) => typeof a[0] === 'string' && a[0].includes('[ENVELOPE_UNNEGOTIATED]')
      );
      expect(unneg.length).toBe(1);

      // Disconnected
      expect((service as any).keyPair).toBe(null);

      warnSpy.mockRestore();
    });

    it('14. localCapabilities includes bolt.profile-envelope-v1', () => {
      const service = createService();
      expect((service as any).localCapabilities).toContain('bolt.profile-envelope-v1');
      expect((service as any).localCapabilities).toContain('bolt.file-hash');
      service.disconnect();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. I5: Error framing interop
  // ──────────────────────────────────────────────────────────────────────────

  describe('I5: Error framing interop', () => {
    it('15. enveloped error from remote peer accepted and routed (Case B inbound)', () => {
      const onError = vi.fn();
      const service = createService(vi.fn(), onError);
      const { injectMessage } = attachDataChannel(service);
      enableEnvelope(service);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Remote sends enveloped error (Case B: decrypts OK, inner is {type:'error'})
      injectMessage(buildEnvelope({ type: 'error', code: 'TRANSFER_FAILED', message: 'Transfer cancelled by remote' }));

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].message).toContain('Transfer cancelled by remote');
      // Disconnected
      expect((service as any).keyPair).toBe(null);

      warnSpy.mockRestore();
    });

    it('16. plaintext error rejected in envelope-required mode', () => {
      const onError = vi.fn();
      const service = createService(vi.fn(), onError);
      const { sentMessages, injectMessage } = attachDataChannel(service);
      enableEnvelope(service);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Remote sends plaintext error when envelope is required — not exempt
      injectMessage({ type: 'error', code: 'SOME_ERROR', message: 'should be rejected' });

      const envRequired = warnSpy.mock.calls.filter(
        (a) => typeof a[0] === 'string' && a[0].includes('[ENVELOPE_REQUIRED]')
      );
      expect(envRequired.length).toBe(1);
      // Disconnected
      expect((service as any).keyPair).toBe(null);

      warnSpy.mockRestore();
    });

    it('17. sendErrorAndDisconnect wraps in envelope when negotiated (World B outbound)', () => {
      const service = createService();
      const { sentMessages } = attachDataChannel(service);
      enableEnvelope(service);

      // Directly invoke sendErrorAndDisconnect in World B state
      (service as any).sendErrorAndDisconnect('INVALID_STATE', 'test message');

      expect(sentMessages.length).toBe(1);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('profile-envelope');
      expect(parsed.version).toBe(1);
      // Decode inner via hex (mock sealBoxPayload format)
      const innerHex = parsed.payload as string;
      const bytes = new Uint8Array(innerHex.length / 2);
      for (let i = 0; i < innerHex.length; i += 2) bytes[i / 2] = parseInt(innerHex.substring(i, i + 2), 16);
      const inner = JSON.parse(new TextDecoder().decode(bytes));
      expect(inner.type).toBe('error');
      expect(inner.code).toBe('INVALID_STATE');
      expect(inner.message).toBe('test message');
      // Disconnected
      expect((service as any).keyPair).toBe(null);
    });

    it('18. sendErrorAndDisconnect sends plaintext pre-HELLO (World A outbound)', () => {
      const service = createService();
      const { sentMessages } = attachDataChannel(service);
      // helloComplete=false, sessionState=pre_hello by default (World A)

      (service as any).sendErrorAndDisconnect('VERSION_MISMATCH', 'before handshake');

      expect(sentMessages.length).toBe(1);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('error');
      expect(parsed.code).toBe('VERSION_MISMATCH');
      expect(parsed.message).toBe('before handshake');
      // Disconnected
      expect((service as any).keyPair).toBe(null);
    });

    it('19. unknown error code in enveloped error → PROTOCOL_VIOLATION + disconnect', () => {
      const onError = vi.fn();
      const service = createService(vi.fn(), onError);
      const { sentMessages, injectMessage } = attachDataChannel(service);
      enableEnvelope(service);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Remote sends enveloped error with non-canonical code — must be rejected
      injectMessage(buildEnvelope({ type: 'error', code: 'XYZZY_UNKNOWN_999', message: 'exotic error' }));

      // Should emit PROTOCOL_VIOLATION
      const violations = sentMessages.filter(m => {
        try {
          const p = JSON.parse(m);
          if (p.type === 'profile-envelope' && p.payload) {
            const hex = p.payload as string;
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
            const inner = JSON.parse(new TextDecoder().decode(bytes));
            return inner.type === 'error' && inner.code === 'PROTOCOL_VIOLATION';
          }
          return false;
        } catch { return false; }
      });
      expect(violations.length).toBe(1);
      // Disconnected
      expect((service as any).keyPair).toBe(null);

      warnSpy.mockRestore();
    });
  });
});
