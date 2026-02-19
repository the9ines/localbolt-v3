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
      Private, encrypted file transfer directly between your devices. Same network or across the internet. Files never touch a server.
    </p>
    <button class="scroll-btn inline-flex items-center gap-1 text-sm text-neon/70 hover:text-neon transition-colors pt-2" aria-label="Scroll to file transfer">
      <svg class="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
    </button>
  `;
  section.querySelector('.scroll-btn')!.addEventListener('click', onStartSharing);
  return section;
}
