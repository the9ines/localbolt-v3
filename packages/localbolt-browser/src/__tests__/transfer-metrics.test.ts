// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RingBuffer,
  TransferMetricsCollector,
  summarizeTransfer,
  ENABLE_TRANSFER_METRICS,
  setTransferMetricsEnabled,
  STALL_THRESHOLD_MS,
  MAX_STALL_EVENTS,
  RING_BUFFER_CAPACITY,
} from '../services/webrtc/transferMetrics.js';
import type { TransferMetrics } from '../services/webrtc/transferMetrics.js';
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
  return { dc, sentMessages };
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

// ─── Date.now mock helper ────────────────────────────────────────────────────

let mockTime = 1000;
let dateNowSpy: ReturnType<typeof vi.spyOn>;

function setMockTime(ms: number) {
  mockTime = ms;
}

function advanceMockTime(ms: number) {
  mockTime += ms;
}

// ─── RingBuffer Tests ────────────────────────────────────────────────────────

describe('RingBuffer', () => {
  it('1. push within capacity preserves insertion order', () => {
    const rb = new RingBuffer<number>(5);
    rb.push(10);
    rb.push(20);
    rb.push(30);
    expect(rb.toArray()).toEqual([10, 20, 30]);
    expect(rb.length).toBe(3);
  });

  it('2. push beyond capacity evicts oldest', () => {
    const rb = new RingBuffer<number>(3);
    rb.push(1);
    rb.push(2);
    rb.push(3);
    rb.push(4);
    expect(rb.toArray()).toEqual([2, 3, 4]);
    expect(rb.length).toBe(3);
  });

  it('3. toArray correct after wraparound', () => {
    const rb = new RingBuffer<number>(3);
    rb.push(1);
    rb.push(2);
    rb.push(3);
    rb.push(4);
    rb.push(5);
    expect(rb.toArray()).toEqual([3, 4, 5]);
  });

  it('4. clear resets state', () => {
    const rb = new RingBuffer<number>(5);
    rb.push(1);
    rb.push(2);
    rb.clear();
    expect(rb.toArray()).toEqual([]);
    expect(rb.length).toBe(0);
    rb.push(99);
    expect(rb.toArray()).toEqual([99]);
  });

  it('5. empty buffer returns [], length 0', () => {
    const rb = new RingBuffer<number>(10);
    expect(rb.toArray()).toEqual([]);
    expect(rb.length).toBe(0);
  });
});

// ─── TransferMetricsCollector Tests ──────────────────────────────────────────

