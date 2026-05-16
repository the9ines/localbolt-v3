import { beforeEach, describe, it, expect, vi } from 'vitest';

const sdkMocks = vi.hoisted(() => {
  const state: Record<string, unknown> = {
    signalingConnected: false,
    isConnected: false,
    peerCode: null,
    peers: [],
    connectingTo: null,
    connectingPhase: null,
    connectedDevice: null,
    incomingRequest: null,
    showDeviceList: false,
    transferProgress: null,
  };
  const subs: Array<() => void> = [];
  const addManualPeer = vi.fn();
  const sendSignal = vi.fn().mockResolvedValue(undefined);
  let manualPeerHandler: ((code: string) => void) | null = null;

  return {
    state,
    subs,
    addManualPeer,
    sendSignal,
    getManualPeerHandler: () => manualPeerHandler,
    setManualPeerHandler: (handler: (code: string) => void) => {
      manualPeerHandler = handler;
    },
    reset: () => {
      Object.assign(state, {
        signalingConnected: false,
        isConnected: false,
        peerCode: null,
        peers: [],
        connectingTo: null,
        connectingPhase: null,
        connectedDevice: null,
        incomingRequest: null,
        showDeviceList: false,
        transferProgress: null,
      });
      subs.length = 0;
      addManualPeer.mockClear();
      sendSignal.mockClear();
      manualPeerHandler = null;
    },
  };
});

// ── Mock @the9ines/bolt-core ────────────────────────────────────────────
vi.mock('@the9ines/bolt-core', () => ({
  generateSecurePeerCode: () => 'MOCK-PEER-CODE',
}));

// ── Mock @the9ines/localbolt-browser ───────────────────────────────────
vi.mock('@the9ines/localbolt-browser', () => {
  const iconFn = (cls?: string) =>
    `<svg class="${cls ?? ''}"></svg>`;

  return {
    store: {
      getState: () => ({ ...sdkMocks.state }),
      setState: (partial: Record<string, unknown>) => Object.assign(sdkMocks.state, partial),
      subscribe: (fn: () => void) => { sdkMocks.subs.push(fn); },
    },
    icons: new Proxy({}, { get: () => iconFn }),
    showToast: vi.fn(),
    createFileUpload: () => document.createElement('div'),
    createConnectionStatus: () => document.createElement('div'),
    createDeviceDiscovery: (_onSelect: (code: string) => void, onManual: (code: string) => void) => {
      sdkMocks.setManualPeerHandler(onManual);
      return document.createElement('div');
    },
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
      sendSignal(type: string, data: unknown, to: string) {
        return sdkMocks.sendSignal(type, data, to);
      }
      addManualPeer(code: string) {
        sdkMocks.addManualPeer(code);
      }
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
import { _resetForTest } from '@the9ines/localbolt-core';

beforeEach(() => {
  sdkMocks.reset();
  _resetForTest();
  sessionStorage.clear();
});

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

  it('manual peer code fallback registers manual peer and sends request', async () => {
    const root = document.createElement('div');
    createApp(root);

    const handler = sdkMocks.getManualPeerHandler();
    expect(handler).toBeTruthy();
    handler?.('abc-123');

    expect(sdkMocks.addManualPeer).toHaveBeenCalledWith('ABC123');
    expect(sdkMocks.state.connectingTo).toBe('ABC123');
    expect(sdkMocks.state.peers).toEqual([
      expect.objectContaining({
        peerCode: 'ABC123',
        deviceName: 'Peer ABC123',
      }),
    ]);
    expect(sdkMocks.sendSignal).toHaveBeenCalledWith(
      'connection_request',
      { deviceName: 'Test Device', deviceType: 'desktop' },
      'ABC123',
    );
  });
});
