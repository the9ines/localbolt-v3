import './index.css';
import { initProtocolWasm, setTransferMetricsEnabled } from '@the9ines/localbolt-browser';
import { createApp } from './app';

type CrumbproofApi = {
  init: (config: {
    siteId: string;
    apiBase: string;
    showToggleButton: boolean;
    texts?: { toggleButton: string };
    theme: 'dark';
    accent: string;
  }) => void;
};

const BOLT_TOGGLE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>';

function replaceCrumbproofToggleIcon() {
  document.querySelectorAll<HTMLElement>('.cc-fab .cp-ico').forEach((icon) => {
    if (icon.dataset.localboltIcon === 'bolt') return;
    icon.dataset.localboltIcon = 'bolt';
    icon.innerHTML = BOLT_TOGGLE_ICON;
  });
}

function watchCrumbproofToggleIcon() {
  replaceCrumbproofToggleIcon();
  window.addEventListener('crumbproof:change', replaceCrumbproofToggleIcon);

  const observer = new MutationObserver(replaceCrumbproofToggleIcon);
  observer.observe(document.body, { childList: true, subtree: true });
}

function initCrumbproofConsent() {
  const crumbproof = (window as unknown as { Crumbproof?: CrumbproofApi }).Crumbproof;
  crumbproof?.init({
    siteId: 'localbolt',
    apiBase: 'https://crumbproof.com',
    showToggleButton: true,
    texts: { toggleButton: 'Cookie settings' },
    theme: 'dark',
    accent: '#A4E200',
  });
  watchCrumbproofToggleIcon();
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
