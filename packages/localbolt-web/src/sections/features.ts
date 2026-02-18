import { icons } from '@/ui/icons';

export function createFeatures(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-label', 'Features');
  section.className = 'space-y-6 max-w-5xl mx-auto';

  const bolt = icons.zap('inline w-2.5 h-2.5 text-gray-500');

  const features = [
    { icon: icons.shield, title: 'End-to-End Encryption', desc: 'Every file is encrypted with NaCl/Curve25519 (same algorithms used by Signal and WireGuard) before transfer. Per-chunk random nonces prevent any pattern analysis.' },
    { icon: icons.wifi, title: 'WebRTC P2P Transfer', desc: `Files transfer directly between devices over encrypted WebRTC data channels ${bolt} faster and more private than cloud uploads.` },
    { icon: icons.server, title: 'Zero Server Storage', desc: 'Your files never touch any server. Not during transfer, not after. Zero cloud storage means zero data exposure.' },
    { icon: icons.laptop, title: 'Universal Compatibility', desc: 'Works across Windows, macOS, Linux, iOS, and Android in any modern browser.' },
    { icon: icons.lock, title: 'Privacy Focused', desc: "No account, no tracking, no analytics, no data collection. We can't see your files because they never reach us." },
    { icon: icons.zap, title: 'Lightning Fast', desc: 'Direct peer connections transfer at local network speed.' },
    { icon: icons.globe, title: 'Same-Network First', desc: 'Built for direct connections on the same network with no relay path for file content.' },
    { icon: icons.clock, title: 'Real-time Transfer', desc: 'Live progress tracking and transfer speed monitoring.' },
  ];

  section.innerHTML = `
    <div class="text-center max-w-3xl mx-auto">
      <h2 class="text-2xl font-bold mb-2">Military-Grade Encryption, Zero Trust Architecture</h2>
      <p class="text-sm text-gray-500 leading-relaxed">
        LocalBolt uses NaCl/Curve25519 encryption ${icons.zap('inline w-3 h-3 text-gray-500')} the same cryptographic standard trusted by Signal and WireGuard ${icons.zap('inline w-3 h-3 text-gray-500')} to transfer files directly between devices with zero server storage.
      </p>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up">
      ${features.map(f => `
        <div class="group flex items-start gap-3 p-4 rounded-lg bg-white/[0.02] border border-white/5 transition-all duration-300 hover:border-neon/20 hover:bg-white/[0.04]">
          ${f.icon('w-5 h-5 text-neon/70 flex-shrink-0 mt-0.5 transition-colors duration-300 group-hover:text-neon')}
          <div class="min-w-0">
            <h3 class="text-sm font-semibold mb-1">${f.title}</h3>
            <p class="text-xs text-gray-500 leading-relaxed">${f.desc}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  return section;
}
