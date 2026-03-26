/* @ts-self-types="./bolt_transfer_policy_wasm.d.ts" */

/**
 * Backpressure signal output.
 * @enum {0 | 1 | 2}
 */
export const WasmBackpressure = Object.freeze({
    Pause: 0, "0": "Pause",
    Resume: 1, "1": "Resume",
    NoChange: 2, "2": "NoChange",
});

/**
 * Device performance tier.
 * @enum {0 | 1 | 2 | 3}
 */
export const WasmDeviceClass = Object.freeze({
    Desktop: 0, "0": "Desktop",
    Mobile: 1, "1": "Mobile",
    LowPower: 2, "2": "LowPower",
    Unknown: 3, "3": "Unknown",
});

/**
 * Scheduling fairness mode.
 * @enum {0 | 1 | 2}
 */
export const WasmFairnessMode = Object.freeze({
    Balanced: 0, "0": "Balanced",
    Throughput: 1, "1": "Throughput",
    Latency: 2, "2": "Latency",
});

/**
 * Backpressure state input.
 * @enum {0 | 1 | 2}
 */
export const WasmPressureState = Object.freeze({
    Clear: 0, "0": "Clear",
    Elevated: 1, "1": "Elevated",
    Pressured: 2, "2": "Pressured",
});

/**
 * Progress cadence result — returned from `policy_progress_cadence`.
 *
 * `should_emit` is true when both time and percentage thresholds are met.
 */
