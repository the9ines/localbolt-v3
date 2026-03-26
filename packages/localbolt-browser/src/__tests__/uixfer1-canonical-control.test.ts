// @vitest-environment jsdom
/**
 * UI-XFER-1: Canonical DC control messages — pause/resume/cancel.
 *
 * Tests cover:
 * 1. Canonical emit shapes (pause, resume, cancel)
 * 2. Deterministic failure when transferId missing
 * 3. Legacy receive-side compat (deprecated file-chunk control flags)
 * 4. Pause blocks new chunk enqueue
 * 5. Resume unblocks enqueue
 * 6. Cancel during backpressure aborts cleanly
 * 7. No completion after cancel terminal state
 * 8. Canonical receive-side routing
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SignalingProvider } from '../services/signaling/SignalingProvider.js';

// ─── Stub @the9ines/bolt-core ─────────────────────────────────────────────────

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
  openBoxPayload: (cipher: string) => new Uint8Array([...new TextEncoder().encode(cipher)]),
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const TID = 'aabbccdd00112233aabbccdd00112233';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UI-XFER-1: Canonical DC Control Messages', () => {
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
    (service as any).keyPair = { publicKey: new Uint8Array(32), secretKey: new Uint8Array(32) };
    return service;
  }

  function attachDataChannel(service: any) {
    const { dc, sentMessages, injectMessage } = createMockDataChannel();
    (service as any).dc = dc;
    dc.onmessage = (event: MessageEvent) => { (service as any).handleMessage(event); };
    return { dc, sentMessages, injectMessage };
  }

  // ─── 1. Canonical emit: pause ─────────────────────────────────────────────

  it('pause emits canonical { type: "pause", transferId } message', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);
    (service as any).sendTransferIds.set('test.bin', TID);

    service.pauseTransfer('test.bin');

    expect(sentMessages.length).toBe(1);
    const msg = JSON.parse(sentMessages[0]);
    expect(msg.type).toBe('pause');
    expect(msg.transferId).toBe(TID);
    // Must NOT contain legacy fields
    expect(msg.filename).toBeUndefined();
    expect(msg.paused).toBeUndefined();

    service.disconnect();
  });

  // ─── 2. Canonical emit: resume ────────────────────────────────────────────

  it('resume emits canonical { type: "resume", transferId } message', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);
    (service as any).sendTransferIds.set('test.bin', TID);

    service.resumeTransfer('test.bin');

    expect(sentMessages.length).toBe(1);
    const msg = JSON.parse(sentMessages[0]);
    expect(msg.type).toBe('resume');
    expect(msg.transferId).toBe(TID);
    expect(msg.filename).toBeUndefined();
    expect(msg.resumed).toBeUndefined();

    service.disconnect();
  });

  // ─── 3. Canonical emit: cancel ────────────────────────────────────────────

  it('cancel emits canonical { type: "cancel", transferId, cancelledBy } message', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);
    (service as any).sendTransferIds.set('test.bin', TID);

    service.cancelTransfer('test.bin', false);

    expect(sentMessages.length).toBe(1);
    const msg = JSON.parse(sentMessages[0]);
    expect(msg.type).toBe('cancel');
    expect(msg.transferId).toBe(TID);
    expect(msg.cancelledBy).toBe('sender');
    expect(msg.filename).toBeUndefined();
    expect(msg.cancelled).toBeUndefined();

    service.disconnect();
  });

  // ─── 4. Emit fails deterministically when transferId missing ──────────────

  it('pauseTransfer with no transferId does not send and does not throw', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);
    // No sendTransferIds entry → no transferId

    service.pauseTransfer('no-tid.bin');
    expect(sentMessages.length).toBe(0);
    // transferPaused NOT set (early return)
    expect((service as any).transferPaused).toBe(false);

    service.disconnect();
  });

  it('resumeTransfer with no transferId does not send and does not throw', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);

    service.resumeTransfer('no-tid.bin');
    expect(sentMessages.length).toBe(0);
    expect((service as any).transferPaused).toBe(false);

    service.disconnect();
  });

  it('cancelTransfer with no transferId still sets cancelled state locally', () => {
    const progressUpdates: any[] = [];
    const service = createService(vi.fn(), vi.fn(), (p: any) => progressUpdates.push(p));
    const { sentMessages } = attachDataChannel(service);

    service.cancelTransfer('no-tid.bin', false);

    // No message sent to peer
    expect(sentMessages.length).toBe(0);
    // But local state IS set to cancelled (stops any in-progress send loop)
    expect((service as any).transferCancelled).toBe(true);
    // Progress callback emitted with cancel status
    expect(progressUpdates.some((p: any) => p.status === 'canceled_by_sender')).toBe(true);

    service.disconnect();
  });

  // ─── 5. Legacy receive-side compat (deprecated) ───────────────────────────

  it('legacy file-chunk pause control is still accepted on receive side', () => {
    const progressUpdates: any[] = [];
    const service = createService(vi.fn(), vi.fn(), (p: any) => progressUpdates.push(p));
    attachDataChannel(service);
    (service as any).helloComplete = true;
    (service as any).sessionState = 'active';

    // Simulate receiving a legacy pause message
    (service as any).transfer.routeInnerMessage({
      type: 'file-chunk',
      filename: 'legacy.bin',
      paused: true,
    });

    expect((service as any).transferPaused).toBe(true);
    expect(progressUpdates.some((p: any) => p.status === 'paused')).toBe(true);

    service.disconnect();
  });

  it('legacy file-chunk resume control is still accepted on receive side', () => {
    const service = createService();
    attachDataChannel(service);
    (service as any).transferPaused = true;

    (service as any).transfer.routeInnerMessage({
      type: 'file-chunk',
      filename: 'legacy.bin',
      resumed: true,
    });

    expect((service as any).transferPaused).toBe(false);

    service.disconnect();
  });

  it('legacy file-chunk cancel control is still accepted on receive side', () => {
    const service = createService();
    attachDataChannel(service);

    (service as any).transfer.routeInnerMessage({
      type: 'file-chunk',
      filename: 'legacy.bin',
      cancelled: true,
      cancelledBy: 'sender',
    });

    expect((service as any).transferCancelled).toBe(true);

    service.disconnect();
  });

  // ─── 6. Pause blocks new chunk enqueue ────────────────────────────────────

  it('sendFile respects transferPaused flag (poll loop until resumed)', async () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);
    (service as any).helloComplete = true;
    (service as any).sessionState = 'active';
    (service as any).helloResolve = () => {};

    // Use a slow file.slice to inject pause after sendFile resets the flag
    // but before chunks are actually sent
    let sliceCallCount = 0;
    const file = {
      name: 'pause-loop.bin',
      size: 16384 * 3, // 3 chunks
      slice: (start: number, end: number) => ({
        arrayBuffer: async () => {
          sliceCallCount++;
          if (sliceCallCount === 1) {
            // After first chunk read, set pause — second chunk will block
            (service as any).transferPaused = true;
          }
          return new Uint8Array(end - start).buffer;
        },
      }),
    } as unknown as File;

    const sendPromise = service.sendFile(file);

    // Wait for first chunk to send and pause to take effect
    await new Promise(r => setTimeout(r, 350));
    const msgCountWhilePaused = sentMessages.length;
    // Should have sent exactly 1 chunk (first one), then paused before second
    expect(msgCountWhilePaused).toBe(1);

    // Resume — remaining chunks should flow
    (service as any).transferPaused = false;
    await sendPromise;

    expect(sentMessages.length).toBe(3); // all 3 chunks sent

    service.disconnect();
  });

  // ─── 7. Cancel during backpressure aborts cleanly ─────────────────────────

  it('cancel during backpressure wait rejects sendFile', async () => {
    const service = createService();
    const { dc } = attachDataChannel(service);
    (service as any).helloComplete = true;
    (service as any).sessionState = 'active';
    (service as any).helloResolve = () => {};

    // Set high bufferedAmount to trigger backpressure wait
    dc.bufferedAmount = 999999;
    dc.bufferedAmountLowThreshold = 65536;

    const file = {
      name: 'bp-cancel.bin',
      size: 100,
      slice: (start: number, end: number) => ({
        arrayBuffer: () => Promise.resolve(new Uint8Array(end - start).buffer),
      }),
    } as unknown as File;

    const sendPromise = service.sendFile(file);

    // Wait for send to enter backpressure wait, then cancel
    await new Promise(r => setTimeout(r, 50));
    (service as any).transferCancelled = true;
    // Release backpressure so the loop can check cancel flag
    dc.bufferedAmount = 0;
    if (dc.onbufferedamountlow) dc.onbufferedamountlow();

    await expect(sendPromise).rejects.toThrow(/cancelled/);

    service.disconnect();
  });

  // ─── 8. No completion after cancel terminal state ─────────────────────────

  it('completion callback not emitted after cancel clears completion timeout', async () => {
    const progressUpdates: any[] = [];
    const service = createService(vi.fn(), vi.fn(), (p: any) => progressUpdates.push(p));
    const { sentMessages } = attachDataChannel(service);
    (service as any).helloComplete = true;
    (service as any).sessionState = 'active';
    (service as any).helloResolve = () => {};

    const file = {
      name: 'race.bin',
      size: 16384, // exactly 1 chunk
      slice: (start: number, end: number) => ({
        arrayBuffer: () => Promise.resolve(new Uint8Array(end - start).buffer),
      }),
    } as unknown as File;

    await service.sendFile(file);

    // Completion timeout is pending (50ms). Cancel before it fires.
    (service as any).sendTransferIds.set('race.bin', TID); // Re-add for cancel to find
    service.cancelTransfer('race.bin', false);

    // Wait for what would have been the completion timeout
    await new Promise(r => setTimeout(r, 100));

    // No 'completed' status should appear after the cancel
    const statusesAfterCancel = progressUpdates
      .slice(progressUpdates.findIndex((p: any) => p.status?.includes('canceled')))
      .map((p: any) => p.status);
    expect(statusesAfterCancel).not.toContain('completed');

    service.disconnect();
  });

  // ─── 9. Canonical receive: pause routes through transfer manager ──────────

  it('canonical pause message is routed to transfer manager (not rejected)', () => {
    const progressUpdates: any[] = [];
    const service = createService(vi.fn(), vi.fn(), (p: any) => progressUpdates.push(p));
    attachDataChannel(service);
    (service as any).helloComplete = true;
    (service as any).sessionState = 'active';
    // Set up an active transfer so filename can be resolved
    (service as any).sendTransferIds.set('test.bin', TID);

    // Simulate canonical pause message arriving
    (service as any).transfer.routeInnerMessage({
      type: 'pause',
      transferId: TID,
    });

    expect((service as any).transferPaused).toBe(true);
    expect(progressUpdates.some((p: any) => p.status === 'paused')).toBe(true);

    service.disconnect();
  });

  it('canonical resume message is routed to transfer manager', () => {
    const service = createService();
    attachDataChannel(service);
    (service as any).transferPaused = true;
    (service as any).sendTransferIds.set('test.bin', TID);

    (service as any).transfer.routeInnerMessage({
      type: 'resume',
      transferId: TID,
    });

    expect((service as any).transferPaused).toBe(false);

    service.disconnect();
  });

  it('canonical cancel message is routed to transfer manager', () => {
    const service = createService();
    attachDataChannel(service);
    (service as any).sendTransferIds.set('test.bin', TID);

    (service as any).transfer.routeInnerMessage({
      type: 'cancel',
      transferId: TID,
      cancelledBy: 'receiver',
    });

    expect((service as any).transferCancelled).toBe(true);

    service.disconnect();
  });

  // ─── 10. handleMessage gates: canonical types accepted, unknown rejected ──

  it('handleMessage accepts canonical pause in plaintext (non-envelope session)', () => {
    const service = createService();
    const { injectMessage } = attachDataChannel(service);
    (service as any).helloComplete = true;
    (service as any).sessionState = 'active';
    (service as any).sendTransferIds.set('test.bin', TID);

    // Inject canonical pause — should NOT disconnect
    injectMessage({ type: 'pause', transferId: TID });

    expect((service as any).transferPaused).toBe(true);
    // Service should still be alive (not disconnected)
    expect((service as any).dc).not.toBeNull();

    service.disconnect();
  });

  it('handleMessage rejects canonical control missing transferId', () => {
    const onError = vi.fn();
    const service = createService(vi.fn(), onError);
    const { sentMessages, injectMessage } = attachDataChannel(service);
    (service as any).helloComplete = true;
    (service as any).sessionState = 'active';

    injectMessage({ type: 'pause' }); // no transferId

    // Should have sent an error and disconnected
    const errorMsg = sentMessages.find(m => JSON.parse(m).type === 'error');
    expect(errorMsg).toBeDefined();
    const parsed = JSON.parse(errorMsg!);
    expect(parsed.code).toBe('INVALID_MESSAGE');
  });

  // ─── 11. CBTR-F1: Receiver-initiated pause/resume ──────────────────────────

  it('receiver pauseTransfer looks up recvTransferIds and sends canonical pause', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);
    // Receiver has recvTransferIds, NOT sendTransferIds
    (service as any).recvTransferIds.set('incoming.bin', TID);

    service.pauseTransfer('incoming.bin', true);

    expect(sentMessages.length).toBe(1);
    const msg = JSON.parse(sentMessages[0]);
    expect(msg.type).toBe('pause');
    expect(msg.transferId).toBe(TID);

    service.disconnect();
  });

  it('receiver resumeTransfer looks up recvTransferIds and sends canonical resume', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);
    (service as any).recvTransferIds.set('incoming.bin', TID);
    (service as any).transferPaused = true;

    service.resumeTransfer('incoming.bin', true);

    expect(sentMessages.length).toBe(1);
    const msg = JSON.parse(sentMessages[0]);
    expect(msg.type).toBe('resume');
    expect(msg.transferId).toBe(TID);
    expect((service as any).transferPaused).toBe(false);

    service.disconnect();
  });

  it('receiver pauseTransfer fails gracefully when only sendTransferIds exist', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);
    // Only sender map has the file — receiver lookup should miss
    (service as any).sendTransferIds.set('outgoing.bin', TID);

    service.pauseTransfer('outgoing.bin', true);

    // No message sent — isReceiver=true checks recvTransferIds, not sendTransferIds
    expect(sentMessages.length).toBe(0);

    service.disconnect();
  });

  it('receiver resumeTransfer fails gracefully when only sendTransferIds exist', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);
    (service as any).sendTransferIds.set('outgoing.bin', TID);

    service.resumeTransfer('outgoing.bin', true);

    expect(sentMessages.length).toBe(0);

    service.disconnect();
  });

  it('sender pauseTransfer still works (isReceiver defaults to false)', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);
    (service as any).sendTransferIds.set('test.bin', TID);

    // No isReceiver argument — defaults to false (sender)
    service.pauseTransfer('test.bin');

    expect(sentMessages.length).toBe(1);
    const msg = JSON.parse(sentMessages[0]);
    expect(msg.type).toBe('pause');
    expect(msg.transferId).toBe(TID);

    service.disconnect();
  });

  it('sender resumeTransfer still works (isReceiver defaults to false)', () => {
    const service = createService();
    const { sentMessages } = attachDataChannel(service);
    (service as any).sendTransferIds.set('test.bin', TID);

    service.resumeTransfer('test.bin');

    expect(sentMessages.length).toBe(1);
    const msg = JSON.parse(sentMessages[0]);
    expect(msg.type).toBe('resume');
    expect(msg.transferId).toBe(TID);

    service.disconnect();
  });
});
