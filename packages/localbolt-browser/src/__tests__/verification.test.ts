// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
  generateEphemeralKeyPair,
  generateIdentityKeyPair,
  computeSas,
  toBase64,
  sealBoxPayload,
} from '@the9ines/bolt-core';
import { MemoryPinStore, verifyPinnedIdentity } from '../services/identity/pin-store.js';
import type { SignalingProvider } from '../services/signaling/SignalingProvider.js';

function randomKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
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

// ─── Pin Store Schema (7 tests) ─────────────────────────────────────────────

describe('Pin store schema evolution', () => {
  it('setPin stores verified=false by default', async () => {
    const store = new MemoryPinStore();
    const key = randomKey();
    await store.setPin('PEER01', key);

    const pin = await store.getPin('PEER01');
    expect(pin).not.toBeNull();
    expect(pin!.identityPub).toEqual(key);
    expect(pin!.verified).toBe(false);
  });

  it('setPin stores verified=true when specified', async () => {
    const store = new MemoryPinStore();
    const key = randomKey();
    await store.setPin('PEER01', key, true);

    const pin = await store.getPin('PEER01');
    expect(pin!.verified).toBe(true);
  });

  it('markVerified flips verified to true', async () => {
    const store = new MemoryPinStore();
    const key = randomKey();
    await store.setPin('PEER01', key);

    expect((await store.getPin('PEER01'))!.verified).toBe(false);
    await store.markVerified('PEER01');
    expect((await store.getPin('PEER01'))!.verified).toBe(true);
  });

  it('markVerified is no-op for unknown peer', async () => {
    const store = new MemoryPinStore();
    // Should not throw
    await store.markVerified('UNKNOWN');
    expect(await store.getPin('UNKNOWN')).toBeNull();
  });

  it('verifyPinnedIdentity returns { outcome: "pinned" } on first contact', async () => {
    const store = new MemoryPinStore();
    const key = randomKey();

    const result = await verifyPinnedIdentity(store, 'NEWPEER', key);
    expect(result).toEqual({ outcome: 'pinned' });
  });

  it('verifyPinnedIdentity returns { outcome: "verified", verified: false } for unverified', async () => {
    const store = new MemoryPinStore();
    const key = randomKey();
    await store.setPin('PEER01', key);

    const result = await verifyPinnedIdentity(store, 'PEER01', key);
    expect(result).toEqual({ outcome: 'verified', verified: false });
  });

  it('verifyPinnedIdentity returns { outcome: "verified", verified: true } after markVerified', async () => {
    const store = new MemoryPinStore();
    const key = randomKey();
    await store.setPin('PEER01', key);
    await store.markVerified('PEER01');

    const result = await verifyPinnedIdentity(store, 'PEER01', key);
    expect(result).toEqual({ outcome: 'verified', verified: true });
  });
});

// ─── SAS Integration (5 tests) ──────────────────────────────────────────────

