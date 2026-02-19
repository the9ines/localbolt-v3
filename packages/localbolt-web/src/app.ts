import { createHeader } from '@/sections/header';
import { createTransfer } from '@/sections/transfer';
import { createFooter } from '@/sections/footer';
import { createConsentModal } from '@/sections/consent-modal';

export function createApp(root: HTMLElement) {
  root.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'relative bg-dark text-white';

  const zLayer = document.createElement('div');
  zLayer.className = 'relative z-10';

  // Header
  zLayer.appendChild(createHeader());

  const main = document.createElement('main');

  // Hero — SEO title + subtitle + down arrow
  const hero = document.createElement('div');
  hero.className = 'text-center pt-20 lg:pt-28 pb-6 px-4';
  hero.innerHTML = `
    <h1 class="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent pb-3 animate-fade-up">Encrypted P2P File Sharing</h1>
    <p class="text-sm sm:text-base text-gray-400 max-w-lg mx-auto leading-relaxed animate-fade-up [animation-delay:100ms]">Private, encrypted file transfer directly between your devices. Same network or across the internet. Files never touch a server.</p>
    <div class="mt-8">
      <svg class="w-5 h-5 mx-auto text-neon/40 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
      </svg>
    </div>
  `;
  main.appendChild(hero);

  // Transfer card section — centered with pulsating grid bg
  const transferSection = document.createElement('div');
  transferSection.className = 'relative py-32 lg:py-48 px-4';

  // Pulsating grid background centered on card
  const bgContainer = document.createElement('div');
  bgContainer.className = 'absolute inset-0 pointer-events-none';
  bgContainer.style.maskImage = 'radial-gradient(ellipse at 50% 50%, white 30%, transparent 70%)';
  bgContainer.style.webkitMaskImage = 'radial-gradient(ellipse at 50% 50%, white 30%, transparent 70%)';
  const radialBg = document.createElement('div');
  radialBg.className = 'absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(164,226,0,0.07),rgba(0,0,0,0))] animate-pulse';
  const gridBg = document.createElement('div');
  gridBg.className = "absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(white,transparent_80%)]";
  bgContainer.append(radialBg, gridBg);
  transferSection.appendChild(bgContainer);

  // Card
  const cardWrap = document.createElement('div');
  cardWrap.className = 'relative';
  cardWrap.appendChild(createTransfer());
  transferSection.appendChild(cardWrap);

  main.appendChild(transferSection);

  // Bottom spacer — as if FAQ content was here
  const bottomSpacer = document.createElement('div');
  bottomSpacer.className = 'h-48 lg:h-64';
  main.appendChild(bottomSpacer);

  zLayer.appendChild(main);
  zLayer.appendChild(createFooter());

  wrapper.appendChild(zLayer);
  root.appendChild(wrapper);

  createConsentModal();
}
