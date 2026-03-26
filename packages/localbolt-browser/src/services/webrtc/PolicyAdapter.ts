/**
 * PolicyAdapter — bridges Rust WASM policy decisions to the TS transport layer.
 *
 * Two implementations:
 * - WasmPolicyAdapter: calls compiled Rust policy via wasm-bindgen exports.
 * - TsFallbackPolicyAdapter: replicates current TransferManager behavior
 *   exactly — sequential send (all pending chunks returned in order),
 *   no pacing delay, progress emitted every call, stall always healthy.
 *
 * The factory attempts WASM init; on failure, silently falls back to TS.
 */

// ─── Public types ─────────────────────────────────────────────────────

export type BackpressureSignal = 'pause' | 'resume' | 'no-change';

export type StallTag = 'healthy' | 'warning' | 'stalled' | 'complete';

export interface ScheduleDecision {
  /** Chunk IDs to send this round (ordered). */
  nextChunkIds: Uint32Array;
  /** Suggested delay (ms) before next decision round. */
  pacingDelayMs: number;
  /** Suggested send window size in chunks. */
  windowSuggestionChunks: number;
  /** Backpressure signal. */
  backpressure: BackpressureSignal;
  /** Effective chunk size after transport cap (bytes). */
  effectiveChunkSize: number;
}

export interface StallResult {
  classification: StallTag;
  msSinceProgress: number;
}

export interface ProgressResult {
  shouldEmit: boolean;
  percent: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface PolicyDecideInput {
  pendingChunkIds: Uint32Array;
  rttMs: number;
  lossPpm: number;
  deviceClass: number;   // 0=Desktop, 1=Mobile, 2=LowPower, 3=Unknown
  maxParallelChunks: number;
  maxInFlightBytes: number;
  priority: number;
  fairnessMode: number;  // 0=Balanced, 1=Throughput, 2=Latency
  configuredChunkSize: number;
  transportMaxMessageSize: number;
  pressure: number;      // 0=Clear, 1=Elevated, 2=Pressured
}

export interface StallDetectInput {
  bytesAcked: number;
  totalBytes: number;
  msSinceProgress: number;
  stallThresholdMs: number;
  warnThresholdMs: number;
}

export interface ProgressCadenceInput {
  bytesTransferred: number;
  totalBytes: number;
  elapsedSinceLastReportMs: number;
  lastReportedPercent: number;
  minIntervalMs: number;
  minPercentDelta: number;
}

// ─── PolicyAdapter interface ──────────────────────────────────────────

export interface PolicyAdapter {
  /** Name of this adapter implementation (for logging). */
  readonly name: string;

  /** Compute a scheduling decision. */
  decide(input: PolicyDecideInput): ScheduleDecision;

  /** Classify stall state. */
  detectStall(input: StallDetectInput): StallResult;

  /** Determine whether a progress event should be emitted. */
  progressCadence(input: ProgressCadenceInput): ProgressResult;
}

// ─── WASM adapter ─────────────────────────────────────────────────────

const STALL_TAGS: StallTag[] = ['healthy', 'warning', 'stalled', 'complete'];

const BACKPRESSURE_SIGNALS: BackpressureSignal[] = ['pause', 'resume', 'no-change'];

/**
 * WasmPolicyAdapter — delegates to compiled Rust policy via wasm-bindgen.
 *
 * Constructed by PolicyAdapterFactory after successful WASM init.
 */
class WasmPolicyAdapter implements PolicyAdapter {
  readonly name = 'wasm';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private wasm: any) {}

  decide(input: PolicyDecideInput): ScheduleDecision {
    const result = this.wasm.policyDecide(
      input.pendingChunkIds,
      input.rttMs,
      input.lossPpm,
      input.deviceClass,
      input.maxParallelChunks,
      input.maxInFlightBytes,
      input.priority,
      input.fairnessMode,
      input.configuredChunkSize,
      input.transportMaxMessageSize,
      input.pressure,
    );

    const decision: ScheduleDecision = {
      nextChunkIds: result.nextChunkIds(),
      pacingDelayMs: result.pacingDelayMs,
      windowSuggestionChunks: result.windowSuggestionChunks,
      backpressure: BACKPRESSURE_SIGNALS[result.backpressure] ?? 'no-change',
      effectiveChunkSize: result.effectiveChunkSize,
    };

    result.free();
    return decision;
  }

  detectStall(input: StallDetectInput): StallResult {
    const result = this.wasm.policyDetectStall(
      BigInt(input.bytesAcked),
      BigInt(input.totalBytes),
      BigInt(input.msSinceProgress),
      BigInt(input.stallThresholdMs),
      BigInt(input.warnThresholdMs),
    );

    const stall: StallResult = {
      classification: STALL_TAGS[result.tag] ?? 'healthy',
      msSinceProgress: Number(result.msSinceProgress),
    };

    result.free();
    return stall;
  }