describe('SAS integration with WebRTCService', () => {
  it('onVerificationState fires with SAS after processHello', async () => {
    const { default: WebRTCService } = await import(
      '../services/webrtc/WebRTCService.js'
    );
    const signaling = createMockSignaling();
    const localId = generateIdentityKeyPair();
    const remoteId = generateIdentityKeyPair();
    const pinStore = new MemoryPinStore();

    const states: Array<{ state: string; sasCode: string | null }> = [];
    const service = new WebRTCService(
      signaling,
      'LOCAL01',
      vi.fn(),
      vi.fn(),
      undefined,
      {
        identityPublicKey: localId.publicKey,
        pinStore,
        onVerificationState: (info) => states.push({ ...info }),
      },
    );

    // Simulate session keys (set via private fields for unit test)
    const localEph = generateEphemeralKeyPair();
    const remoteEph = generateEphemeralKeyPair();
    (service as any).keyPair = localEph;
    (service as any).remotePublicKey = remoteEph.publicKey;
    (service as any).remotePeerCode = 'REMOTE01';

    // Build encrypted HELLO from remote
    const hello = JSON.stringify({
      type: 'hello',
      version: 1,
      identityPublicKey: toBase64(remoteId.publicKey),
      capabilities: ['bolt.file-hash', 'bolt.profile-envelope-v1'],
    });
    const encrypted = sealBoxPayload(
      new TextEncoder().encode(hello),
      localEph.publicKey,
      remoteEph.secretKey,
    );

    // Process it
    await (service as any).processHello({ type: 'hello', payload: encrypted });

    // Callback fired exactly once
    expect(states).toHaveLength(1);
    expect(states[0].state).toBe('unverified');
    expect(states[0].sasCode).toBeTruthy();
    expect(states[0].sasCode).toHaveLength(6);
  });

  it('SAS matches canonical computeSas() output', async () => {
    const { default: WebRTCService } = await import(
      '../services/webrtc/WebRTCService.js'
    );
    const signaling = createMockSignaling();
    const localId = generateIdentityKeyPair();
    const remoteId = generateIdentityKeyPair();
    const pinStore = new MemoryPinStore();

    let receivedSas: string | null = null;
    const service = new WebRTCService(
      signaling,
      'LOCAL01',
      vi.fn(),
      vi.fn(),
      undefined,
      {
        identityPublicKey: localId.publicKey,
        pinStore,
        onVerificationState: (info) => { receivedSas = info.sasCode; },
      },
    );

    const localEph = generateEphemeralKeyPair();
    const remoteEph = generateEphemeralKeyPair();
    (service as any).keyPair = localEph;
    (service as any).remotePublicKey = remoteEph.publicKey;
    (service as any).remotePeerCode = 'REMOTE01';

    const hello = JSON.stringify({
      type: 'hello',
      version: 1,
      identityPublicKey: toBase64(remoteId.publicKey),
      capabilities: ['bolt.file-hash', 'bolt.profile-envelope-v1'],
    });
    const encrypted = sealBoxPayload(
      new TextEncoder().encode(hello),
      localEph.publicKey,
      remoteEph.secretKey,
    );

    await (service as any).processHello({ type: 'hello', payload: encrypted });

    // Compute expected SAS independently
    const expectedSas = await computeSas(
      localId.publicKey,
      remoteId.publicKey,
      localEph.publicKey,
      remoteEph.publicKey,
    );
    expect(receivedSas).toBe(expectedSas);
  });

  it('legacy session sets state to "legacy"', async () => {
    const { default: WebRTCService } = await import(
      '../services/webrtc/WebRTCService.js'
    );
    const signaling = createMockSignaling();

    const states: Array<{ state: string; sasCode: string | null }> = [];
    const service = new WebRTCService(
      signaling,
      'LOCAL01',
      vi.fn(),
      vi.fn(),
      undefined,
      {
        // No identityPublicKey → legacy mode
        onVerificationState: (info) => states.push({ ...info }),
      },
    );

    // initiateHello with no identity → should emit legacy
    (service as any).initiateHello();

    expect(states).toHaveLength(1);
    expect(states[0]).toEqual({ state: 'legacy', sasCode: null });

    const info = service.getVerificationInfo();
    expect(info.state).toBe('legacy');
    expect(info.sasCode).toBeNull();
  });

  it('markPeerVerified updates state and persists', async () => {
    const { default: WebRTCService } = await import(
      '../services/webrtc/WebRTCService.js'
    );
    const signaling = createMockSignaling();
    const localId = generateIdentityKeyPair();
    const remoteId = generateIdentityKeyPair();
    const pinStore = new MemoryPinStore();

    const states: Array<{ state: string; sasCode: string | null }> = [];
    const service = new WebRTCService(
      signaling,
      'LOCAL01',
      vi.fn(),
      vi.fn(),
      undefined,
      {
        identityPublicKey: localId.publicKey,
        pinStore,
        onVerificationState: (info) => states.push({ ...info }),
      },
    );

    const localEph = generateEphemeralKeyPair();
    const remoteEph = generateEphemeralKeyPair();
    (service as any).keyPair = localEph;
    (service as any).remotePublicKey = remoteEph.publicKey;
    (service as any).remotePeerCode = 'REMOTE01';

    // Process HELLO → pins identity, state = unverified
    const hello = JSON.stringify({
      type: 'hello',
      version: 1,
      identityPublicKey: toBase64(remoteId.publicKey),
      capabilities: ['bolt.file-hash', 'bolt.profile-envelope-v1'],
    });
    const encrypted = sealBoxPayload(
      new TextEncoder().encode(hello),
      localEph.publicKey,
      remoteEph.secretKey,
    );
    await (service as any).processHello({ type: 'hello', payload: encrypted });

    expect(states).toHaveLength(1);
    expect(states[0].state).toBe('unverified');

    // Mark verified
    await service.markPeerVerified();

    // Callback fired again with verified state
    expect(states).toHaveLength(2);
    expect(states[1].state).toBe('verified');
    // SAS code preserved
    expect(states[1].sasCode).toBe(states[0].sasCode);

    // Pin store persisted the verified flag
    const pin = await pinStore.getPin('REMOTE01');
    expect(pin!.verified).toBe(true);
  });

  it('disconnect clears verification info', async () => {
    const { default: WebRTCService } = await import(
      '../services/webrtc/WebRTCService.js'
    );
    const signaling = createMockSignaling();
    const localId = generateIdentityKeyPair();
    const pinStore = new MemoryPinStore();

    const service = new WebRTCService(
      signaling,
      'LOCAL01',
      vi.fn(),
      vi.fn(),
      undefined,
      {
        identityPublicKey: localId.publicKey,
        pinStore,
      },
    );

    // Manually set some verification state
    (service as any).verificationInfo = { state: 'verified', sasCode: 'AABB11' };
    (service as any).remoteIdentityKey = new Uint8Array(32);

    service.disconnect();

    const info = service.getVerificationInfo();
    expect(info).toEqual({ state: 'legacy', sasCode: null });
  });
});

