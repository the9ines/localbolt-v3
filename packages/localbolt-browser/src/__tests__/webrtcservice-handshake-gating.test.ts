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
  sealBoxPayload: (_data: Uint8Array) => 'encrypted-stub',
  openBoxPayload: (cipher: string) =>
    new Uint8Array([...new TextEncoder().encode(cipher)]),
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Phase 8D: Strict Handshake Gating (S4)', () => {
  let WebRTCService: any;

  beforeEach(async () => {
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  function createService(
    onReceiveFile = vi.fn(),
    onError = vi.fn(),
    onProgress?: (p: any) => void,
  ) {
    const signaling = createMockSignaling();
    const service = new WebRTCService(signaling, 'LOCAL', onReceiveFile, onError, onProgress);
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

  // ─── 1. HELLO is allowed before helloComplete ────────────────────────────

  it('allows HELLO message before helloComplete without INVALID_STATE', () => {
    const onError = vi.fn();
    const service = createService(vi.fn(), onError);
    const { sentMessages, injectMessage } = attachDataChannel(service);
    // helloComplete is false by default

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Send a valid HELLO payload (mock openBoxPayload returns UTF-8 decode of cipher string)
    injectMessage({
      type: 'hello',
      payload: '{"type":"hello","version":1,"identityPublicKey":"abc"}',
    });

    // Should NOT have logged INVALID_STATE
    const invalidStateWarns = warnSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('[INVALID_STATE]')
    );
    expect(invalidStateWarns.length).toBe(0);

    // Should NOT have sent an INVALID_STATE error control message
    const invalidStateErrors = sentMessages.filter(m => {
      try {
        const p = JSON.parse(m);
        return p.type === 'error' && p.code === 'INVALID_STATE';
      } catch { return false; }
    });
    expect(invalidStateErrors.length).toBe(0);

    warnSpy.mockRestore();
    service.disconnect();
  });

  // ─── 2. file-chunk data rejected before helloComplete ────────────────────

  it('rejects file-chunk data before helloComplete with INVALID_STATE + disconnect', () => {
    const onError = vi.fn();
    const service = createService(vi.fn(), onError);
    const { sentMessages, injectMessage } = attachDataChannel(service);
    // helloComplete is false by default

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    injectMessage({
      type: 'file-chunk',
      filename: 'evil.bin',
      chunk: 'data',
      chunkIndex: 0,
      totalChunks: 1,
      fileSize: 100,
    });

    // INVALID_STATE logged
    const invalidStateWarns = warnSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('[INVALID_STATE]')
    );
    expect(invalidStateWarns.length).toBe(1);

    // onError called
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toContain('before handshake');

    // Error control message sent
    const errorMsgs = sentMessages.filter(m => {
      try {
        const parsed = JSON.parse(m);
        return parsed.type === 'error' && parsed.code === 'INVALID_STATE';
      } catch { return false; }
    });
    expect(errorMsgs.length).toBe(1);

    // disconnect() called — keyPair should be null
    expect((service as any).keyPair).toBe(null);

    warnSpy.mockRestore();
  });

  // ─── 3. file-chunk with cancelled=true rejected before helloComplete ─────

  it('rejects file-chunk cancel control message before helloComplete', () => {
    const onError = vi.fn();
    const service = createService(vi.fn(), onError);
    const { sentMessages, injectMessage } = attachDataChannel(service);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    injectMessage({
      type: 'file-chunk',
      filename: 'cancel.bin',
      cancelled: true,
      cancelledBy: 'sender',
    });

    // INVALID_STATE logged
    const invalidStateWarns = warnSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('[INVALID_STATE]')
    );
    expect(invalidStateWarns.length).toBe(1);

    // onError called
    expect(onError).toHaveBeenCalledTimes(1);

    // Error control message sent
    expect(sentMessages.length).toBeGreaterThanOrEqual(1);
    const errorMsg = JSON.parse(sentMessages[0]);
    expect(errorMsg.type).toBe('error');
    expect(errorMsg.code).toBe('INVALID_STATE');

    // disconnect() called
    expect((service as any).keyPair).toBe(null);

    warnSpy.mockRestore();
  });

  // ─── 4. file-chunk with paused=true rejected before helloComplete ────────

  it('rejects file-chunk pause control message before helloComplete', () => {
    const onError = vi.fn();
    const service = createService(vi.fn(), onError);
    const { sentMessages, injectMessage } = attachDataChannel(service);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    injectMessage({
      type: 'file-chunk',
      filename: 'pause.bin',
      paused: true,
    });

    // INVALID_STATE logged
    const invalidStateWarns = warnSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('[INVALID_STATE]')
    );
    expect(invalidStateWarns.length).toBe(1);

    // onError called + error message sent + disconnected
    expect(onError).toHaveBeenCalledTimes(1);
    expect(sentMessages.length).toBeGreaterThanOrEqual(1);
    expect((service as any).keyPair).toBe(null);

    warnSpy.mockRestore();
  });

  // ─── 5. After helloComplete, file-chunk routes normally ──────────────────

  it('after helloComplete, file-chunk messages route normally', () => {
    const onReceiveFile = vi.fn();
    const service = createService(onReceiveFile);
    attachDataChannel(service);
    (service as any).helloComplete = true;
    (service as any).remoteIdentityKey = new Uint8Array(32);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Send a complete 1-chunk transfer via processChunk
    const tid = 'aabbccddee001122aabbccddee001122';
    (service as any).processChunk({
      type: 'file-chunk',
      filename: 'normal.bin',
      chunk: 'data-0',
      chunkIndex: 0,
      totalChunks: 1,
      fileSize: 10,
      transferId: tid,
    });

    // Should have called onReceiveFile
    expect(onReceiveFile).toHaveBeenCalledTimes(1);

    // No INVALID_STATE
    const invalidStateWarns = warnSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('[INVALID_STATE]')
    );
    expect(invalidStateWarns.length).toBe(0);

    warnSpy.mockRestore();
    service.disconnect();
  });

  // ─── 6. Regression: sendFile still blocks on helloComplete ───────────────

  it('sendFile still blocks until helloComplete (send-side gating preserved)', async () => {
    const service = createService();
    attachDataChannel(service);
    (service as any).helloComplete = false;

    let resolved = false;
    const file = {
      name: 'block-test.bin',
      size: 50,
      slice: (start: number, end: number) => ({
        arrayBuffer: () => Promise.resolve(new Uint8Array(end - start).buffer),
      }),
    } as unknown as File;

    const sendPromise = service.sendFile(file).then(() => { resolved = true; });

    await new Promise(r => setTimeout(r, 50));
    expect(resolved).toBe(false);

    // Resolve HELLO gate
    (service as any).helloComplete = true;
    if ((service as any).helloResolve) {
      (service as any).helloResolve();
      (service as any).helloResolve = null;
    }

    await sendPromise;
    expect(resolved).toBe(true);

    service.disconnect();
  });
});
