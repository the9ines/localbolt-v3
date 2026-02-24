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
    },
    WebRTCError: class extends Error { details?: string; },
    SignalingError: class extends Error {},
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
