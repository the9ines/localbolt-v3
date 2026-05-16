import { escapeHTML } from '../lib/sanitize.js';
import type { VerificationInfo } from '../services/webrtc/types.js';

export interface VerificationStatusOptions {
  onMarkVerified: () => void;
}

/**
 * Create a verification status indicator component.
 *
 * Returns the DOM element and an `update()` function to re-render
 * when the verification state changes.
 */
export function createVerificationStatus(
  options: VerificationStatusOptions,
): { element: HTMLElement; update: (info: VerificationInfo) => void } {
  const container = document.createElement('div');
  container.className = 'flex items-center gap-2 text-sm';

  function render(info: VerificationInfo) {
    container.innerHTML = '';

    const dot = document.createElement('span');
    dot.className = 'inline-block w-2 h-2 rounded-full flex-shrink-0';

    switch (info.state) {
      case 'verified': {
        dot.classList.add('bg-green-400');
        const label = document.createElement('span');
        label.className = 'text-green-400';
        label.textContent = 'Verified';
        container.append(dot, label);
        break;
      }

      case 'unverified': {
        dot.classList.add('bg-yellow-400');

        const sasWrap = document.createElement('div');
        sasWrap.className = 'flex flex-col';

        const sasLabel = document.createElement('span');
        sasLabel.className = 'text-yellow-400 font-mono tracking-wider';
        sasLabel.textContent = info.sasCode ? escapeHTML(info.sasCode) : '';

        // RU2: concise guidance text (PM-RU-01 approved)
        const guidance = document.createElement('span');
        guidance.className = 'text-[10px] text-yellow-400/60';
        guidance.textContent = 'Compare this code with the other device.';

        sasWrap.append(sasLabel, guidance);

        const btn = document.createElement('button');
        btn.className =
          'ml-2 px-2 py-0.5 text-xs rounded border border-yellow-400/30 ' +
          'text-yellow-400 hover:bg-yellow-400/10 transition-colors';
        btn.textContent = 'Mark Verified';
        btn.addEventListener('click', options.onMarkVerified);

        container.append(dot, sasWrap, btn);
        break;
      }

      case 'legacy': {
        dot.classList.add('bg-gray-500');
        const label = document.createElement('span');
        label.className = 'text-gray-500';
        label.textContent = 'Legacy Peer';
        container.append(dot, label);
        break;
      }
    }
  }

  // Initial render - legacy until verification state arrives
  render({ state: 'legacy', sasCode: null });

  return { element: container, update: render };
}
