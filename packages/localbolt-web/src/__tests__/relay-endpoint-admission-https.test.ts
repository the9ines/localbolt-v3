/**
 * @vitest-environment-options { "url": "https://lan-page.test/" }
 *
 * Direct-endpoint admission from an HTTPS origin.
 *
 * Two rules must hold together here, and neither may mask the other:
 *  - mixed content: an HTTPS page still may not dial ws://, only wss://
 *  - locality: wss:// to a public host is still refused
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let wsTransportUrls: string[] = [];
let wtTransportUrls: string[] = [];
let signalHandler: ((signal: Record<string, any>) => void) | null = null;
let phase = 'idle';

const mockState: Record<string, unknown> = {};

vi.mock('@the9ines/bolt-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  generateSecurePeerCode: () => 'TEST-CODE',
}));

vi.mock('@the9ines/localbolt-browser', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    isPrivateIP: actual.isPrivateIP,
    store: {
      getState: () => ({ ...mockState }),
      setState: (partial: Record<string, unknown>) => Object.assign(mockState, partial),
      subscribe: vi.fn(),
    },
    showToast: vi.fn(),
    createConnectionStatus: () => document.createElement('div'),
    createDeviceDiscovery: () => document.createElement('div'),
    createVerificationStatus: () => ({
      element: document.createElement('div'),
      update: vi.fn(),
    }),
    setWebrtcRef: vi.fn(),
    setDirectTransportRef: vi.fn(),
    detectDeviceType: () => 'desktop',
    getDeviceName: () => 'Test Device',
    detectDevice: () => ({ isLinux: false, isWindows: false, isMobile: false }),
    IndexedDBPinStore: class {
      getPin() { return Promise.resolve(null); }
      setPin() { return Promise.resolve(); }
      markVerified() { return Promise.resolve(); }
    },
    DualSignaling: class {
      connect() { return Promise.resolve(); }
      setConnectionStateHandler() {}
      onPeerDiscovered() {}
      onPeerLost() {}
      onSignal(fn: (signal: Record<string, any>) => void) { signalHandler = fn; }
      sendSignal() { return Promise.resolve(); }
      isConnected() { return true; }
    },
    BrowserAppTransport: class {
      constructor(opts: { daemonUrl: string }) { wsTransportUrls.push(opts.daemonUrl); }
      connect() { return Promise.resolve(); }
      disconnect() {}
      markPeerVerified() { return Promise.resolve(); }
    },
    WtDataTransport: class {
      constructor(opts: { daemonUrl: string }) { wtTransportUrls.push(opts.daemonUrl); }
      connect() { return Promise.resolve(true); }
      disconnect() {}
      markPeerVerified() { return Promise.resolve(); }
    },
    WebRTCService: class {
      setConnectionStateHandler() {}
      getRemotePeerCode() { return ''; }
      connect() { return Promise.resolve(); }
      disconnect() {}
      markPeerVerified() { return Promise.resolve(); }
    },
    WebRTCError: class extends Error {},
    SignalingError: class extends Error {},
  };
});

vi.mock('@the9ines/localbolt-core', () => ({
  setVerificationState: vi.fn(),
  getPhase: () => phase,
  getGeneration: () => 1,
  isCurrentGeneration: () => true,
  beginRequest: vi.fn(() => true),
  receiveRequest: vi.fn(),
  beginConnecting: vi.fn(),
  markConnected: vi.fn(),
  resetSession: vi.fn(),
}));

vi.mock('@/services/identity', () => ({
  initIdentity: vi.fn().mockResolvedValue({ publicKey: new Uint8Array(32) }),
}));

const PEER = 'DESKTOP-PEER';

async function acceptedWith(data: Record<string, unknown>) {
  vi.resetModules();
  const mod = await import('../components/peer-connection');
  mod.createPeerConnection();
  await Promise.resolve();
  await Promise.resolve();

  phase = 'requesting';
  mockState.connectingTo = PEER;
  signalHandler!({ type: 'connection_accepted', from: PEER, data });
  await Promise.resolve();
}

beforeEach(() => {
  wsTransportUrls = [];
  wtTransportUrls = [];
  signalHandler = null;
  phase = 'idle';
  Object.assign(mockState, {
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
  sessionStorage.clear?.();
  (globalThis as any).WebTransport = class {};
});

afterEach(() => {
  delete (globalThis as any).WebTransport;
});

describe('HTTPS origin', () => {
  it('is actually running on an HTTPS origin', () => {
    expect(window.location.protocol).toBe('https:');
  });

  it('still blocks ws:// to a LAN host (mixed content preserved)', async () => {
    await acceptedWith({ wsUrl: 'ws://192.168.1.50:8080' });

    expect(wsTransportUrls).toEqual([]);
  });

  it('still admits wss:// to a LAN host', async () => {
    await acceptedWith({ wsUrl: 'wss://192.168.1.50:443' });

    expect(wsTransportUrls).toEqual(['wss://192.168.1.50:443']);
  });

  it('rejects wss:// to a public host', async () => {
    await acceptedWith({ wsUrl: 'wss://attacker.example.com:443' });

    expect(wsTransportUrls).toEqual([]);
  });

  it('rejects a public WebTransport endpoint', async () => {
    await acceptedWith({
      wtUrl: 'https://attacker.example.com:4433',
      certHash: 'a'.repeat(64),
    });

    expect(wtTransportUrls).toEqual([]);
  });

  it('still admits a LAN WebTransport endpoint', async () => {
    await acceptedWith({
      wtUrl: 'https://192.168.1.50:4433',
      certHash: 'a'.repeat(64),
    });

    expect(wtTransportUrls).toEqual(['https://192.168.1.50:4433']);
  });
});
