import './index.css';
import { initProtocolWasm, setTransferMetricsEnabled } from '@the9ines/localbolt-browser';
import { createApp } from './app';

// PF2: Enable transfer metrics for baseline measurement.
// Logs [TRANSFER_METRICS] JSON to console on transfer completion.
setTransferMetricsEnabled(true);

// BR2: Initialize Rust/WASM protocol authority from embedded artifact.
// Falls back silently to TS tweetnacl/BTR if WASM unavailable (PM-RB-03).
initProtocolWasm().then(() => {
  createApp(document.getElementById('root')!);
});
