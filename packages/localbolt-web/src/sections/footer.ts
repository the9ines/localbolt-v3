import { icons } from '@/ui/icons';

function createPrivacyDialog(): HTMLDialogElement {
  const dialog = document.createElement('dialog');
  dialog.className = 'max-w-2xl w-full max-h-[85vh] rounded-lg bg-dark/95 backdrop-blur-xl border border-neon/15 shadow-[0_0_40px_rgba(164,226,0,0.08)] text-white p-0';

  dialog.innerHTML = `
    <div class="p-6 space-y-5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-neon/10 flex items-center justify-center">
            ${icons.shield('w-4 h-4 text-neon')}
          </div>
          <h2 class="text-lg font-semibold">Privacy Policy</h2>
        </div>
        <button class="close-btn text-gray-500 hover:text-white transition-colors" aria-label="Close">
          ${icons.x('w-5 h-5')}
        </button>
      </div>

      <div class="overflow-y-auto max-h-[60vh] space-y-5 pr-2">
        <div class="space-y-2">
          <p class="text-xs text-gray-600 uppercase tracking-wider">Last updated: February 2026</p>
          <p class="text-sm text-gray-300 leading-relaxed">LocalBolt is designed to transfer files directly between devices with minimal data collection.</p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-3">
            <div class="flex items-center gap-2">
              ${icons.eye('w-3.5 h-3.5 text-neon/70')}
              <h3 class="text-xs font-semibold uppercase tracking-wider">What We Process</h3>
            </div>
            <ul class="space-y-2">
              <li class="flex items-start gap-2 text-xs text-gray-400 leading-relaxed">
                <span class="w-1 h-1 rounded-full bg-neon/40 mt-1.5 flex-shrink-0"></span>
                Temporary signaling messages (peer code and WebRTC connection data)
              </li>
              <li class="flex items-start gap-2 text-xs text-gray-400 leading-relaxed">
                <span class="w-1 h-1 rounded-full bg-neon/40 mt-1.5 flex-shrink-0"></span>
                Basic service requests needed to load the site
              </li>
            </ul>
          </div>
          <div class="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-3">
            <div class="flex items-center gap-2">
              ${icons.eyeOff('w-3.5 h-3.5 text-neon/70')}
              <h3 class="text-xs font-semibold uppercase tracking-wider">What We Don't Store</h3>
            </div>
            <ul class="space-y-2">
              <li class="flex items-start gap-2 text-xs text-gray-400 leading-relaxed"><span class="w-1 h-1 rounded-full bg-gray-600 mt-1.5 flex-shrink-0"></span>Your file contents</li>
              <li class="flex items-start gap-2 text-xs text-gray-400 leading-relaxed"><span class="w-1 h-1 rounded-full bg-gray-600 mt-1.5 flex-shrink-0"></span>Persistent file history on our servers</li>
              <li class="flex items-start gap-2 text-xs text-gray-400 leading-relaxed"><span class="w-1 h-1 rounded-full bg-gray-600 mt-1.5 flex-shrink-0"></span>Account profiles (no sign-up required)</li>
            </ul>
          </div>
        </div>

        <div class="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-2.5">
          <div class="flex items-center gap-2">
            ${icons.radio('w-3.5 h-3.5 text-neon/70')}
            <h3 class="text-xs font-semibold uppercase tracking-wider">How Transfers Work</h3>
          </div>
          <p class="text-xs text-gray-400 leading-relaxed">Files are sent directly between connected devices using WebRTC data channels and end-to-end encryption. LocalBolt uses a signaling service to set up the connection, but file contents are not uploaded to cloud storage.</p>
          <p class="text-xs text-gray-500 leading-relaxed">Built for same-network use. On segmented networks (guest Wi-Fi, client isolation, restricted enterprise networks), connection setup may fail.</p>
        </div>

        <div class="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-2.5">
          <div class="flex items-center gap-2">
            ${icons.clock('w-3.5 h-3.5 text-neon/70')}
            <h3 class="text-xs font-semibold uppercase tracking-wider">Retention</h3>
          </div>
          <p class="text-xs text-gray-400 leading-relaxed">Signaling data is transient and used only for session setup. We do not keep a permanent cloud archive of your transferred files.</p>
        </div>

        <div class="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-2.5">
          <div class="flex items-center gap-2">
            ${icons.messageCircle('w-3.5 h-3.5 text-neon/70')}
            <h3 class="text-xs font-semibold uppercase tracking-wider">Contact & Updates</h3>
          </div>
          <p class="text-xs text-gray-400 leading-relaxed">Questions about privacy can be raised through the project GitHub profile. We may update this policy when product behavior changes.</p>
        </div>
      </div>
    </div>
  `;

  dialog.querySelector('.close-btn')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  return dialog;
}

export function createFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'py-8 border-t border-white/5';

  const privacyDialog = createPrivacyDialog();

  footer.innerHTML = `
    <div class="container mx-auto px-4 flex flex-col items-center gap-4">
      <div class="flex items-center gap-6 text-sm text-gray-500">
        <a href="https://github.com/the9ines/" target="_blank" rel="noopener noreferrer"
           class="hover:text-neon transition-colors inline-flex items-center gap-1.5 group" aria-label="GitHub Repository for LocalBolt">
          <svg class="w-4 h-4 transition-colors group-hover:text-neon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub
        </a>
        <span class="text-white/10">|</span>
        <button class="privacy-btn hover:text-neon transition-colors text-sm font-normal">Privacy Policy</button>
        <span class="text-white/10">|</span>
        <a href="https://the9ines.com" target="_blank" rel="noopener noreferrer"
           class="hover:text-[rgb(255,141,197)] transition-colors inline-flex items-center gap-1 group">
          ${icons.zap('w-3.5 h-3.5 transition-all duration-300 group-hover:fill-[rgb(255,141,197)]')}
          the9ines.com
        </a>
      </div>
    </div>
  `;

  footer.appendChild(privacyDialog);
  footer.querySelector('.privacy-btn')!.addEventListener('click', () => privacyDialog.showModal());

  return footer;
}