describe('TransferMetricsCollector', () => {
  beforeEach(() => {
    mockTime = 1000;
    dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => mockTime);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('6. begin initializes fields correctly', () => {
    const c = new TransferMetricsCollector();
    c.begin('tid-1', 100000, 16384, 7);
    const m = c.finish();
    expect(m).not.toBeNull();
    expect(m!.transferId).toBe('tid-1');
    expect(m!.fileSizeBytes).toBe(100000);
    expect(m!.chunkSizeBytes).toBe(16384);
    expect(m!.chunksTotal).toBe(7);
    expect(m!.startTimestampMs).toBe(1000);
    expect(m!.firstChunkSentMs).toBeNull();
    expect(m!.firstProgressMs).toBeNull();
    expect(m!.stallEvents).toEqual([]);
  });

  it('7. recordChunkSend records intervals between consecutive calls', () => {
    const c = new TransferMetricsCollector();
    c.begin('tid-2', 50000, 16384, 4);

    setMockTime(1000);
    c.recordChunkSend(0, 1);  // first chunk — no interval
    advanceMockTime(50);
    c.recordChunkSend(0, 2);  // interval: 50ms
    advanceMockTime(100);
    c.recordChunkSend(0, 3);  // interval: 100ms

    const m = c.finish();
    expect(m!.perChunkIntervalsMs.toArray()).toEqual([50, 100]);
    expect(m!.firstChunkSentMs).toBe(1000);
  });

  it('8. recordChunkSend detects stall when interval > 500ms', () => {
    const c = new TransferMetricsCollector();
    c.begin('tid-3', 50000, 16384, 3);

    setMockTime(1000);
    c.recordChunkSend(0, 1);
    advanceMockTime(501); // 501ms gap — should stall
    c.recordChunkSend(100, 2);

    const m = c.finish();
    expect(m!.stallEvents.length).toBe(1);
    expect(m!.stallEvents[0].durationMs).toBe(501);
    expect(m!.stallEvents[0].bufferedAmount).toBe(100);
    expect(m!.stallEvents[0].chunksSent).toBe(2);
  });

  it('9. no stall during backpressure drain wait', () => {
    const c = new TransferMetricsCollector();
    c.begin('tid-4', 50000, 16384, 3);

    setMockTime(1000);
    c.recordChunkSend(0, 1);
    c.enterBufferDrainWait();
    advanceMockTime(600);
    c.exitBufferDrainWait();
    c.recordChunkSend(0, 2);

    const m = c.finish();
    expect(m!.stallEvents.length).toBe(0);
  });

  it('10. no stall while paused', () => {
    const c = new TransferMetricsCollector();
    c.begin('tid-5', 50000, 16384, 3);

    setMockTime(1000);
    c.recordChunkSend(0, 1);
    c.markPaused();
    advanceMockTime(2000);
    c.markResumed();
    c.recordChunkSend(0, 2);

    const m = c.finish();
    expect(m!.stallEvents.length).toBe(0);
  });

  it('11. threshold boundary: 499 no stall, 500 no stall, 501 stall', () => {
    // 499ms — no stall
    const c1 = new TransferMetricsCollector();
    c1.begin('tid-b1', 50000, 16384, 3);
    setMockTime(1000);
    c1.recordChunkSend(0, 1);
    advanceMockTime(499);
    c1.recordChunkSend(0, 2);
    expect(c1.finish()!.stallEvents.length).toBe(0);

    // 500ms — no stall (> not >=)
    const c2 = new TransferMetricsCollector();
    c2.begin('tid-b2', 50000, 16384, 3);
    setMockTime(1000);
    c2.recordChunkSend(0, 1);
    advanceMockTime(500);
    c2.recordChunkSend(0, 2);
    expect(c2.finish()!.stallEvents.length).toBe(0);

    // 501ms — stall
    const c3 = new TransferMetricsCollector();
    c3.begin('tid-b3', 50000, 16384, 3);
    setMockTime(1000);
    c3.recordChunkSend(0, 1);
    advanceMockTime(501);
    c3.recordChunkSend(0, 2);
    expect(c3.finish()!.stallEvents.length).toBe(1);
  });

  it('12. finish returns snapshot and clears state', () => {
    const c = new TransferMetricsCollector();
    c.begin('tid-6', 50000, 16384, 4);
    setMockTime(1000);
    c.recordChunkSend(0, 1);
    advanceMockTime(50);

    const m = c.finish();
    expect(m).not.toBeNull();
    expect(m!.endTimestampMs).toBe(1050);

    // Second finish returns null (state cleared)
    expect(c.finish()).toBeNull();
  });

  it('13. reset clears state, subsequent finish returns null', () => {
    const c = new TransferMetricsCollector();
    c.begin('tid-7', 50000, 16384, 4);
    c.recordChunkSend(0, 1);
    c.reset();
    expect(c.finish()).toBeNull();
  });
});

// ─── summarizeTransfer Tests ─────────────────────────────────────────────────

describe('summarizeTransfer', () => {
  beforeEach(() => {
    mockTime = 1000;
    dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => mockTime);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('14. computes totalTimeMs, throughput, median correctly', () => {
    const c = new TransferMetricsCollector();
    c.begin('tid-s1', 1_000_000, 16384, 62);

    setMockTime(1000);
    c.recordChunkSend(0, 1);
    advanceMockTime(10);
    c.recordChunkSend(0, 2);
    advanceMockTime(20);
    c.recordChunkSend(0, 3);
    advanceMockTime(10);
    c.recordChunkSend(0, 4);

    advanceMockTime(960); // total = 2000ms from start
    const m = c.finish()!;

    const s = summarizeTransfer(m);
    expect(s.transferId).toBe('tid-s1');
    expect(s.totalTimeMs).toBe(1000);
    expect(s.medianChunkIntervalMs).toBe(10); // sorted: [10, 10, 20] → median = 10
    expect(s.effectiveThroughputMbps).toBeCloseTo(8.0, 1); // 1MB * 8 / 1s / 1M = 8 Mbps
  });

  it('15. p95 with known distribution', () => {
    const c = new TransferMetricsCollector();
    c.begin('tid-s2', 100000, 16384, 21);

    setMockTime(1000);
    c.recordChunkSend(0, 1);
    // Push 20 intervals: 1,2,3,...,20
    for (let i = 1; i <= 20; i++) {
      advanceMockTime(i);
      c.recordChunkSend(0, i + 1);
    }

    const m = c.finish()!;
    const s = summarizeTransfer(m);
    // p95 of [1..20]: ceil(0.95*20)-1 = 19-1 = 18, sorted[18] = 19
    expect(s.p95ChunkIntervalMs).toBe(19);
  });

  it('16. single-chunk case: median/p95 null if no intervals', () => {
    const c = new TransferMetricsCollector();
    c.begin('tid-s3', 1000, 16384, 1);

    setMockTime(1000);
    c.recordChunkSend(0, 1);
    advanceMockTime(100);

    const m = c.finish()!;
    const s = summarizeTransfer(m);
    expect(s.medianChunkIntervalMs).toBeNull();
    expect(s.p95ChunkIntervalMs).toBeNull();
    expect(s.tailWindowSize).toBe(0);
  });

  it('17. zero-duration case: throughput 0, no division by zero', () => {
    const c = new TransferMetricsCollector();
    c.begin('tid-s4', 100000, 16384, 5);
    // finish immediately — 0ms duration
    const m = c.finish()!;
    const s = summarizeTransfer(m);
    expect(s.totalTimeMs).toBe(0);
    expect(s.effectiveThroughputMbps).toBe(0);
  });

  it('18. tailWindowSize reflects occupancy, not capacity', () => {
    const c = new TransferMetricsCollector();
    c.begin('tid-s5', 100000, 16384, 10);

    setMockTime(1000);
    c.recordChunkSend(0, 1);
    advanceMockTime(10);
    c.recordChunkSend(0, 2);
    advanceMockTime(10);
    c.recordChunkSend(0, 3);

    const m = c.finish()!;
    const s = summarizeTransfer(m);
    expect(s.tailWindowSize).toBe(2); // 2 intervals (3 chunks - 1)
  });
});

// ─── Feature Flag Tests ──────────────────────────────────────────────────────

describe('Feature flag', () => {
  let WebRTCService: any;

  beforeEach(async () => {
    setTransferMetricsEnabled(false);
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  afterEach(() => {
    setTransferMetricsEnabled(false);
  });

  function createService() {
    const signaling = createMockSignaling();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());
    (service as any).remotePublicKey = new Uint8Array(32);
    (service as any).keyPair = { publicKey: new Uint8Array(32), secretKey: new Uint8Array(32) };
    (service as any).helloComplete = true;
    return service;
  }

  function attachDataChannel(service: any) {
    const { dc, sentMessages } = createMockDataChannel();
    service.dc = dc;
    return { dc, sentMessages };
  }

  it('19. Flag OFF: WebRTCService does not allocate collector during sendFile', async () => {
    setTransferMetricsEnabled(false);
    const service = createService();
    const { dc } = attachDataChannel(service);

    const file = createMockFile('test.bin', 16384);
    await service.sendFile(file);

    expect((service as any).metricsCollector).toBeNull();
  });

  it('20. Flag ON: collector allocated and summary logged', async () => {
    setTransferMetricsEnabled(true);
    const service = createService();
    const { dc } = attachDataChannel(service);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const file = createMockFile('test.bin', 16384);
    await service.sendFile(file);

    const metricsCalls = consoleSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0] === '[TRANSFER_METRICS]'
    );
    expect(metricsCalls.length).toBe(1);

    const summary = JSON.parse(metricsCalls[0][1]);
    expect(summary.fileSizeBytes).toBe(16384);
    expect(summary.chunksTotal).toBe(1);
    expect(typeof summary.totalTimeMs).toBe('number');
    expect(typeof summary.effectiveThroughputMbps).toBe('number');

    consoleSpy.mockRestore();
  });

  it('21. Flag OFF: no [TRANSFER_METRICS] output emitted', async () => {
    setTransferMetricsEnabled(false);
    const service = createService();
    attachDataChannel(service);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const file = createMockFile('test.bin', 16384);
    await service.sendFile(file);

    const metricsCalls = consoleSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0] === '[TRANSFER_METRICS]'
    );
    expect(metricsCalls.length).toBe(0);

    consoleSpy.mockRestore();
  });
});

