declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

export function createConsentModal(): void {
  const consent = localStorage.getItem('analytics-consent');

  if (consent === 'true' && window.gtag) {
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    return;
  }

  if (consent !== null) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'max-w-md w-full rounded-lg bg-dark-accent/95 backdrop-blur-xl border border-white/10 shadow-lg text-white p-0';

  dialog.innerHTML = `
    <div class="p-6 space-y-4">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-neon" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>
        <h2 class="text-base font-semibold">Privacy Notice</h2>
      </div>

      <div class="space-y-3 text-sm text-gray-300">
        <p>We use Google Analytics to understand how our secure file sharing service is being used.</p>
        <div class="text-sm space-y-1">
          <p><strong class="text-white">We collect:</strong> Anonymous usage statistics, page views</p>
          <p><strong class="text-white">We DON'T collect:</strong> Your files, personal data, or transfer contents</p>
        </div>
        <p class="text-xs text-gray-500">Your file transfers remain completely private regardless of your choice.</p>
      </div>

      <div class="flex gap-2">
        <button data-consent="false" class="flex-1 px-4 py-2 rounded-md border border-white/10 text-sm hover:bg-white/5 transition-colors">Decline</button>
        <button data-consent="true" class="flex-1 px-4 py-2 rounded-md bg-neon hover:bg-neon/90 text-sm text-black font-medium transition-colors">Accept</button>
      </div>
    </div>
  `;

  dialog.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-consent]') as HTMLElement;
    if (!btn) return;

    const accepted = btn.dataset.consent === 'true';
    localStorage.setItem('analytics-consent', String(accepted));
    dialog.close();
    dialog.remove();

    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: accepted ? 'granted' : 'denied',
      });
    }
  });

  document.body.appendChild(dialog);
  // Small delay so dialog animates in
  requestAnimationFrame(() => dialog.showModal());
}
