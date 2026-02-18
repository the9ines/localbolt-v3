import { icons } from '@/ui/icons';

export function createTrustStrip(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-label', 'Trust signals');
  section.className = 'animate-fade-up';

  const signals = [
    { icon: icons.shield('w-3.5 h-3.5 text-neon/60'), label: 'NaCl/Curve25519 Encrypted' },
    { icon: icons.server('w-3.5 h-3.5 text-neon/60'), label: 'Zero Server Storage' },
    { icon: icons.globe('w-3.5 h-3.5 text-neon/60'), label: 'Cross-Platform' },
    { icon: icons.userX('w-3.5 h-3.5 text-neon/60'), label: 'No Account Needed' },
  ];

  section.innerHTML = `
    <div class="flex flex-wrap justify-center gap-x-8 gap-y-3 max-w-3xl mx-auto">
      ${signals.map(s => `
        <div class="flex items-center gap-2 text-gray-500">
          ${s.icon}
          <span class="text-xs tracking-wide uppercase">${s.label}</span>
        </div>
      `).join('')}
    </div>
  `;
  return section;
}
