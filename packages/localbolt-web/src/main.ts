import './index.css';
import { initWasmCrypto } from '@the9ines/bolt-core';
import { createApp } from './app';

// RB5: Initialize Rust/WASM protocol authority before any crypto operations.
// Falls back silently to TS tweetnacl/BTR if WASM unavailable (PM-RB-03).
initWasmCrypto().then(() => {
  createApp(document.getElementById('root')!);
});
