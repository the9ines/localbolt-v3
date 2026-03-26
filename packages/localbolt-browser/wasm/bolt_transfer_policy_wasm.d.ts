/* tslint:disable */
/* eslint-disable */

/**
 * Backpressure signal output.
 */
export enum WasmBackpressure {
    Pause = 0,
    Resume = 1,
    NoChange = 2,
}

/**
 * Device performance tier.
 */
export enum WasmDeviceClass {
    Desktop = 0,
    Mobile = 1,
    LowPower = 2,
    Unknown = 3,
}

/**
 * Scheduling fairness mode.
 */
export enum WasmFairnessMode {
    Balanced = 0,
    Throughput = 1,
    Latency = 2,
}

/**
 * Backpressure state input.
 */
export enum WasmPressureState {
    Clear = 0,
    Elevated = 1,
    Pressured = 2,
}

/**
 * Progress cadence result — returned from `policy_progress_cadence`.
 *
 * `should_emit` is true when both time and percentage thresholds are met.
 */
export class WasmProgressResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Bytes transferred so far.
     */
    readonly bytesTransferred: bigint;
    /**
     * Percentage complete (0-100).
     */
    readonly percent: number;
    /**
     * Whether a progress event should be emitted.
     */
    readonly shouldEmit: boolean;
    /**
     * Total bytes in transfer.
     */
    readonly totalBytes: bigint;
}

/**
 * Schedule decision result — returned from `policy_decide`.
 *
 * `next_chunk_ids` is accessed via the `next_chunk_ids()` method
 * which returns a `Uint32Array`.
 */
export class WasmScheduleDecision {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Chunk IDs to send this round, as a Uint32Array.
     */
    nextChunkIds(): Uint32Array;
    /**
     * Backpressure signal.
     */
    readonly backpressure: WasmBackpressure;
    /**
     * Number of chunk IDs in this round.
     */
    readonly chunkCount: number;
    /**
     * Effective chunk size after transport cap (bytes).
     */
    readonly effectiveChunkSize: number;
    /**
     * Suggested delay (ms) before next decision round.
     */
    readonly pacingDelayMs: number;
    /**
     * Suggested send window size in chunks.
     */
    readonly windowSuggestionChunks: number;
}

/**
 * Stall detection result — returned from `policy_detect_stall`.
 *
 * Flattened DTO for the `StallClassification` enum (wasm-bindgen
 * does not support enums with data payloads).
 *
 * Tag values: 0 = Healthy, 1 = Warning, 2 = Stalled, 3 = Complete.
 */
export class WasmStallResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Milliseconds since progress (meaningful for tag 1 and 2).
     */
    readonly msSinceProgress: bigint;
    /**
     * Classification tag: 0=Healthy, 1=Warning, 2=Stalled, 3=Complete.
     */
    readonly tag: number;
}

/**
 * Compute a scheduling decision from flattened policy inputs.
 *
 * Accepts `pending_chunk_ids` as a `&[u32]` (maps from JS Uint32Array).
 * All other parameters are scalar/enum.
 */
export function policyDecide(pending_chunk_ids: Uint32Array, rtt_ms: number, loss_ppm: number, device_class: WasmDeviceClass, max_parallel_chunks: number, max_in_flight_bytes: number, priority: number, fairness_mode: WasmFairnessMode, configured_chunk_size: number, transport_max_message_size: number, pressure: WasmPressureState): WasmScheduleDecision;

/**
 * Classify the current stall state of a transfer.
 */
export function policyDetectStall(bytes_acked: bigint, total_bytes: bigint, ms_since_progress: bigint, stall_threshold_ms: bigint, warn_threshold_ms: bigint): WasmStallResult;

/**
 * Determine whether a progress event should be emitted.
 */
export function policyProgressCadence(bytes_transferred: bigint, total_bytes: bigint, elapsed_since_last_report_ms: bigint, last_reported_percent: number, min_interval_ms: bigint, min_percent_delta: number): WasmProgressResult;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmprogressresult_free: (a: number, b: number) => void;
    readonly __wbg_wasmscheduledecision_free: (a: number, b: number) => void;
    readonly __wbg_wasmstallresult_free: (a: number, b: number) => void;
    readonly policyDecide: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
    readonly policyDetectStall: (a: bigint, b: bigint, c: bigint, d: bigint, e: bigint) => number;
    readonly policyProgressCadence: (a: bigint, b: bigint, c: bigint, d: number, e: bigint, f: number) => number;
    readonly wasmprogressresult_bytesTransferred: (a: number) => bigint;
    readonly wasmprogressresult_percent: (a: number) => number;
    readonly wasmprogressresult_shouldEmit: (a: number) => number;
    readonly wasmprogressresult_totalBytes: (a: number) => bigint;
    readonly wasmscheduledecision_backpressure: (a: number) => number;
    readonly wasmscheduledecision_chunkCount: (a: number) => number;
    readonly wasmscheduledecision_effectiveChunkSize: (a: number) => number;
    readonly wasmscheduledecision_nextChunkIds: (a: number) => any;
    readonly wasmscheduledecision_pacingDelayMs: (a: number) => number;
    readonly wasmscheduledecision_windowSuggestionChunks: (a: number) => number;
    readonly wasmstallresult_tag: (a: number) => number;
    readonly wasmstallresult_msSinceProgress: (a: number) => bigint;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