// ─── Cleanup Tests ───────────────────────────────────────────────────────────

describe('Cleanup', () => {
  let WebRTCService: any;

  beforeEach(async () => {
    setTransferMetricsEnabled(true);
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  afterEach(() => {
    setTransferMetricsEnabled(false);
  });

  function createService() {
    const signaling = createMockSignaling();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());
    (service as any).remotePublicKey = new Uint8Array(32);
    (service as any).keyPair = { publicKey: new Uint8Array(32), secretKey: new Uint8Array(32) };
    (service as any).helloComplete = true;
    return service;
  }

  function attachDataChannel(service: any) {
    const { dc, sentMessages } = createMockDataChannel();
    service.dc = dc;
    return { dc, sentMessages };
  }

  it('22. disconnect clears metrics state', async () => {
    const service = createService();
    attachDataChannel(service);

    const file = createMockFile('test.bin', 32768); // 2 chunks
    // Start sendFile but disconnect mid-flight is hard to test synchronously.
    // Instead: manually set up collector state and verify disconnect clears it.
    (service as any).metricsCollector = new TransferMetricsCollector();
    (service as any).metricsCollector.begin('tid-dc', 32768, 16384, 2);
    (service as any).metricsFirstProgressRecorded = true;

    service.disconnect();

    expect((service as any).metricsCollector).toBeNull();
    expect((service as any).metricsFirstProgressRecorded).toBe(false);
  });

  it('23. error path clears metrics state', async () => {
    const service = createService();
    const { dc } = attachDataChannel(service);

    // Make dc.send throw to trigger error path
    dc.send = () => { throw new Error('send failed'); };
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const file = createMockFile('test.bin', 16384);
    await expect(service.sendFile(file)).rejects.toThrow();

    expect((service as any).metricsCollector).toBeNull();
    expect((service as any).metricsFirstProgressRecorded).toBe(false);

    consoleSpy.mockRestore();
  });
});

// ─── Integration Guard ───────────────────────────────────────────────────────

describe('Integration guard', () => {
  let WebRTCService: any;

  beforeEach(async () => {
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  afterEach(() => {
    setTransferMetricsEnabled(false);
  });

  function createService() {
    const signaling = createMockSignaling();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());
    (service as any).remotePublicKey = new Uint8Array(32);
    (service as any).keyPair = { publicKey: new Uint8Array(32), secretKey: new Uint8Array(32) };
    (service as any).helloComplete = true;
    return service;
  }

  function attachDataChannel(service: any) {
    const { dc, sentMessages } = createMockDataChannel();
    service.dc = dc;
    return { dc, sentMessages };
  }

  it('24. With flag OFF: sendFile produces identical chunk send sequence as baseline', async () => {
    // Run with flag OFF
    setTransferMetricsEnabled(false);
    const serviceOff = createService();
    const { sentMessages: msgsOff } = attachDataChannel(serviceOff);
    await serviceOff.sendFile(createMockFile('test.bin', 32768)); // 2 chunks

    // Run with flag ON
    setTransferMetricsEnabled(true);
    const serviceOn = createService();
    const { sentMessages: msgsOn } = attachDataChannel(serviceOn);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await serviceOn.sendFile(createMockFile('test.bin', 32768)); // 2 chunks
    vi.restoreAllMocks();

    // Both must produce the same dcSendMessage calls (same JSON payloads, same order)
    expect(msgsOff.length).toBe(msgsOn.length);
    for (let i = 0; i < msgsOff.length; i++) {
      const off = JSON.parse(msgsOff[i]);
      const on = JSON.parse(msgsOn[i]);
      // Compare message type, filename, chunkIndex, totalChunks — not transferId (random)
      expect(off.type).toBe(on.type);
      expect(off.filename).toBe(on.filename);
      expect(off.chunkIndex).toBe(on.chunkIndex);
      expect(off.totalChunks).toBe(on.totalChunks);
    }
  });
});