// ─── UI Component Snapshot ──────────────────────────────────────────────────

describe('createVerificationStatus component', () => {
  // Minimal DOM stubs for node environment
  function createElement(tag: string) {
    const el: any = {
      tagName: tag.toUpperCase(),
      className: '',
      textContent: '',
      _innerHTML: '',
      children: [] as any[],
      classList: {
        _classes: new Set<string>(),
        add(...cls: string[]) { cls.forEach(c => this._classes.add(c)); },
        contains(c: string) { return this._classes.has(c); },
      },
      append(...nodes: any[]) { el.children.push(...nodes); },
      addEventListener: vi.fn(),
    };
    Object.defineProperty(el, 'innerHTML', {
      get() { return el._innerHTML; },
      set(v: string) { el._innerHTML = v; if (v === '') el.children.length = 0; },
    });
    return el;
  }

  // Stub document.createElement for this describe block
  const origCreateElement = globalThis.document?.createElement;
  beforeAll(() => {
    (globalThis as any).document = {
      createElement,
    };
  });
  afterAll(() => {
    if (origCreateElement) {
      (globalThis as any).document.createElement = origCreateElement;
    } else {
      delete (globalThis as any).document;
    }
  });

  // We need a fresh import after DOM stub is set up
  async function loadComponent() {
    // Clear module cache to pick up our stub
    const mod = await import('../components/verification-status.js');
    return mod.createVerificationStatus;
  }

  it('renders "Verified" state with green dot', async () => {
    const createVerificationStatus = await loadComponent();
    const { element, update } = createVerificationStatus({ onMarkVerified: vi.fn() });

    update({ state: 'verified', sasCode: 'AABB11' });

    // Should have dot + label
    expect(element.children.length).toBe(2);
    const dot = element.children[0];
    const label = element.children[1];
    expect(dot.classList.contains('bg-green-400')).toBe(true);
    expect(label.textContent).toBe('Verified');
  });

  it('renders "Unverified" state with SAS code and button', async () => {
    const onMarkVerified = vi.fn();
    const createVerificationStatus = await loadComponent();
    const { element, update } = createVerificationStatus({ onMarkVerified });

    update({ state: 'unverified', sasCode: 'AABB11' });

    // Should have dot + sasWrap (label + guidance) + button
    expect(element.children.length).toBe(3);
    const dot = element.children[0];
    const sasWrap = element.children[1];
    const btn = element.children[2];
    expect(dot.classList.contains('bg-yellow-400')).toBe(true);
    // RU2: SAS code is inside a wrapper that also contains guidance text
    expect(sasWrap.children[0].textContent).toBe('AABB11');
    expect(sasWrap.children[1].textContent).toBe('Compare this code with the other device.');
    expect(btn.textContent).toBe('Mark Verified');
    expect(btn.addEventListener).toHaveBeenCalledWith('click', onMarkVerified);
  });

  it('renders "Legacy Peer" state with gray dot', async () => {
    const createVerificationStatus = await loadComponent();
    const { element, update } = createVerificationStatus({ onMarkVerified: vi.fn() });

    update({ state: 'legacy', sasCode: null });

    expect(element.children.length).toBe(2);
    const dot = element.children[0];
    const label = element.children[1];
    expect(dot.classList.contains('bg-gray-500')).toBe(true);
    expect(label.textContent).toBe('Legacy Peer');
  });
});
