/**
 * Protocol WASM loader — loads bolt-protocol-wasm from embedded artifact
 * and initializes bolt-core's WASM crypto adapter.
 *
 * BR2: This is the production entry point for WASM protocol authority.
 * Consumer apps should call initProtocolWasm() at startup instead of
 * bolt-core's initWasmCrypto() directly.
 *
 * Usage:
 *   import { initProtocolWasm } from '@the9ines/bolt-transport-web';
 *   await initProtocolWasm();  // call once before any crypto operations
 */

import { initWasmCryptoFromModule, getProtocolAuthorityMode } from '@the9ines/bolt-core';
export { getProtocolAuthorityMode } from '@the9ines/bolt-core';
export type { ProtocolAuthorityMode } from '@the9ines/bolt-core';

let _initAttempted = false;
let _initResult = false;

/**
 * Load and initialize the embedded protocol WASM module.
 *
 * BR3: Logs a consolidated summary after every init attempt showing
 * the resulting authority mode (wasm / ts-fallback).
 *
 * Falls back silently — returns false if WASM is not available.
 * PM-RB-03: TS fallback remains operational if this fails.
 */
export async function initProtocolWasm(): Promise<boolean> {
  if (_initAttempted) return _initResult;
  _initAttempted = true;

  try {
    // Relative import — Vite/webpack resolve this from the published package.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wasm = await import('../../../wasm/bolt_protocol_wasm.js' as any);
    await wasm.default();

    _initResult = initWasmCryptoFromModule(wasm);

    if (_initResult) {
      console.log('[BOLT-WASM] Protocol WASM loaded and initialized');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[BOLT-WASM] Protocol WASM load failed: ${msg}`);
    _initResult = false;
  }

  // BR3: consolidated summary — always emitted after init attempt
  const mode = getProtocolAuthorityMode();
  console.log(`[BOLT-WASM] Authority mode: ${mode}`);

  return _initResult;
}
