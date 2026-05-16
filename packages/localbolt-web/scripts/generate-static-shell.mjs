import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const distIndex = resolve('dist/index.html');
const html = readFileSync(distIndex, 'utf8');

const staticRoot = String.raw`<div id="root" data-render="static-shell">
  <div class="relative bg-dark text-white">
    <div class="relative z-10">
      <header class="border-b border-white/[0.06] bg-dark/80 backdrop-blur-sm sticky top-0 z-50">
        <div class="container mx-auto px-4 flex h-12 items-center justify-between">
          <a href="/" class="flex items-center gap-2 group">
            <svg class="w-4 h-4 text-neon transition-all duration-300 group-hover:fill-neon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg>
            <span style="font-family:'JetBrains Mono',monospace" class="text-[13px] font-bold tracking-tight text-white/90">LocalBolt</span>
          </a>
          <div class="flex items-center gap-1.5">
            <div class="status-dot w-1.5 h-1.5 rounded-full bg-red-500/70"></div>
            <span style="font-family:'JetBrains Mono',monospace" class="status-label text-[10px] text-white/30 tracking-widest">OFFLINE</span>
          </div>
        </div>
      </header>

      <main>
        <section class="min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center text-center px-4 animate-fade-up">
          <div class="max-w-3xl space-y-4">
            <h1 class="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent pb-1 leading-[1.15]">Open-Source Encrypted File Transfer</h1>
            <p class="text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">Send files directly between nearby devices on the same local network. End-to-end encrypted, peer-to-peer, no cloud storage. Built on the <span class="text-white/70">Bolt Protocol</span>.</p>
          </div>
          <a class="scroll-btn inline-flex items-center gap-1 text-sm text-neon/70 hover:text-neon transition-colors pt-6" href="#transfer" aria-label="Scroll to file transfer">
            <svg class="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
          </a>
        </section>

        <section id="transfer" class="relative min-h-screen flex items-center justify-center px-4">
          <div class="absolute inset-0 pointer-events-none">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(164,226,0,0.09),transparent_60%)] animate-pulse"></div>
            <div class="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(circle,white_20%,transparent_65%)]"></div>
          </div>
          <div class="relative w-full max-w-2xl mx-auto">
            <div class="relative overflow-hidden p-8 md:p-10 max-w-2xl mx-auto space-y-6 bg-dark-accent/40 backdrop-blur-xl border border-neon/20 rounded-xl shadow-[0_0_40px_rgba(164,226,0,0.12)] animate-fade-up transition-all duration-500">
              <div class="absolute inset-0 bg-gradient-to-br from-neon/5 via-transparent to-transparent opacity-60"></div>
              <div class="absolute inset-0 bg-gradient-to-t from-dark/20 via-transparent to-transparent"></div>
              <div class="relative text-center space-y-3">
                <p class="text-xs uppercase tracking-[0.2em] text-neon/70">Same-network transfer</p>
                <h2 class="text-2xl font-semibold">Open LocalBolt on another nearby device</h2>
                <p class="text-sm text-gray-400 max-w-md mx-auto">The interactive transfer panel loads in your browser. File contents transfer directly between connected devices and are not uploaded to cloud storage.</p>
              </div>
            </div>
          </div>
        </section>

        <div class="container mx-auto px-4 py-24 lg:py-32 space-y-20">
          <section aria-label="How It Works" class="space-y-6 max-w-4xl mx-auto">
            <div class="text-center">
              <h2 class="text-2xl font-bold mb-2">How It Works</h2>
              <p class="text-sm text-gray-500">Start sharing files in seconds. Browser or desktop app, no accounts needed.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="relative flex items-start gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/5"><div class="flex-shrink-0 w-7 h-7 bg-neon/10 text-neon rounded-md flex items-center justify-center text-xs font-bold">1</div><div class="min-w-0"><h3 class="text-sm font-semibold mb-1">Open on Both Devices</h3><p class="text-xs text-gray-500 leading-relaxed">Visit localbolt.app in a browser or use the desktop app on devices on the same local network.</p></div></div>
              <div class="relative flex items-start gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/5"><div class="flex-shrink-0 w-7 h-7 bg-neon/10 text-neon rounded-md flex items-center justify-center text-xs font-bold">2</div><div class="min-w-0"><h3 class="text-sm font-semibold mb-1">Select a Device</h3><p class="text-xs text-gray-500 leading-relaxed">Devices appear automatically. Tap one to send an encrypted connection request.</p></div></div>
              <div class="relative flex items-start gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/5"><div class="flex-shrink-0 w-7 h-7 bg-neon/10 text-neon rounded-md flex items-center justify-center text-xs font-bold">3</div><div class="min-w-0"><h3 class="text-sm font-semibold mb-1">Transfer Directly</h3><p class="text-xs text-gray-500 leading-relaxed">Drag and drop files. End-to-end encrypted, peer-to-peer, no size limits.</p></div></div>
            </div>
          </section>

          <section aria-label="Features" class="space-y-6 max-w-5xl mx-auto">
            <div class="text-center max-w-3xl mx-auto">
              <h2 class="text-2xl font-bold mb-2">Open-Source Security, Zero Trust by Design</h2>
              <p class="text-sm text-gray-500 leading-relaxed">LocalBolt uses NaCl/Curve25519 encryption to transfer files directly between devices with zero cloud storage. The Bolt Protocol and cryptographic SDK are open source.</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up">
              <div class="p-4 rounded-lg bg-white/[0.02] border border-white/5"><h3 class="text-sm font-semibold mb-1">End-to-End Encryption</h3><p class="text-xs text-gray-500 leading-relaxed">Every file is encrypted with NaCl/Curve25519 before transfer.</p></div>
              <div class="p-4 rounded-lg bg-white/[0.02] border border-white/5"><h3 class="text-sm font-semibold mb-1">Direct P2P Transfer</h3><p class="text-xs text-gray-500 leading-relaxed">Files transfer directly between connected devices over encrypted data channels.</p></div>
              <div class="p-4 rounded-lg bg-white/[0.02] border border-white/5"><h3 class="text-sm font-semibold mb-1">Zero Cloud Storage</h3><p class="text-xs text-gray-500 leading-relaxed">Your file contents are not uploaded to LocalBolt servers.</p></div>
              <div class="p-4 rounded-lg bg-white/[0.02] border border-white/5"><h3 class="text-sm font-semibold mb-1">Works on Your LAN</h3><p class="text-xs text-gray-500 leading-relaxed">Nearby devices on the same local network appear automatically. Remote-network transfer is outside LocalBolt scope.</p></div>
            </div>
          </section>

          <section aria-label="Frequently Asked Questions" class="space-y-6 max-w-3xl mx-auto">
            <div class="text-center">
              <h2 class="text-2xl font-bold mb-2">FAQ</h2>
              <p class="text-sm text-gray-500">Common questions about encrypted peer-to-peer file transfer</p>
            </div>
            <div class="space-y-1.5">
              <details class="group border border-white/5 rounded-lg px-5 bg-white/[0.02]"><summary class="cursor-pointer text-left text-sm py-4 list-none">Does LocalBolt work without internet?</summary><p class="text-xs text-gray-500 pb-4">Yes. LocalBolt is designed for local-network transfer. When you self-host or run the desktop app, devices on the same LAN can find each other with no internet connection needed. LocalBolt does not provide cross-internet discovery or transfer.</p></details>
              <details class="group border border-white/5 rounded-lg px-5 bg-white/[0.02]"><summary class="cursor-pointer text-left text-sm py-4 list-none">Can I self-host LocalBolt?</summary><p class="text-xs text-gray-500 pb-4">Yes. Clone the repo, run the start script, and you have your own private instance with its own signaling server for LAN use.</p></details>
            </div>
          </section>
        </div>
      </main>
    </div>
  </div>
</div>`;

if (!html.includes('<div id="root"></div>')) {
  throw new Error('Expected empty root div was not found in dist/index.html');
}

writeFileSync(distIndex, html.replace('<div id="root"></div>', staticRoot));
console.log('Generated LocalBolt static shell into dist/index.html');
