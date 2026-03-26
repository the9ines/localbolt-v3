/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const __wbg_wasmprogressresult_free: (a: number, b: number) => void;
export const __wbg_wasmscheduledecision_free: (a: number, b: number) => void;
export const __wbg_wasmstallresult_free: (a: number, b: number) => void;
export const policyDecide: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
export const policyDetectStall: (a: bigint, b: bigint, c: bigint, d: bigint, e: bigint) => number;
export const policyProgressCadence: (a: bigint, b: bigint, c: bigint, d: number, e: bigint, f: number) => number;
export const wasmprogressresult_bytesTransferred: (a: number) => bigint;
export const wasmprogressresult_percent: (a: number) => number;
export const wasmprogressresult_shouldEmit: (a: number) => number;
export const wasmprogressresult_totalBytes: (a: number) => bigint;
export const wasmscheduledecision_backpressure: (a: number) => number;
export const wasmscheduledecision_chunkCount: (a: number) => number;
export const wasmscheduledecision_effectiveChunkSize: (a: number) => number;
export const wasmscheduledecision_nextChunkIds: (a: number) => any;
export const wasmscheduledecision_pacingDelayMs: (a: number) => number;
export const wasmscheduledecision_windowSuggestionChunks: (a: number) => number;
export const wasmstallresult_tag: (a: number) => number;
export const wasmstallresult_msSinceProgress: (a: number) => bigint;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_start: () => void;
