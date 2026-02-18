import { icons } from '@/ui/icons';

export function createHero(onStartSharing: () => void): HTMLElement {
  const section = document.createElement('section');
  section.id = 'encrypted-p2p-sharing';
  section.className = 'text-center space-y-4 animate-fade-up max-w-3xl mx-auto';
  section.setAttribute('aria-label', 'Encrypted P2P File Sharing');
  section.innerHTML = `
    <h1 class="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent pb-1 leading-[1.15]">
      Encrypted P2P File Sharing
    </h1>
    <p class="text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
      Private, encrypted file transfer ${icons.zap('inline w-3.5 h-3.5 text-gray-500')} directly between your devices. Files never touch a server.
    </p>
    <button class="scroll-btn inline-flex items-center gap-1 text-sm text-neon/70 hover:text-neon transition-colors pt-2" aria-label="Scroll to file transfer">
      ${icons.arrowDown('w-4 h-4 animate-bounce')}
    </button>
  `;
  section.querySelector('.scroll-btn')!.addEventListener('click', onStartSharing);
  return section;
}