  progressCadence(input: ProgressCadenceInput): ProgressResult {
    const result = this.wasm.policyProgressCadence(
      BigInt(input.bytesTransferred),
      BigInt(input.totalBytes),
      BigInt(input.elapsedSinceLastReportMs),
      input.lastReportedPercent,
      BigInt(input.minIntervalMs),
      input.minPercentDelta,
    );

    const progress: ProgressResult = {
      shouldEmit: result.shouldEmit,
      percent: result.percent,
      bytesTransferred: Number(result.bytesTransferred),
      totalBytes: Number(result.totalBytes),
    };

    result.free();
    return progress;
  }
}

// ─── TS fallback adapter ──────────────────────────────────────────────

/**
 * TsFallbackPolicyAdapter — replicates exact current TransferManager behavior.
 *
 * Current behavior (TransferManager.sendFile, lines 151-224):
 * - Sequential loop: sends ALL pending chunks in order, one per iteration.
 * - No windowing: every pending chunk is returned (no max_parallel_chunks cap).
 * - No pacing delay: chunks sent back-to-back (0ms pacing).
 * - Backpressure: handled separately by DC bufferedAmount check, not by policy.
 *   Policy always returns 'no-change'.
 * - Effective chunk size: uses configured chunk size (DEFAULT_CHUNK_SIZE = 16384),
 *   no transport cap applied at policy level.
 * - Progress: emitted after every chunk (no cadence gating).
 * - Stall detection: not present in current send path (always healthy).
 *
 * This fallback guarantees zero behavioral regression when WASM is unavailable.
 */
class TsFallbackPolicyAdapter implements PolicyAdapter {
  readonly name = 'ts-fallback';

  decide(input: PolicyDecideInput): ScheduleDecision {
    // Current behavior: send all pending chunks sequentially.
    // The loop processes one chunk at a time, but the policy returns all of them.
    // The caller (TransferManager) still loops through them one by one.
    return {
      nextChunkIds: input.pendingChunkIds,
      pacingDelayMs: 0,
      windowSuggestionChunks: input.pendingChunkIds.length,
      backpressure: 'no-change',
      effectiveChunkSize: input.configuredChunkSize,
    };
  }

  detectStall(_input: StallDetectInput): StallResult {
    // Current behavior: no stall detection in send path.
    return {
      classification: 'healthy',
      msSinceProgress: 0,
    };
  }

  progressCadence(input: ProgressCadenceInput): ProgressResult {
    // Current behavior: emit progress after every chunk, no gating.
    const percent = input.totalBytes > 0
      ? Math.min(Math.floor((input.bytesTransferred / input.totalBytes) * 100), 100)
      : 0;

    return {
      shouldEmit: true,
      percent,
      bytesTransferred: input.bytesTransferred,
      totalBytes: input.totalBytes,
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────

let activeAdapter: PolicyAdapter | null = null;

/**
 * Initialize the policy adapter. Attempts WASM, falls back to TS.
 *
 * Safe to call multiple times — returns cached adapter after first init.
 */
export async function initPolicyAdapter(): Promise<PolicyAdapter> {
  if (activeAdapter) return activeAdapter;

  try {
    // Dynamic import — bundlers will code-split the WASM binary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wasm = await import('../../../wasm/bolt_transfer_policy_wasm.js' as any);
    console.log('[POLICY] WASM glue loaded, calling init...');
    await wasm.default();
    activeAdapter = new WasmPolicyAdapter(wasm);
    console.log('[POLICY] WASM policy adapter initialized');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[POLICY] WASM load failed (${msg}), using TS fallback`);
    activeAdapter = new TsFallbackPolicyAdapter();
  }

  return activeAdapter;
}

/**
 * Get the current policy adapter (fallback if not yet initialized).
 *
 * Synchronous — returns the TS fallback if WASM hasn't been loaded yet.
 * Use `initPolicyAdapter()` at startup, then `getPolicyAdapter()` in hot paths.
 */
export function getPolicyAdapter(): PolicyAdapter {
  if (!activeAdapter) {
    activeAdapter = new TsFallbackPolicyAdapter();
  }
  return activeAdapter;
}

/**
 * Force the adapter to a specific implementation (for testing).
 */
export function setPolicyAdapter(adapter: PolicyAdapter): void {
  activeAdapter = adapter;
}

/**
 * Reset the adapter to null (for testing teardown).
 */
export function resetPolicyAdapter(): void {
  activeAdapter = null;
}
