import { icons } from '@/ui/icons';

export function createHowItWorks(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-label', 'How It Works');
  section.className = 'space-y-6 max-w-4xl mx-auto';

  const steps = [
    { icon: icons.smartphone('w-4 h-4 text-neon/70'), step: '1', title: 'Open on Both Devices', desc: 'Visit localbolt.site on two devices on the same network.' },
    { icon: icons.share2('w-4 h-4 text-neon/70'), step: '2', title: 'Select a Device', desc: 'Nearby devices appear automatically. Tap one to connect instantly.' },
    { icon: icons.zap('w-4 h-4 text-neon/70'), step: '3', title: 'Transfer Instantly', desc: 'Drag and drop files. NaCl-encrypted, peer-to-peer, no size limits.' },
  ];

  section.innerHTML = `
    <div class="text-center">
      <h2 class="text-2xl font-bold mb-2">How It Works</h2>
      <p class="text-sm text-gray-500">
        Start sharing files in seconds ${icons.zap('inline w-3 h-3 text-gray-500')} no apps, no accounts
      </p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${steps.map(s => `
        <div class="relative flex items-start gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/5 transition-colors duration-300 hover:border-white/10">
          <div class="flex-shrink-0 w-7 h-7 bg-neon/10 text-neon rounded-md flex items-center justify-center text-xs font-bold">${s.step}</div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              ${s.icon}
              <h3 class="text-sm font-semibold">${s.title}</h3>
            </div>
            <p class="text-xs text-gray-500 leading-relaxed">${s.desc}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  return section;
}
