import { createHeader } from '@/sections/header';
import { createHero } from '@/sections/hero';
import { createHowItWorks } from '@/sections/how-it-works';
import { createTransfer } from '@/sections/transfer';
import { createTrustStrip } from '@/sections/trust-strip';
import { createFeatures } from '@/sections/features';
import { createFAQ } from '@/sections/faq';
import { createFooter } from '@/sections/footer';
import { createConsentModal } from '@/sections/consent-modal';

export function createApp(root: HTMLElement) {
  root.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'min-h-screen bg-dark text-white';

  // Background effects
  const radialBg = document.createElement('div');
  radialBg.className = 'absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(164,226,0,0.07),rgba(0,0,0,0))] animate-pulse';
  const gridBg = document.createElement('div');
  gridBg.className = "absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(white,transparent_80%)] pointer-events-none";

  const zLayer = document.createElement('div');
  zLayer.className = 'relative z-10';

  // Header
  zLayer.appendChild(createHeader());

  // Main
  const main = document.createElement('main');
  main.className = 'container mx-auto px-4';

  // Above the fold
  const aboveFold = document.createElement('div');
  aboveFold.className = 'py-12 lg:py-16 space-y-8';

  const transferEl = createTransfer();

  aboveFold.appendChild(createHero(() => {
    transferEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  aboveFold.appendChild(createHowItWorks());
  aboveFold.appendChild(transferEl);
  aboveFold.appendChild(createTrustStrip());

  main.appendChild(aboveFold);

  // Below the fold
  const belowFold = document.createElement('div');
  belowFold.className = 'border-t border-white/5 py-16 lg:py-20 space-y-16';
  belowFold.appendChild(createFeatures());
  belowFold.appendChild(createFAQ());
  main.appendChild(belowFold);

  zLayer.appendChild(main);
  zLayer.appendChild(createFooter());

  wrapper.append(radialBg, gridBg, zLayer);
  root.appendChild(wrapper);

  // Consent modal
  createConsentModal();
}
