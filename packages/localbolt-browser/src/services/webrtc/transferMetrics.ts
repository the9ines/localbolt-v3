// ─── Transfer Metrics — S2B Instrumentation ─────────────────────────────────
//
// Passive observability for the transfer path. No behavior change.
// Feature-gated via ENABLE_TRANSFER_METRICS (default OFF).
// No external dependencies. No timers. No async edges.

// ─── Feature Flag ────────────────────────────────────────────────────────────

// PF2: default ON for baseline collection. Revert to false after PF2.
export let ENABLE_TRANSFER_METRICS = true;

export function setTransferMetricsEnabled(enabled: boolean): void {
  ENABLE_TRANSFER_METRICS = enabled;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const STALL_THRESHOLD_MS = 500;
export const MAX_STALL_EVENTS = 100;
export const RING_BUFFER_CAPACITY = 500;

// ─── RingBuffer ──────────────────────────────────────────────────────────────

export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private count = 0;

  constructor(private readonly capacity: number) {
    if (capacity <= 0) throw new Error('capacity must be > 0');
    this.buffer = new Array(capacity);
  }

  push(value: T): void {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count += 1;
  }

  toArray(): T[] {
    const out: T[] = [];
    if (this.count === 0) return out;
    const start = (this.head - this.count + this.capacity) % this.capacity;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      const v = this.buffer[idx];
      if (v !== undefined) out.push(v);
    }
    return out;
  }

  get length(): number {
    return this.count;
  }

  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.count = 0;
  }
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface StallEvent {
  timestampMs: number;
  durationMs: number;
  bufferedAmount: number;
  chunksSent: number;
}

/**
 * Tail-window semantics:
 * - perChunkIntervalsMs and bufferedAmountSamples are ring buffers (capacity 500).
 * - Summary percentiles/median are computed over the tail window, not the full transfer.
 */
export interface TransferMetrics {
  transferId: string;
  fileSizeBytes: number;
  chunkSizeBytes: number;
  chunksTotal: number;

  startTimestampMs: number;
  firstChunkSentMs: number | null;
  firstProgressMs: number | null;
  endTimestampMs: number | null;

  perChunkIntervalsMs: RingBuffer<number>;
  bufferedAmountSamples: RingBuffer<number>;
  stallEvents: StallEvent[];
}

export interface TransferSummary {
  transferId: string;
  fileSizeBytes: number;
  chunksTotal: number;
  totalTimeMs: number;
  timeToFirstChunkMs: number | null;
  timeToFirstProgressMs: number | null;

  medianChunkIntervalMs: number | null;
  p95ChunkIntervalMs: number | null;
  maxBufferedAmount: number;

  stallCount: number;
  totalStallTimeMs: number;

  effectiveThroughputMbps: number;

  tailWindowSize: number;
}

// ─── TransferMetricsCollector ────────────────────────────────────────────────

export class TransferMetricsCollector {
  private metrics: TransferMetrics | null = null;
  private lastChunkSendTimestampMs = 0;
  private awaitingBufferDrain = false;
  private isPaused = false;

  begin(transferId: string, fileSizeBytes: number, chunkSizeBytes: number, chunksTotal: number): void {
    this.metrics = {
      transferId,
      fileSizeBytes,
      chunkSizeBytes,
      chunksTotal,
      startTimestampMs: Date.now(),
      firstChunkSentMs: null,
      firstProgressMs: null,
      endTimestampMs: null,
      perChunkIntervalsMs: new RingBuffer<number>(RING_BUFFER_CAPACITY),
      bufferedAmountSamples: new RingBuffer<number>(RING_BUFFER_CAPACITY),
      stallEvents: [],
    };
    this.lastChunkSendTimestampMs = 0;
    this.awaitingBufferDrain = false;
    this.isPaused = false;
  }

  recordChunkSend(bufferedAmount: number, chunksSent: number): void {
    if (!this.metrics) return;
    const now = Date.now();

    if (this.metrics.firstChunkSentMs === null) {
      this.metrics.firstChunkSentMs = now;
    }

    this.metrics.bufferedAmountSamples.push(bufferedAmount);

    if (this.lastChunkSendTimestampMs > 0) {
      const interval = now - this.lastChunkSendTimestampMs;
      this.metrics.perChunkIntervalsMs.push(interval);

      if (
        interval > STALL_THRESHOLD_MS &&
        !this.isPaused &&
        !this.awaitingBufferDrain &&
        this.metrics.stallEvents.length < MAX_STALL_EVENTS
      ) {
        this.metrics.stallEvents.push({
          timestampMs: now,
          durationMs: interval,
          bufferedAmount,
          chunksSent,
        });
      }
    }

    this.lastChunkSendTimestampMs = now;
  }

  enterBufferDrainWait(): void {
    this.awaitingBufferDrain = true;
  }

  exitBufferDrainWait(): void {
    this.awaitingBufferDrain = false;
    // Reset timestamp so the drain-wait interval is not counted as a stall
    this.lastChunkSendTimestampMs = Date.now();
  }

  markPaused(): void {
    this.isPaused = true;
  }

  markResumed(): void {
    this.isPaused = false;
    // Reset timestamp so the paused interval is not counted as a stall
    this.lastChunkSendTimestampMs = Date.now();
  }

  recordFirstProgress(): void {
    if (this.metrics && this.metrics.firstProgressMs === null) {
      this.metrics.firstProgressMs = Date.now();
    }
  }

  finish(): TransferMetrics | null {
    if (!this.metrics) return null;
    if (this.metrics.endTimestampMs === null) {
      this.metrics.endTimestampMs = Date.now();
    }
    const snapshot = this.metrics;
    this.metrics = null;
    this.lastChunkSendTimestampMs = 0;
    this.awaitingBufferDrain = false;
    this.isPaused = false;
    return snapshot;
  }

  reset(): void {
    this.metrics = null;
    this.lastChunkSendTimestampMs = 0;
    this.awaitingBufferDrain = false;
    this.isPaused = false;
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function summarizeTransfer(metrics: TransferMetrics): TransferSummary {
  const totalTimeMs = (metrics.endTimestampMs ?? metrics.startTimestampMs) - metrics.startTimestampMs;

  const intervals = metrics.perChunkIntervalsMs.toArray().slice().sort((a, b) => a - b);
  const buffered = metrics.bufferedAmountSamples.toArray();

  const timeToFirstChunkMs = metrics.firstChunkSentMs !== null
    ? metrics.firstChunkSentMs - metrics.startTimestampMs
    : null;

  const timeToFirstProgressMs = metrics.firstProgressMs !== null
    ? metrics.firstProgressMs - metrics.startTimestampMs
    : null;

  const maxBufferedAmount = buffered.length > 0
    ? Math.max(...buffered)
    : 0;

  const totalStallTimeMs = metrics.stallEvents.reduce((sum, e) => sum + e.durationMs, 0);

  const effectiveThroughputMbps = totalTimeMs > 0
    ? (metrics.fileSizeBytes * 8) / (totalTimeMs / 1000) / 1_000_000
    : 0;

  return {
    transferId: metrics.transferId,
    fileSizeBytes: metrics.fileSizeBytes,
    chunksTotal: metrics.chunksTotal,
    totalTimeMs,
    timeToFirstChunkMs,
    timeToFirstProgressMs,
    medianChunkIntervalMs: median(intervals),
    p95ChunkIntervalMs: percentile(intervals, 95),
    maxBufferedAmount,
    stallCount: metrics.stallEvents.length,
    totalStallTimeMs,
    effectiveThroughputMbps,
    tailWindowSize: metrics.perChunkIntervalsMs.length,
  };
}
