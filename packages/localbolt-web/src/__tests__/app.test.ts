import { describe, it, expect, vi } from 'vitest';

// ── Mock @the9ines/bolt-core ────────────────────────────────────────────
vi.mock('@the9ines/bolt-core', () => ({
  generateSecurePeerCode: () => 'MOCK-PEER-CODE',
}));

// ── Mock @the9ines/bolt-transport-web ───────────────────────────────────
vi.mock('@the9ines/bolt-transport-web', () => {
  const state: Record<string, unknown> = {
    signalingConnected: false,
    isConnected: false,
    peerCode: null,
    peers: [],
    connectingTo: null,
    connectedDevice: null,
    incomingRequest: null,
    showDeviceList: false,
    transferProgress: null,
  };
  const subs: Array<() => void> = [];

  const iconFn = (cls?: string) =>
    `<svg class="${cls ?? ''}"></svg>`;

  return {
    store: {
      getState: () => ({ ...state }),
      setState: (partial: Record<string, unknown>) => Object.assign(state, partial),
      subscribe: (fn: () => void) => { subs.push(fn); },
    },
    icons: new Proxy({}, { get: () => iconFn }),
    showToast: vi.fn(),
    createFileUpload: () => document.createElement('div'),
    createConnectionStatus: () => document.createElement('div'),
    createDeviceDiscovery: () => document.createElement('div'),
    setWebrtcRef: vi.fn(),
    detectDeviceType: () => 'desktop',
    getDeviceName: () => 'Test Device',
    detectDevice: () => ({ isLinux: false, isWindows: false, isMobile: false }),
    DualSignaling: class {
      connect() { return Promise.resolve(); }
      setConnectionStateHandler() {}
      onPeerDiscovered() {}
      onPeerLost() {}
      onSignal() {}
      sendSignal() { return Promise.resolve(); }
      isConnected() { return false; }
    },
    WebRTCService: class {
      setConnectionStateHandler() {}
      getRemotePeerCode() { return ''; }
      disconnect() {}
      markPeerVerified() { return Promise.resolve(); }
    },
    WebRTCError: class extends Error { details?: string; },
    SignalingError: class extends Error {},
    IndexedDBIdentityStore: class {
      load() { return Promise.resolve(null); }
      save() { return Promise.resolve(); }
    },
    getOrCreateIdentity: vi.fn().mockResolvedValue({
      publicKey: new Uint8Array(32),
      secretKey: new Uint8Array(32),
    }),
    IndexedDBPinStore: class {
      getPin() { return Promise.resolve(null); }
      setPin() { return Promise.resolve(); }
      removePin() { return Promise.resolve(); }
      markVerified() { return Promise.resolve(); }
    },
    createVerificationStatus: () => ({
      element: document.createElement('div'),
      update: vi.fn(),
    }),
    initPolicyAdapter: () => Promise.resolve({ name: 'ts-fallback' }),
  };
});

// ── Tests ───────────────────────────────────────────────────────────────
import { createApp } from '../app';

describe('createApp', () => {
  it('renders without throwing', () => {
    const root = document.createElement('div');
    expect(() => createApp(root)).not.toThrow();
  });

  it('populates the root element with content', () => {
    const root = document.createElement('div');
    createApp(root);
    expect(root.children.length).toBeGreaterThan(0);
  });
});
