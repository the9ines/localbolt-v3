// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SignalingProvider } from '../services/signaling/SignalingProvider.js';

// ─── Stub @the9ines/bolt-core to isolate lifecycle logic from real crypto ─────

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
  openBoxPayload: (cipher: string) => {
    if (cipher === 'THROW_DECRYPT') throw new Error('Decryption failed');
    return new Uint8Array([...new TextEncoder().encode(cipher)]);
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
  /** Inject a message into the data channel's onmessage handler. */
  function injectMessage(data: Record<string, unknown>) {
    if (dc.onmessage) {
      dc.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
  return { dc, sentMessages, injectMessage };
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

function createMockFile(name: string, size: number): File {
  const fileData = new Uint8Array(size);
  return {
    name,
    size,
    slice: (start: number, end: number) => ({
      arrayBuffer: () => Promise.resolve(fileData.slice(start, end).buffer),
    }),
  } as unknown as File;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Phase 8B.1: WebRTCService Lifecycle Coverage', () => {
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
    // Set up minimal crypto state for methods that need it
    (service as any).remotePublicKey = new Uint8Array(32);
    (service as any).keyPair = {
      publicKey: new Uint8Array(32),
      secretKey: new Uint8Array(32),
    };
    return service;
  }

  /** Attach a mock data channel to the service. */
  function attachDataChannel(service: any) {
    const { dc, sentMessages, injectMessage } = createMockDataChannel();
    (service as any).dc = dc;
    // Wire up handleMessage via the dc.onmessage set by setupDataChannel
    dc.onmessage = (event: MessageEvent) => {
      (service as any).handleMessage(event);
    };
    return { dc, sentMessages, injectMessage };
  }

  // ─── 1. sendFile waits for helloComplete ─────────────────────────────────

  it('sendFile blocks until helloComplete is resolved', async () => {
    const service = createService();
    const { dc, sentMessages } = attachDataChannel(service);
    (service as any).helloComplete = false;

    let sendResolved = false;
    const file = createMockFile('wait-test.bin', 100);

    const sendPromise = service.sendFile(file).then(() => { sendResolved = true; });

    // Yield microtask — sendFile should be awaiting waitForHello
    await new Promise(r => setTimeout(r, 50));
    expect(sendResolved).toBe(false);
    expect(sentMessages.length).toBe(0);

    // Resolve HELLO gate
    (service as any).helloComplete = true;
    if ((service as any).helloResolve) {
      (service as any).helloResolve();
      (service as any).helloResolve = null;
    }

    await sendPromise;
    expect(sendResolved).toBe(true);
    expect(sentMessages.length).toBeGreaterThan(0);

    service.disconnect();
  });

  // ─── 2. sendFile emits chunk messages in order ───────────────────────────

  it('sendFile sends all chunks in order with correct fields', async () => {
    const service = createService();
    attachDataChannel(service);
    (service as any).helloComplete = true;
    (service as any).remoteIdentityKey = new Uint8Array(32);

    // 100 bytes at default 16384 chunk size = 1 chunk
    const file = createMockFile('order-test.bin', 100);
    await service.sendFile(file);

    const { sentMessages } = attachDataChannel(service);
    // Re-attach to capture. Let's do it differently — read from the first dc.
    // The sentMessages are on the first attachDataChannel call. Let me restructure.
    service.disconnect();

    // Fresh service with tracked messages
    const service2 = createService();
    const { sentMessages: msgs } = attachDataChannel(service2);
    (service2 as any).helloComplete = true;
    (service2 as any).remoteIdentityKey = new Uint8Array(32);

    // 50000 bytes / 16384 = 4 chunks (ceil)
    const bigFile = createMockFile('multi-chunk.bin', 50000);
    await service2.sendFile(bigFile);

    const chunks = msgs.map(m => JSON.parse(m));
    expect(chunks.length).toBe(4);

    // Verify order and fields
    for (let i = 0; i < 4; i++) {
      expect(chunks[i].type).toBe('file-chunk');
      expect(chunks[i].filename).toBe('multi-chunk.bin');
      expect(chunks[i].chunkIndex).toBe(i);
      expect(chunks[i].totalChunks).toBe(4);
      expect(chunks[i].fileSize).toBe(50000);
      expect(chunks[i].transferId).toBeDefined();
      expect(typeof chunks[i].chunk).toBe('string');
    }

    // All chunks share the same transferId
    const tids = new Set(chunks.map((c: any) => c.transferId));
    expect(tids.size).toBe(1);

    service2.disconnect();
  });

  // ─── 3. cancelTransfer sends control message and cleans state ────────────

  it('cancelTransfer sends cancel message and clears internal maps', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);
    (service as any).helloComplete = true;
    (service as any).remoteIdentityKey = new Uint8Array(32);

    // Simulate an active sender transfer
    const tid = 'aabbccdd00112233aabbccdd00112233';
    (service as any).sendTransferIds.set('cancel-test.bin', tid);

    service.cancelTransfer('cancel-test.bin', false);

    // UI-XFER-1: Should have sent a canonical cancel control message
    expect(sentMessages.length).toBe(1);
    const msg = JSON.parse(sentMessages[0]);
    expect(msg.type).toBe('cancel');
    expect(msg.transferId).toBe(tid);
    expect(msg.cancelledBy).toBe('sender');

    // sendTransferIds should be cleaned
    expect((service as any).sendTransferIds.has('cancel-test.bin')).toBe(false);

    service.disconnect();
  });

  // ─── 4. pauseTransfer and resumeTransfer ─────────────────────────────────

  it('pauseTransfer and resumeTransfer send control messages without throwing', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);

    // Simulate sender-side transfer with transferId
    const tid = '1111222233334444aaaabbbbccccdddd';
    (service as any).sendTransferIds.set('pause-test.bin', tid);

    service.pauseTransfer('pause-test.bin');
    expect((service as any).transferPaused).toBe(true);

    service.resumeTransfer('pause-test.bin');
    expect((service as any).transferPaused).toBe(false);

    // Two control messages sent
    expect(sentMessages.length).toBe(2);

    // UI-XFER-1: canonical control message shapes
    const pauseMsg = JSON.parse(sentMessages[0]);
    expect(pauseMsg.type).toBe('pause');
    expect(pauseMsg.transferId).toBe(tid);

    const resumeMsg = JSON.parse(sentMessages[1]);
    expect(resumeMsg.type).toBe('resume');
    expect(resumeMsg.transferId).toBe(tid);

    service.disconnect();
  });

  // ─── 5. Receiver legacy path reconstructs file ──────────────────────────

  it('legacy receiver path (no transferId) reconstructs file and calls onReceiveFile', () => {
    const onReceiveFile = vi.fn();
    const service = createService(onReceiveFile);

    // No helloComplete, no transferId → legacy path
    (service as any).processChunk(makeChunkMsg({ chunkIndex: 0, totalChunks: 2 }));
    (service as any).processChunk(makeChunkMsg({ chunkIndex: 1, totalChunks: 2 }));

    expect(onReceiveFile).toHaveBeenCalledTimes(1);
    const [blob, filename] = onReceiveFile.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(filename).toBe('test.bin');

    // receiveBuffers cleaned up after completion
    expect((service as any).receiveBuffers.has('test.bin')).toBe(false);
    // guardedTransfers untouched
    expect((service as any).guardedTransfers.size).toBe(0);

    service.disconnect();
  });

  // ─── 6. Guarded receiver path reconstructs out-of-order ─────────────────

  it('guarded path reconstructs out-of-order chunks (2,0,1) and calls onReceiveFile', () => {
    const onReceiveFile = vi.fn();
    const service = createService(onReceiveFile);
    (service as any).helloComplete = true;
    (service as any).remoteIdentityKey = new Uint8Array(32);

    const tid = 'deadbeef01234567deadbeef01234567';

    (service as any).processChunk(makeChunkMsg({ chunkIndex: 2, totalChunks: 3, transferId: tid, chunk: 'c2' }));
    (service as any).processChunk(makeChunkMsg({ chunkIndex: 0, totalChunks: 3, transferId: tid, chunk: 'c0' }));
    (service as any).processChunk(makeChunkMsg({ chunkIndex: 1, totalChunks: 3, transferId: tid, chunk: 'c1' }));

    expect(onReceiveFile).toHaveBeenCalledTimes(1);
    const [blob, filename] = onReceiveFile.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(filename).toBe('test.bin');

    // guardedTransfers cleaned up after completion
    expect((service as any).guardedTransfers.has(tid)).toBe(false);
    expect((service as any).recvTransferIds.has('test.bin')).toBe(false);

    service.disconnect();
  });

  // ─── 7. handleRemoteCancel clears receiver state ─────────────────────────

  it('handleRemoteCancel clears receiveBuffers, guardedTransfers, and recvTransferIds', () => {
    const onProgress = vi.fn();
    const service = createService(vi.fn(), vi.fn(), onProgress);
    (service as any).helloComplete = true;
    (service as any).remoteIdentityKey = new Uint8Array(32);

    const tid = 'cafecafe12345678cafecafe12345678';

    // Simulate partial guarded receive
    (service as any).processChunk(makeChunkMsg({ chunkIndex: 0, totalChunks: 5, transferId: tid }));
    expect((service as any).guardedTransfers.has(tid)).toBe(true);
    expect((service as any).recvTransferIds.get('test.bin')).toBe(tid);

    // Also seed a legacy buffer for same filename (edge case)
    (service as any).receiveBuffers.set('test.bin', [null, null]);

    // Simulate remote cancel with transferId
    (service as any).handleRemoteCancel({
      type: 'file-chunk',
      filename: 'test.bin',
      cancelled: true,
      cancelledBy: 'sender',
      transferId: tid,
    });

    // All state cleared
    expect((service as any).guardedTransfers.has(tid)).toBe(false);
    expect((service as any).receiveBuffers.has('test.bin')).toBe(false);
    expect((service as any).recvTransferIds.has('test.bin')).toBe(false);
    expect((service as any).transferCancelled).toBe(true);

    // Progress emitted with cancel status
    const cancelProgress = onProgress.mock.calls.find(
      (args: any[]) => args[0].status === 'canceled_by_sender'
    );
    expect(cancelProgress).toBeDefined();

    service.disconnect();
  });

  // ─── 8. disconnect clears all transfer state ─────────────────────────────

  it('disconnect clears receiveBuffers, guardedTransfers, sendTransferIds, recvTransferIds', () => {
    const service = createService();
    (service as any).helloComplete = true;
    (service as any).remoteIdentityKey = new Uint8Array(32);

    // Seed various state maps
    (service as any).receiveBuffers.set('a.bin', [null]);
    (service as any).guardedTransfers.set('tid1', { transferId: 'tid1', receivedSet: new Set() });
    (service as any).sendTransferIds.set('b.bin', 'tid2');
    (service as any).recvTransferIds.set('c.bin', 'tid3');

    service.disconnect();

    expect((service as any).receiveBuffers.size).toBe(0);
    expect((service as any).guardedTransfers.size).toBe(0);
    expect((service as any).sendTransferIds.size).toBe(0);
    expect((service as any).recvTransferIds.size).toBe(0);
    expect((service as any).keyPair).toBe(null);
    expect((service as any).remotePublicKey).toBe(null);
    expect((service as any).helloComplete).toBe(false);
    expect((service as any).remoteIdentityKey).toBe(null);
  });

  // ─── 9. Decryption failure triggers error and clears guarded transfer ────

  it('decryption failure in guarded path emits error progress and calls onError', () => {
    const onReceiveFile = vi.fn();
    const onError = vi.fn();
    const onProgress = vi.fn();
    const service = createService(onReceiveFile, onError, onProgress);
    (service as any).helloComplete = true;
    (service as any).remoteIdentityKey = new Uint8Array(32);

    const tid = 'baddecryptbaddecryptbaddecrypt00';

    // Send a chunk whose cipher stub will trigger throw in openBoxPayload
    (service as any).processChunk(makeChunkMsg({
      chunkIndex: 0,
      totalChunks: 2,
      transferId: tid,
      chunk: 'THROW_DECRYPT',
    }));

    // onError should have been called
    expect(onError).toHaveBeenCalledTimes(1);

    // guardedTransfers should be cleaned up
    expect((service as any).guardedTransfers.has(tid)).toBe(false);
    expect((service as any).recvTransferIds.has('test.bin')).toBe(false);

    // Error progress emitted
    const errorProgress = onProgress.mock.calls.find(
      (args: any[]) => args[0].status === 'error'
    );
    expect(errorProgress).toBeDefined();

    // onReceiveFile NOT called
    expect(onReceiveFile).not.toHaveBeenCalled();

    service.disconnect();
  });

  // ─── 10. Invalid chunk fields do not crash ───────────────────────────────

  it('invalid chunk fields are rejected without crashing', () => {
    const onReceiveFile = vi.fn();
    const onError = vi.fn();
    const service = createService(onReceiveFile, onError);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // NaN totalChunks
    (service as any).processChunk(makeChunkMsg({ totalChunks: NaN, chunkIndex: 0 }));
    // Negative totalChunks
    (service as any).processChunk(makeChunkMsg({ totalChunks: -1, chunkIndex: 0 }));
    // Fractional totalChunks
    (service as any).processChunk(makeChunkMsg({ totalChunks: 2.5, chunkIndex: 0 }));
    // Missing chunk field (should bail before bounds check)
    (service as any).processChunk({ type: 'file-chunk', filename: 'x.bin', totalChunks: 1, chunkIndex: 0, fileSize: 10 });

    // None should call onReceiveFile or onError
    expect(onReceiveFile).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    service.disconnect();
  });

  // ─── 11. handleMessage routes control messages correctly ─────────────────

  it('handleMessage routes pause/resume/cancel control messages to correct handlers', () => {
    const onProgress = vi.fn();
    const service = createService(vi.fn(), vi.fn(), onProgress);
    const { injectMessage } = attachDataChannel(service);
    // Handshake must be complete before control messages are accepted (Phase 8D)
    (service as any).sessionState = 'post_hello';
    (service as any).helloComplete = true;

    // Inject pause
    injectMessage({ type: 'file-chunk', filename: 'ctrl.bin', paused: true });
    expect((service as any).transferPaused).toBe(true);

    // Inject resume
    injectMessage({ type: 'file-chunk', filename: 'ctrl.bin', resumed: true });
    expect((service as any).transferPaused).toBe(false);

    // Inject cancel
    injectMessage({
      type: 'file-chunk',
      filename: 'ctrl.bin',
      cancelled: true,
      cancelledBy: 'sender',
    });
    expect((service as any).transferCancelled).toBe(true);

    service.disconnect();
  });

  // ─── 12. N10: completion timeout cleared on disconnect ──────────────────

  it('completion timeout is cleared on disconnect — stale event not emitted (N10)', async () => {
    vi.useFakeTimers();
    const onProgress = vi.fn();
    const service = createService(vi.fn(), vi.fn(), onProgress);
    attachDataChannel(service);
    (service as any).helloComplete = true;
    (service as any).remoteIdentityKey = new Uint8Array(32);

    const file = createMockFile('n10-test.bin', 100);
    await service.sendFile(file);

    // Completion timer is scheduled (50ms) but not yet fired
    const completedBefore = onProgress.mock.calls.filter(
      (args: any[]) => args[0].status === 'completed'
    );
    expect(completedBefore.length).toBe(0);

    service.disconnect();

    // Advance past 50ms — stale completion callback must NOT fire
    vi.advanceTimersByTime(100);

    const completedAfter = onProgress.mock.calls.filter(
      (args: any[]) => args[0].status === 'completed'
    );
    expect(completedAfter.length).toBe(0);

    vi.useRealTimers();
  });

  // ─── 13. sendFile throws when dc not open ────────────────────────────────

  it('sendFile throws TransferError when data channel is not open', async () => {
    const service = createService();
    (service as any).helloComplete = true;

    // dc is null
    (service as any).dc = null;
    const file = createMockFile('no-dc.bin', 100);

    await expect(service.sendFile(file)).rejects.toThrow('Data channel not open');

    // dc exists but readyState is 'closed'
    const { dc } = createMockDataChannel();
    dc.readyState = 'closed';
    (service as any).dc = dc;

    await expect(service.sendFile(file)).rejects.toThrow('Data channel not open');

    service.disconnect();
  });
});
