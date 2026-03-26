/* @ts-self-types="./bolt_protocol_wasm.d.ts" */

/**
 * Opaque handle to BtrEngine. Rust owns all key material.
 * JS holds the handle; Rust validates all state transitions.
 */
export class WasmBtrEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmBtrEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmbtrengine_free(ptr, 0);
    }
    /**
     * Begin a receive-side transfer using existing ephemeral secret key.
     * Matches TS BtrTransferAdapter.beginReceive() which uses
     * scalarMult(localSecretKey, senderRatchetPub) for the DH step.
     * @param {Uint8Array} transfer_id
     * @param {Uint8Array} remote_ratchet_pub
     * @param {Uint8Array} local_secret_key
     * @returns {WasmBtrTransferCtx}
     */
    beginTransferReceive(transfer_id, remote_ratchet_pub, local_secret_key) {
        const ptr0 = passArray8ToWasm0(transfer_id, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(remote_ratchet_pub, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(local_secret_key, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.wasmbtrengine_beginTransferReceive(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmBtrTransferCtx.__wrap(ret[0]);
    }
    /**
     * Begin a send-side transfer. Returns a WasmBtrTransferCtx handle.
     * @param {Uint8Array} transfer_id
     * @param {Uint8Array} remote_ratchet_pub
     * @returns {WasmBtrTransferCtx}
     */
    beginTransferSend(transfer_id, remote_ratchet_pub) {
        const ptr0 = passArray8ToWasm0(transfer_id, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(remote_ratchet_pub, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasmbtrengine_beginTransferSend(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmBtrTransferCtx.__wrap(ret[0]);
    }
    /**
     * Cleanup on disconnect — zeroize all BTR state.
     */
    cleanupDisconnect() {
        wasm.wasmbtrengine_cleanupDisconnect(this.__wbg_ptr);
    }
    /**
     * End the current transfer's replay tracking.
     */
    endTransfer() {
        wasm.wasmbtrengine_endTransfer(this.__wbg_ptr);
    }
    /**
     * Create a new BTR engine from the ephemeral shared secret.
     * Called after HELLO handshake when BTR is negotiated.
     * @param {Uint8Array} shared_secret
     */
    constructor(shared_secret) {
        const ptr0 = passArray8ToWasm0(shared_secret, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmbtrengine_new(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        WasmBtrEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Current ratchet generation (monotonically increasing).
     * @returns {number}
     */
    ratchetGeneration() {
        const ret = wasm.wasmbtrengine_ratchetGeneration(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) WasmBtrEngine.prototype[Symbol.dispose] = WasmBtrEngine.prototype.free;

/**
 * Opaque handle to BtrTransferContext. Per-chunk seal/open hot path.
 */
export class WasmBtrTransferCtx {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmBtrTransferCtx.prototype);
        obj.__wbg_ptr = ptr;
        WasmBtrTransferCtxFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmBtrTransferCtxFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmbtrtransferctx_free(ptr, 0);
    }
    /**
     * Current chain index.
     * @returns {number}
     */
    chainIndex() {
        const ret = wasm.wasmbtrtransferctx_chainIndex(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Cleanup on transfer cancel.
     */
    cleanupCancel() {
        wasm.wasmbtrtransferctx_cleanupCancel(this.__wbg_ptr);
    }
    /**
     * Cleanup on transfer complete.
     */
    cleanupComplete() {
        wasm.wasmbtrtransferctx_cleanupComplete(this.__wbg_ptr);
    }
    /**
     * Ratchet generation for this transfer.
     * @returns {number}
     */
    generation() {
        const ret = wasm.wasmbtrtransferctx_generation(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Local ratchet public key (for envelope fields).
     * @returns {Uint8Array}
     */
    localRatchetPub() {
        const ret = wasm.wasmbtrtransferctx_localRatchetPub(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Decrypt a chunk at expected chain position.
     * HOT PATH — called per 16 KiB chunk.
     * @param {number} expected_chain_index
     * @param {Uint8Array} sealed
     * @returns {Uint8Array}
     */
    openChunk(expected_chain_index, sealed) {
        const ptr0 = passArray8ToWasm0(sealed, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmbtrtransferctx_openChunk(this.__wbg_ptr, expected_chain_index, ptr0, len0);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v2;
    }
    /**
     * Encrypt a chunk. Returns { chainIndex: number, sealed: Uint8Array }.
     * HOT PATH — called per 16 KiB chunk (~62 times per MiB).
     * @param {Uint8Array} plaintext
     * @returns {any}
     */
    sealChunk(plaintext) {
        const ptr0 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmbtrtransferctx_sealChunk(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Transfer ID (16 bytes).
     * @returns {Uint8Array}
     */
    transferId() {
        const ret = wasm.wasmbtrtransferctx_transferId(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) WasmBtrTransferCtx.prototype[Symbol.dispose] = WasmBtrTransferCtx.prototype.free;

/**
 * Opaque handle to SendSession. Rust owns transfer-state transitions.
 * TS proposes events (accept, cancel, pause); Rust validates and transitions.
 */
export class WasmSendSession {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmSendSessionFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmsendsession_free(ptr, 0);
    }
    /**
     * Begin an outbound transfer. Transitions Idle → Offered.
     * Returns { transferId, filename, size, totalChunks, chunkSize, fileHash? }.
     * @param {string} transfer_id
     * @param {Uint8Array} payload
     * @param {string} filename
     * @param {string | null} [file_hash]
     * @returns {any}
     */
    beginSend(transfer_id, payload, filename, file_hash) {
        const ptr0 = passStringToWasm0(transfer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(payload, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(filename, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(file_hash) ? 0 : passStringToWasm0(file_hash, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len3 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsendsession_beginSend(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Finalize. Transitions Transferring → Completed. Returns transfer_id.
     * @returns {string}
     */
    finish() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.wasmsendsession_finish(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * True if Transferring with chunks remaining.
     * @returns {boolean}
     */
    isSendActive() {
        const ret = wasm.wasmsendsession_isSendActive(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Create a new send session in Idle state.
     */
    constructor() {
        const ret = wasm.wasmsendsession_new();
        this.__wbg_ptr = ret >>> 0;
        WasmSendSessionFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Yield next chunk. Returns { transferId, chunkIndex, totalChunks, data } or null.
     * @returns {any}
     */
    nextChunk() {
        const ret = wasm.wasmsendsession_nextChunk(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Receiver accepted. Transitions Offered → Transferring.
     * @param {string} transfer_id
     */
    onAccept(transfer_id) {
        const ptr0 = passStringToWasm0(transfer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsendsession_onAccept(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Cancel. Transitions Offered/Transferring/Paused → Cancelled.
     * @param {string} transfer_id
     */
    onCancel(transfer_id) {
        const ptr0 = passStringToWasm0(transfer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsendsession_onCancel(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Pause sending. Transitions Transferring → Paused.
     * @param {string} transfer_id
     */
    onPause(transfer_id) {
        const ptr0 = passStringToWasm0(transfer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsendsession_onPause(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Resume sending. Transitions Paused → Transferring.
     * @param {string} transfer_id
     */
    onResume(transfer_id) {
        const ptr0 = passStringToWasm0(transfer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsendsession_onResume(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Current state as string (for TS display/logging).
     * @returns {string}
     */
    state() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.wasmsendsession_state(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) WasmSendSession.prototype[Symbol.dispose] = WasmSendSession.prototype.free;

/**
 * Compute 6-character SAS from identity + ephemeral public keys.
 *
 * Parity: TS `computeSas(identityA, identityB, ephemeralA, ephemeralB)`.
 * Identical algorithm: SHA-256(sort32(id_a, id_b) || sort32(eph_a, eph_b)),
 * first 6 hex chars, uppercase.
 * @param {Uint8Array} identity_a
 * @param {Uint8Array} identity_b
 * @param {Uint8Array} ephemeral_a
 * @param {Uint8Array} ephemeral_b
 * @returns {string}
 */
export function computeSas(identity_a, identity_b, ephemeral_a, ephemeral_b) {
    let deferred6_0;
    let deferred6_1;
    try {
        const ptr0 = passArray8ToWasm0(identity_a, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(identity_b, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(ephemeral_a, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(ephemeral_b, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.computeSas(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
        var ptr5 = ret[0];
        var len5 = ret[1];
        if (ret[3]) {
            ptr5 = 0; len5 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred6_0 = ptr5;
        deferred6_1 = len5;
        return getStringFromWasm0(ptr5, len5);
    } finally {
        wasm.__wbindgen_free(deferred6_0, deferred6_1, 1);
    }
}

/**
 * Generate an ephemeral X25519 keypair for session use.
 *
 * Returns a JsValue containing { publicKey: Uint8Array, secretKey: Uint8Array }.
 * Parity: TS `generateEphemeralKeyPair()` (tweetnacl `box.keyPair()`).
 * @returns {any}
 */
export function generateEphemeralKeyPair() {
    const ret = wasm.generateEphemeralKeyPair();
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Generate a persistent identity X25519 keypair.
 *
 * Returns a JsValue containing { publicKey: Uint8Array, secretKey: Uint8Array }.
 * Parity: TS `generateIdentityKeyPair()`.
 * @returns {any}
 */
export function generateIdentityKeyPair() {
    const ret = wasm.generateIdentityKeyPair();
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Generate a 6-character secure peer code.
 *
 * Parity: TS `generateSecurePeerCode()`.
 * @returns {string}
 */
export function generateSecurePeerCode() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.generateSecurePeerCode();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Initialize panic hook for browser console error reporting.
 * Called once at WASM module load time.
 */
export function init() {
    wasm.init();
}

/**
 * Validate a peer code (6 or 8 chars, optional hyphens, unambiguous alphabet).
 *
 * Parity: TS `isValidPeerCode(code)`.
 * @param {string} code
 * @returns {boolean}
 */
export function isValidPeerCode(code) {
    const ptr0 = passStringToWasm0(code, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.isValidPeerCode(ptr0, len0);
    return ret !== 0;
}

/**
 * Negotiate BTR mode from capability flags.
 * @param {boolean} local_supports
 * @param {boolean} remote_supports
 * @param {boolean} remote_well_formed
 * @returns {string}
 */
export function negotiateBtr(local_supports, remote_supports, remote_well_formed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.negotiateBtr(local_supports, remote_supports, remote_well_formed);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Open a sealed NaCl box payload. Expects base64(nonce || ciphertext).
 *
 * Parity: TS `openBoxPayload(sealed, senderPublicKey, receiverSecretKey)`.
 * @param {string} sealed
 * @param {Uint8Array} sender_public_key
 * @param {Uint8Array} receiver_secret_key
 * @returns {Uint8Array}
 */
export function openBoxPayload(sealed, sender_public_key, receiver_secret_key) {
    const ptr0 = passStringToWasm0(sealed, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(sender_public_key, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(receiver_secret_key, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.openBoxPayload(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v4 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v4;
}

/**
 * Seal plaintext using NaCl box. Returns base64(nonce || ciphertext).
 *
 * Parity: TS `sealBoxPayload(plaintext, remotePublicKey, senderSecretKey)`.
 * Identical wire format. Random nonce generated internally via CSPRNG.
 * @param {Uint8Array} plaintext
 * @param {Uint8Array} remote_public_key
 * @param {Uint8Array} sender_secret_key
 * @returns {string}
 */
export function sealBoxPayload(plaintext, remote_public_key, sender_secret_key) {
    let deferred5_0;
    let deferred5_1;
    try {
        const ptr0 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(remote_public_key, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(sender_secret_key, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.sealBoxPayload(ptr0, len0, ptr1, len1, ptr2, len2);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
            ptr4 = 0; len4 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
    } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
    }
}

/**
 * Compute SHA-256 hex digest of data.
 *
 * Parity: TS `sha256Hex(data)`.
 * @param {Uint8Array} data
 * @returns {string}
 */
export function sha256Hex(data) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.sha256Hex(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_is_function_3c846841762788c1: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_object_781bc9f159099513: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_7ef6b97b02428fae: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_52709e72fb9f179c: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_throw_6ddd609b62940d55: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_2d781c1f4d5c0ef8: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_crypto_38df2bab126b63dc: function(arg0) {
            const ret = arg0.crypto;
            return ret;
        },
        __wbg_error_a6fa202b58aa1cd3: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_getRandomValues_c44a50d8cfdaebeb: function() { return handleError(function (arg0, arg1) {
            arg0.getRandomValues(arg1);
        }, arguments); },
        __wbg_length_ea16607d7b61445b: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_msCrypto_bd5a034af96bcba6: function(arg0) {
            const ret = arg0.msCrypto;
            return ret;
        },
        __wbg_new_227d7c05414eb861: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_new_ab79df5bd7c26067: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_from_slice_22da9388ac046e50: function(arg0, arg1) {
            const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_with_length_825018a1616e9e55: function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return ret;
        },
        __wbg_node_84ea875411254db1: function(arg0) {
            const ret = arg0.node;
            return ret;
        },
        __wbg_process_44c7a14e11e9f69e: function(arg0) {
            const ret = arg0.process;
            return ret;
        },
        __wbg_prototypesetcall_d62e5099504357e6: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_randomFillSync_6c25eac9869eb53c: function() { return handleError(function (arg0, arg1) {
            arg0.randomFillSync(arg1);
        }, arguments); },
        __wbg_require_b4edbdcf3e2a1ef0: function() { return handleError(function () {
            const ret = module.require;
            return ret;
        }, arguments); },
        __wbg_set_7eaa4f96924fd6b3: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_static_accessor_GLOBAL_8adb955bd33fac2f: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_ad356e0db91c7913: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_f207c857566db248: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_bb9f1ba69d61b386: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_subarray_a068d24e39478a8a: function(arg0, arg1, arg2) {
            const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_versions_276b2795b1c6a219: function(arg0) {
            const ret = arg0.versions;
            return ret;
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
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
        "./bolt_protocol_wasm_bg.js": import0,
    };
}

const WasmBtrEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmbtrengine_free(ptr >>> 0, 1));
const WasmBtrTransferCtxFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmbtrtransferctx_free(ptr >>> 0, 1));
const WasmSendSessionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmsendsession_free(ptr >>> 0, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
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

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
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
        module_or_path = new URL('bolt_protocol_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
