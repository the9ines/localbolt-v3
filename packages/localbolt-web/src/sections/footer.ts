import { initPolicyAdapter } from '@the9ines/localbolt-browser';
import { icons } from '@the9ines/localbolt-browser';

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
          <p class="text-xs text-gray-600 uppercase tracking-wider">Last updated: July 2026</p>
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
              <li class="flex items-start gap-2 text-xs text-gray-400 leading-relaxed">
                <span class="w-1 h-1 rounded-full bg-neon/40 mt-1.5 flex-shrink-0"></span>
                Consent preferences and receipts through Crumbproof, plus anonymous aggregated visit stats through server-side analytics.
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
  footer.className = 'pt-12 pb-4';

  const privacyDialog = createPrivacyDialog();

  footer.innerHTML = `
    <div class="container mx-auto px-4 flex flex-col items-center gap-5">
      <div class="flex items-center justify-center gap-1.5" style="font-family:'JetBrains Mono',monospace; font-size:14px; letter-spacing:0.05em; color:rgba(255,255,255,0.50)">
        This site is powered by <a href="https://www.netlify.com/" target="_blank" rel="noopener noreferrer"
           class="hover:opacity-70 transition-opacity inline-flex items-center"><img src="/netlify-logo.webp" alt="Netlify" style="height:30px" /></a>
      </div>
      <div class="flex items-center justify-center gap-3 text-white/20" style="font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.05em">
        <a href="https://github.com/bolt-ecosystem/localbolt" target="_blank" rel="noopener noreferrer"
           class="hover:text-white/50 transition-colors">GitHub</a>
        <span class="text-white/[0.08]">/</span>
        <a href="https://github.com/bolt-ecosystem/localbolt-native" target="_blank" rel="noopener noreferrer"
           class="hover:text-white/50 transition-colors">Desktop App</a>
        <span class="text-white/[0.08]">/</span>
        <button class="privacy-btn hover:text-white/50 transition-colors">Privacy</button>
        <span class="text-white/[0.08]">/</span>
        <button class="cookie-settings-btn hover:text-white/50 transition-colors">Cookie Settings</button>
        <span class="text-white/[0.08]">/</span>
        <a href="https://the9ines.com" target="_blank" rel="noopener noreferrer"
           class="hover:text-[rgb(255,141,197)] transition-colors">the9ines</a>
        <span class="text-white/[0.08]">/</span>
        <span class="policy-badge">Policy: ...</span>
      </div>
    </div>
  `;

  footer.appendChild(privacyDialog);
  footer.querySelector('.privacy-btn')!.addEventListener('click', () => privacyDialog.showModal());
  footer.querySelector('.cookie-settings-btn')!.addEventListener('click', () => {
    const crumbproof = (window as unknown as { Crumbproof?: { openPreferences: () => void } }).Crumbproof;
    crumbproof?.openPreferences();
  });

  const badge = footer.querySelector('.policy-badge') as HTMLElement;
  initPolicyAdapter().then((adapter) => {
    const label = adapter.name === 'wasm' ? 'WASM' : 'Fallback';
    badge.textContent = `Policy: ${label}`;
  });

  return footer;
}