export class WasmProgressResult {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmProgressResult.prototype);
        obj.__wbg_ptr = ptr;
        WasmProgressResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmProgressResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmprogressresult_free(ptr, 0);
    }
    /**
     * Bytes transferred so far.
     * @returns {bigint}
     */
    get bytesTransferred() {
        const ret = wasm.wasmprogressresult_bytesTransferred(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * Percentage complete (0-100).
     * @returns {number}
     */
    get percent() {
        const ret = wasm.wasmprogressresult_percent(this.__wbg_ptr);
        return ret;
    }
    /**
     * Whether a progress event should be emitted.
     * @returns {boolean}
     */
    get shouldEmit() {
        const ret = wasm.wasmprogressresult_shouldEmit(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Total bytes in transfer.
     * @returns {bigint}
     */
    get totalBytes() {
        const ret = wasm.wasmprogressresult_totalBytes(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
}
if (Symbol.dispose) WasmProgressResult.prototype[Symbol.dispose] = WasmProgressResult.prototype.free;

/**
 * Schedule decision result — returned from `policy_decide`.
 *
 * `next_chunk_ids` is accessed via the `next_chunk_ids()` method
 * which returns a `Uint32Array`.
 */
export class WasmScheduleDecision {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmScheduleDecision.prototype);
        obj.__wbg_ptr = ptr;
        WasmScheduleDecisionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmScheduleDecisionFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmscheduledecision_free(ptr, 0);
    }
    /**
     * Backpressure signal.
     * @returns {WasmBackpressure}
     */
    get backpressure() {
        const ret = wasm.wasmscheduledecision_backpressure(this.__wbg_ptr);
        return ret;
    }
    /**
     * Number of chunk IDs in this round.
     * @returns {number}
     */
    get chunkCount() {
        const ret = wasm.wasmscheduledecision_chunkCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Effective chunk size after transport cap (bytes).
     * @returns {number}
     */
    get effectiveChunkSize() {
        const ret = wasm.wasmscheduledecision_effectiveChunkSize(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Chunk IDs to send this round, as a Uint32Array.
     * @returns {Uint32Array}
     */
    nextChunkIds() {
        const ret = wasm.wasmscheduledecision_nextChunkIds(this.__wbg_ptr);
        return ret;
    }
    /**
     * Suggested delay (ms) before next decision round.
     * @returns {number}
     */
    get pacingDelayMs() {
        const ret = wasm.wasmscheduledecision_pacingDelayMs(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Suggested send window size in chunks.
     * @returns {number}
     */
    get windowSuggestionChunks() {
        const ret = wasm.wasmscheduledecision_windowSuggestionChunks(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) WasmScheduleDecision.prototype[Symbol.dispose] = WasmScheduleDecision.prototype.free;

/**
 * Stall detection result — returned from `policy_detect_stall`.
 *
 * Flattened DTO for the `StallClassification` enum (wasm-bindgen
 * does not support enums with data payloads).
 *
 * Tag values: 0 = Healthy, 1 = Warning, 2 = Stalled, 3 = Complete.
 */
export class WasmStallResult {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmStallResult.prototype);
        obj.__wbg_ptr = ptr;
        WasmStallResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmStallResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmstallresult_free(ptr, 0);
    }
    /**
     * Milliseconds since progress (meaningful for tag 1 and 2).
     * @returns {bigint}
     */
    get msSinceProgress() {
        const ret = wasm.wasmstallresult_msSinceProgress(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * Classification tag: 0=Healthy, 1=Warning, 2=Stalled, 3=Complete.
     * @returns {number}
     */
    get tag() {
        const ret = wasm.wasmstallresult_tag(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) WasmStallResult.prototype[Symbol.dispose] = WasmStallResult.prototype.free;

/**
 * Compute a scheduling decision from flattened policy inputs.
 *
 * Accepts `pending_chunk_ids` as a `&[u32]` (maps from JS Uint32Array).
 * All other parameters are scalar/enum.
 * @param {Uint32Array} pending_chunk_ids
 * @param {number} rtt_ms
 * @param {number} loss_ppm
 * @param {WasmDeviceClass} device_class
 * @param {number} max_parallel_chunks
 * @param {number} max_in_flight_bytes
 * @param {number} priority
 * @param {WasmFairnessMode} fairness_mode
 * @param {number} configured_chunk_size
 * @param {number} transport_max_message_size
 * @param {WasmPressureState} pressure
 * @returns {WasmScheduleDecision}
 */
export function policyDecide(pending_chunk_ids, rtt_ms, loss_ppm, device_class, max_parallel_chunks, max_in_flight_bytes, priority, fairness_mode, configured_chunk_size, transport_max_message_size, pressure) {
    const ptr0 = passArray32ToWasm0(pending_chunk_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.policyDecide(ptr0, len0, rtt_ms, loss_ppm, device_class, max_parallel_chunks, max_in_flight_bytes, priority, fairness_mode, configured_chunk_size, transport_max_message_size, pressure);
    return WasmScheduleDecision.__wrap(ret);
}

/**
 * Classify the current stall state of a transfer.
 * @param {bigint} bytes_acked
 * @param {bigint} total_bytes
 * @param {bigint} ms_since_progress
 * @param {bigint} stall_threshold_ms
 * @param {bigint} warn_threshold_ms
 * @returns {WasmStallResult}
 */
export function policyDetectStall(bytes_acked, total_bytes, ms_since_progress, stall_threshold_ms, warn_threshold_ms) {
    const ret = wasm.policyDetectStall(bytes_acked, total_bytes, ms_since_progress, stall_threshold_ms, warn_threshold_ms);
    return WasmStallResult.__wrap(ret);
}

/**
 * Determine whether a progress event should be emitted.
 * @param {bigint} bytes_transferred
 * @param {bigint} total_bytes
 * @param {bigint} elapsed_since_last_report_ms
 * @param {number} last_reported_percent
 * @param {bigint} min_interval_ms
 * @param {number} min_percent_delta
 * @returns {WasmProgressResult}
 */
export function policyProgressCadence(bytes_transferred, total_bytes, elapsed_since_last_report_ms, last_reported_percent, min_interval_ms, min_percent_delta) {
    const ret = wasm.policyProgressCadence(bytes_transferred, total_bytes, elapsed_since_last_report_ms, last_reported_percent, min_interval_ms, min_percent_delta);
    return WasmProgressResult.__wrap(ret);
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_6ddd609b62940d55: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_new_from_slice_898ac63cbd46f332: function(arg0, arg1) {
            const ret = new Uint32Array(getArrayU32FromWasm0(arg0, arg1));
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./bolt_transfer_policy_wasm_bg.js": import0,
    };
}

const WasmProgressResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmprogressresult_free(ptr >>> 0, 1));
const WasmScheduleDecisionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmscheduledecision_free(ptr >>> 0, 1));
const WasmStallResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmstallresult_free(ptr >>> 0, 1));

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('bolt_transfer_policy_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
