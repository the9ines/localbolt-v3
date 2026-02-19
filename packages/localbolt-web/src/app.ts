import { createHeader } from '@/sections/header';
import { createHowItWorks } from '@/sections/how-it-works';
import { createTransfer } from '@/sections/transfer';
import { createFeatures } from '@/sections/features';
import { createFAQ } from '@/sections/faq';
import { createFooter } from '@/sections/footer';
import { createConsentModal } from '@/sections/consent-modal';

export function createApp(root: HTMLElement) {
  root.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'relative bg-dark text-white';

  const zLayer = document.createElement('div');
  zLayer.className = 'relative z-10';

  zLayer.appendChild(createHeader());

  const main = document.createElement('main');

  // Screen 1: Hero title + subtitle + green down arrow
  const hero = document.createElement('section');
  hero.className = 'min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center text-center px-4 animate-fade-up';
  hero.innerHTML = `
    <div class="max-w-3xl space-y-4">
      <h1 class="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent pb-1 leading-[1.15]">Encrypted P2P File Sharing</h1>
      <p class="text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">Private, encrypted file transfer directly between your devices. Same network or across the internet. Files never touch a server.</p>
    </div>
    <button class="scroll-btn inline-flex items-center gap-1 text-sm text-neon/70 hover:text-neon transition-colors pt-6" aria-label="Scroll to file transfer">
      <svg class="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
    </button>
  `;
  main.appendChild(hero);

  // Screen 2: Transfer card — own full viewport, pulsating grid bg
  const transferSection = document.createElement('section');
  transferSection.className = 'relative min-h-screen flex items-center justify-center px-4';

  // Pulsating circular bg — fills section, centered on card (card is flex-centered)
  const bgGlow = document.createElement('div');
  bgGlow.className = 'absolute inset-0 pointer-events-none';
  const radialBg = document.createElement('div');
  radialBg.className = 'absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(164,226,0,0.09),transparent_60%)] animate-pulse';
  const gridBg = document.createElement('div');
  gridBg.className = "absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(circle,white_20%,transparent_65%)]";
  bgGlow.append(radialBg, gridBg);
  transferSection.appendChild(bgGlow);

  const cardWrap = document.createElement('div');
  cardWrap.className = 'relative w-full max-w-2xl mx-auto';
  const transferCard = createTransfer();
  cardWrap.appendChild(transferCard);
  transferSection.appendChild(cardWrap);

  main.appendChild(transferSection);

  // Arrow click scrolls to transfer card centered
  hero.querySelector('.scroll-btn')!.addEventListener('click', () => {
    transferCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Screen 3: SEO content — below the fold, not visible from card screen
  const seoContent = document.createElement('div');
  seoContent.className = 'container mx-auto px-4 py-24 lg:py-32 space-y-20';
  seoContent.appendChild(createHowItWorks());
  seoContent.appendChild(createFeatures());
  seoContent.appendChild(createFAQ());
  main.appendChild(seoContent);

  zLayer.appendChild(main);
  zLayer.appendChild(createFooter());

  wrapper.appendChild(zLayer);
  root.appendChild(wrapper);

  createConsentModal();
}
