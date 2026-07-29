import './index.css';
import { initProtocolWasm, setTransferMetricsEnabled } from '@the9ines/localbolt-browser';
import { createApp } from './app';

type CrumbproofApi = {
  init: (config: {
    siteId: string;
    apiBase: string;
    showToggleButton: boolean;
    theme: 'dark';
    accent: string;
  }) => void;
};

function initCrumbproofConsent() {
  const crumbproof = (window as unknown as { Crumbproof?: CrumbproofApi }).Crumbproof;
  crumbproof?.init({
    siteId: 'localbolt',
    apiBase: 'https://crumbproof.com',
    showToggleButton: false,
    theme: 'dark',
    accent: '#A4E200',
  });
}

// PF2: Enable transfer metrics for baseline measurement.
// Logs [TRANSFER_METRICS] JSON to console on transfer completion.
setTransferMetricsEnabled(true);

// BR2: Initialize Rust/WASM protocol authority from embedded artifact.
// Falls back silently to TS tweetnacl/BTR if WASM unavailable (PM-RB-03).
initProtocolWasm().then(() => {
  initCrumbproofConsent();
  createApp(document.getElementById('root')!);
});
