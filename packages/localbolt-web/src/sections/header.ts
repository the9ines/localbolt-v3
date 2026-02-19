import { icons } from '@/ui/icons';

export function createHeader(): HTMLElement {
  const header = document.createElement('header');
  header.className = 'border-b border-white/[0.06] bg-dark/80 backdrop-blur-sm sticky top-0 z-50';
  header.innerHTML = `
    <div class="container mx-auto px-4 flex h-12 items-center justify-between">
      <a href="/" class="flex items-center gap-2 group" onclick="event.preventDefault(); window.scrollTo({top:0,behavior:'smooth'})">
        ${icons.zap('w-4 h-4 text-neon transition-all duration-300 group-hover:fill-neon')}
        <span style="font-family:'JetBrains Mono',monospace" class="text-[13px] font-bold tracking-tight text-white/90">LocalBolt</span>
      </a>
      <div class="flex items-center gap-1.5">
        <div class="w-1.5 h-1.5 rounded-full bg-neon/70 animate-pulse"></div>
        <span style="font-family:'JetBrains Mono',monospace" class="text-[10px] text-white/30 tracking-widest">ACTIVE</span>
      </div>
    </div>
  `;
  return header;
}
