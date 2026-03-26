// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { generateEphemeralKeyPair } from '@the9ines/bolt-core';
import { escapeHTML } from '../lib/sanitize.js';
import { showToast } from '../ui/toast.js';
import type { SignalingProvider } from '../services/signaling/SignalingProvider.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function uint8Equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function createMockSignaling(): SignalingProvider {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    onSignal: vi.fn(),
    onPeerDiscovered: vi.fn(),
    onPeerLost: vi.fn(),
    sendSignal: vi.fn().mockResolvedValue(undefined),
    getPeers: vi.fn().mockReturnValue([]),
    disconnect: vi.fn(),
    name: 'mock',
  };
}

// ─── S7: Ephemeral Key Lifecycle ────────────────────────────────────────────

describe('S7: ephemeral key lifecycle', () => {
  it('generateEphemeralKeyPair produces unique keys on each call', () => {
    const a = generateEphemeralKeyPair();
    const b = generateEphemeralKeyPair();

    expect(uint8Equal(a.publicKey, b.publicKey)).toBe(false);
    expect(uint8Equal(a.secretKey, b.secretKey)).toBe(false);
  });

  it('secretKey.fill(0) zeroes all bytes', () => {
    const kp = generateEphemeralKeyPair();
    // Confirm non-zero before fill
    const hasNonZero = kp.secretKey.some((b) => b !== 0);
    expect(hasNonZero).toBe(true);

    kp.secretKey.fill(0);
    const allZero = kp.secretKey.every((b) => b === 0);
    expect(allZero).toBe(true);
  });

  it('WebRTCService has null keyPair after construction', async () => {
    // Dynamic import to avoid top-level DOM dependency issues
    const { default: WebRTCService } = await import(
      '../services/webrtc/WebRTCService.js'
    );
    const signaling = createMockSignaling();
    const service = new WebRTCService(
      signaling,
      'TESTPC',
      () => {},
      () => {},
    );

    // keyPair is private — access via any cast for test verification
    const kp = (service as any).keyPair;
    expect(kp).toBeNull();

    service.disconnect();
  });

  it('WebRTCService generates fresh keyPair on connect()', async () => {
    const { default: WebRTCService } = await import(
      '../services/webrtc/WebRTCService.js'
    );
    const signaling = createMockSignaling();
    const service = new WebRTCService(
      signaling,
      'TESTPC',
      () => {},
      () => {},
    );

    expect((service as any).keyPair).toBeNull();

    // connect() will generate keys then try to create RTCPeerConnection
    // which will fail in jsdom — that's fine, we check keys were generated
    try {
      await service.connect('REMOTE');
    } catch {
      // Expected: RTCPeerConnection not available in jsdom
    }

    const kp = (service as any).keyPair;
    expect(kp).not.toBeNull();
    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.secretKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey.length).toBe(32);
    expect(kp.secretKey.length).toBe(32);
  });

  it('disconnect() clears keyPair to null', async () => {
    const { default: WebRTCService } = await import(
      '../services/webrtc/WebRTCService.js'
    );
    const signaling = createMockSignaling();
    const service = new WebRTCService(
      signaling,
      'TESTPC',
      () => {},
      () => {},
    );

    // Force a keyPair to exist
    (service as any).keyPair = generateEphemeralKeyPair();
    expect((service as any).keyPair).not.toBeNull();

    service.disconnect();

    expect((service as any).keyPair).toBeNull();
  });

  it('disconnect() zeroes secretKey before clearing', async () => {
    const { default: WebRTCService } = await import(
      '../services/webrtc/WebRTCService.js'
    );
    const signaling = createMockSignaling();
    const service = new WebRTCService(
      signaling,
      'TESTPC',
      () => {},
      () => {},
    );

    const kp = generateEphemeralKeyPair();
    const secretKeyRef = kp.secretKey; // hold reference
    (service as any).keyPair = kp;

    service.disconnect();

    // The original secretKey buffer should be zeroed
    const allZero = secretKeyRef.every((b: number) => b === 0);
    expect(allZero).toBe(true);
  });

  it('sequential connect/disconnect cycles produce different keys', async () => {
    const { default: WebRTCService } = await import(
      '../services/webrtc/WebRTCService.js'
    );
    const signaling = createMockSignaling();
    const service = new WebRTCService(
      signaling,
      'TESTPC',
      () => {},
      () => {},
    );

    const keys: Uint8Array[] = [];
    for (let i = 0; i < 3; i++) {
      try {
        await service.connect('REMOTE');
      } catch {
        // Expected in jsdom
      }
      keys.push(new Uint8Array((service as any).keyPair.publicKey));
      service.disconnect();
    }

    // All three public keys must be distinct
    expect(uint8Equal(keys[0], keys[1])).toBe(false);
    expect(uint8Equal(keys[1], keys[2])).toBe(false);
    expect(uint8Equal(keys[0], keys[2])).toBe(false);
  });
});

// ─── S6: Filename XSS ──────────────────────────────────────────────────────

describe('S6: escapeHTML', () => {
  it('escapes <script> tags', () => {
    expect(escapeHTML('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes img onerror payload', () => {
    const input = '"><img onerror=alert(1) src=x>';
    const result = escapeHTML(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
  });

  it('escapes all five HTML special characters', () => {
    const result = escapeHTML('&<>"\'');
    expect(result).toBe('&amp;&lt;&gt;&quot;&#039;');
  });

  it('passes through safe filenames unchanged', () => {
    expect(escapeHTML('document.pdf')).toBe('document.pdf');
    expect(escapeHTML('my-file_v2 (1).tar.gz')).toBe('my-file_v2 (1).tar.gz');
  });

  it('handles empty string', () => {
    expect(escapeHTML('')).toBe('');
  });

  it('handles unicode filenames', () => {
    const name = '\u6587\u4EF6\u540D.txt';
    expect(escapeHTML(name)).toBe(name);
  });

  it('handles max-length filenames (255 chars)', () => {
    const name = 'a'.repeat(255);
    expect(escapeHTML(name)).toBe(name);
  });
});

describe('S6: showToast XSS safety', () => {
  // Toast module caches a container element. Do not clear document.body
  // between tests — that detaches the container and causes stale references.
  // Instead, query the last matching element in each test.

  it('escapes XSS in title', () => {
    showToast('<script>alert(1)</script>');

    const titles = document.querySelectorAll('.text-sm.font-medium');
    const title = titles[titles.length - 1];
    expect(title).toBeDefined();
    expect(title.innerHTML).not.toContain('<script>');
    expect(title.textContent).toContain('<script>');
  });

  it('escapes XSS in description', () => {
    showToast('Safe title', '<img onerror=alert(1) src=x>');

    const descs = document.querySelectorAll('[class*="opacity-70"]');
    const desc = descs[descs.length - 1];
    expect(desc).toBeDefined();
    expect(desc.innerHTML).not.toContain('<img');
    expect(desc.textContent).toContain('<img');
  });

  it('renders safe content correctly', () => {
    showToast('Transfer complete', 'document.pdf has been sent successfully');

    const titles = document.querySelectorAll('.text-sm.font-medium');
    const title = titles[titles.length - 1];
    expect(title.textContent).toBe('Transfer complete');
    const descs = document.querySelectorAll('[class*="opacity-70"]');
    const desc = descs[descs.length - 1];
    expect(desc.textContent).toBe('document.pdf has been sent successfully');
  });
});
