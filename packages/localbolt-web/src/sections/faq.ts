const faqs = [
  { q: 'How do I send large files without email?', a: 'Open LocalBolt on both devices. They can be on the same network or different networks. Devices appear automatically. Tap to connect, then drag and drop files to transfer directly with no account required.' },
  { q: 'Is LocalBolt safer than WeTransfer or Google Drive?', a: 'Significantly. WeTransfer and Google Drive store your files on their servers. LocalBolt transfers files directly between your devices using NaCl/Curve25519 encryption (the same standard used by Signal and WireGuard). Your files never touch any server. Not during transfer, not after.' },
  { q: 'Does LocalBolt work like AirDrop on Windows and Android?', a: 'Yes. LocalBolt works in modern browsers on Windows, macOS, Linux, Android, and iOS. Unlike AirDrop, it also works across different networks, not just devices near you.' },
  { q: 'How do I transfer files between iPhone and Android?', a: 'Open localbolt.site on both devices. They will discover each other automatically. Tap the device to connect, then send files directly between iPhone and Android from the browser.' },
  { q: 'Do I need to create an account?', a: 'No account is needed. LocalBolt works instantly in your browser with zero signup. Just open the website and start sharing. No email, no password, no personal information required.' },
  { q: "What's the maximum file size I can send?", a: 'LocalBolt does not enforce a file size cap. Practical limits are your device storage, memory, and network quality.' },
  { q: 'Does LocalBolt work across different networks?', a: 'Yes. LocalBolt uses dual signaling to discover devices both on your local network and across the internet. Same-network transfers are the fastest since data stays on your LAN.' },
  { q: 'Can I self-host LocalBolt?', a: 'Yes. LocalBolt is fully open source. Clone the repo from GitHub, run the start script, and you have your own private instance with its own signaling server. Works offline on your LAN with no internet required.' },
];

export function createFAQ(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-label', 'Frequently Asked Questions');
  section.className = 'space-y-6 max-w-3xl mx-auto';

  section.innerHTML = `
    <div class="text-center">
      <h2 class="text-2xl font-bold mb-2">FAQ</h2>
      <p class="text-sm text-gray-500">Common questions about encrypted peer-to-peer file transfer</p>
    </div>
    <div class="space-y-1.5">
      ${faqs.map(f => `
        <details class="group border border-white/5 rounded-lg px-5 bg-white/[0.02] transition-colors open:border-neon/15">
          <summary class="cursor-pointer text-left text-sm py-4 hover:text-neon transition-colors list-none flex items-center justify-between">
            ${f.q}
            <svg class="w-4 h-4 text-gray-500 shrink-0 ml-2 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
          </summary>
          <p class="text-xs text-gray-500 pb-4">${f.a}</p>
        </details>
      `).join('')}
    </div>
  `;
  return section;
}
