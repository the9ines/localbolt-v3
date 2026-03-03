import { createPeerConnection } from '@/components/peer-connection';
import { createFileUpload, store } from '@the9ines/bolt-transport-web';
import { getVerificationState, onVerificationStateChange } from '@/services/verification-state';

export function createTransfer(): HTMLElement {
  const card = document.createElement('div');
  card.className = `
    relative overflow-hidden p-8 md:p-10 max-w-2xl mx-auto space-y-6
    bg-dark-accent/40 backdrop-blur-xl border border-neon/20 rounded-xl
    shadow-[0_0_40px_rgba(164,226,0,0.12)] animate-fade-up
    transition-all duration-500
    hover:shadow-[0_0_60px_rgba(164,226,0,0.2)] hover:border-neon/40
  `;

  // Gradient overlays
  const gradientBr = document.createElement('div');
  gradientBr.className = 'absolute inset-0 bg-gradient-to-br from-neon/5 via-transparent to-transparent opacity-60';
  const gradientT = document.createElement('div');
  gradientT.className = 'absolute inset-0 bg-gradient-to-t from-dark/20 via-transparent to-transparent';

  // Content area
  const content = document.createElement('div');
  content.className = 'relative';

  const peerConnectionEl = createPeerConnection();
  content.appendChild(peerConnectionEl);

  // File upload (shown when connected AND transfer is allowed)
  const fileUploadWrap = document.createElement('div');
  fileUploadWrap.className = 'animate-fade-in mt-6';
  fileUploadWrap.hidden = true;

  const fileUploadEl = createFileUpload();
  fileUploadWrap.appendChild(fileUploadEl);
  content.appendChild(fileUploadWrap);

  // Gate: file transfer requires connection + active encryption session.
  // All three TOFU states (verified, unverified, legacy) have working
  // end-to-end encryption — the SAS verification step is an optional
  // MITM confirmation, not a prerequisite for secure transfer. (DP-4)
  function updateFileUploadVisibility() {
    const { isConnected } = store.getState();
    fileUploadWrap.hidden = !isConnected;
  }

  store.subscribe(updateFileUploadVisibility);
  onVerificationStateChange(updateFileUploadVisibility);

  card.append(gradientBr, gradientT, content);
  return card;
}
