import { icons } from '@/ui/icons';

export function createHeader(): HTMLElement {
  const header = document.createElement('header');
  header.className = 'border-b border-white/10 bg-dark/50 backdrop-blur-md sticky top-0 z-50';
  header.innerHTML = `
    <div class="container mx-auto px-4">
      <div class="flex h-16 items-center justify-between">
        <a href="/" class="flex items-center space-x-2 group" onclick="event.preventDefault(); window.scrollTo({top:0,behavior:'smooth'})">
          ${icons.zap('w-8 h-8 text-neon transition-all duration-300 group-hover:fill-neon')}
          <span class="text-xl font-semibold">LocalBolt</span>
        </a>
        <div class="glass flex items-center px-4 py-1.5 space-x-2 rounded-xl border border-white/10">
          <div class="w-2 h-2 rounded-full bg-neon animate-pulse"></div>
          <span class="text-sm text-white/80">Network Active</span>
        </div>
      </div>
    </div>
  `;
  return header;
}
