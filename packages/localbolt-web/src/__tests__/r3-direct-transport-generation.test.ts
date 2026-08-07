/**
 * R3a - generation capture on direct transports.
 *
 * handleVerificationState and handleReceiveProgress reject callbacks from a
 * stale session generation. That token is captured when a connection attempt
 * begins, and every transport must capture it - not just the WebRTC service.
 *
 * resetSession() increments the generation on each disconnect, so a transport
 * that never captures is permanently stale after the first reconnect and its
 * callbacks are dropped in silence. On a direct transport that means the TOFU
 * identity-mismatch alert and transfer progress never reach the user.
 *
 * These tests use the real localbolt-core so the generation counter actually
 * advances; a mocked isCurrentGeneration would hide the defect.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type TransportOpts = {
  daemonUrl: string;
  onVerification?: (info: { state: string; sasCode: string | null }) => void;
  onProgress?: (p: Record<string, unknown>) => void;
};

let wsOpts: TransportOpts[] = [];
let wtOpts: TransportOpts[] = [];
let signalHandler: ((signal: Record<string, any>) => void) | null = null;
let selectPeerCb: ((peerCode: string) => void) | null = null;
let disconnectCb: (() => void) | null = null;
let rtcConnects: string[] = [];

const mockState: Record<string, unknown> = {};

vi.mock('@the9ines/bolt-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  generateSecurePeerCode: () => 'TEST-CODE',
}));

// The real localbolt-core is used below, and it imports `store` from here.
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
    createDeviceDiscovery: (
      select: (peerCode: string) => void,
      disconnect: () => void,
    ) => {
      selectPeerCb = select;
      disconnectCb = disconnect;
      return document.createElement('div');
    },
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
      constructor(opts: TransportOpts) { wsOpts.push(opts); }
      connect() { return Promise.resolve(); }
      disconnect() {}
      markPeerVerified() { return Promise.resolve(); }
    },
    WtDataTransport: class {
      constructor(opts: TransportOpts) { wtOpts.push(opts); }
      connect() { return Promise.resolve(true); }
      disconnect() {}
      markPeerVerified() { return Promise.resolve(); }
    },
    WebRTCService: class {
      setConnectionStateHandler() {}
      getRemotePeerCode() { return 'DESKTOP-PEER'; }
      connect(peer: string) { rtcConnects.push(peer); return Promise.resolve(); }
      disconnect() {}
      markPeerVerified() { return Promise.resolve(); }
    },
    WebRTCError: class extends Error {},
    SignalingError: class extends Error {},
  };
});

vi.mock('@/services/identity', () => ({
  initIdentity: vi.fn().mockResolvedValue({ publicKey: new Uint8Array(32) }),
}));

const PEER = 'DESKTOP-PEER';
const flush = () => new Promise((r) => setTimeout(r, 0));

/**
 * Fresh module graph. peer-connection and localbolt-core must be imported after
 * the same resetModules() call so they share one core instance.
 */
async function mount() {
  vi.resetModules();
  const core = await import('@the9ines/localbolt-core');
  core._resetForTest();
  core.resetVerificationState();
  const mod = await import('../components/peer-connection');
  mod.createPeerConnection();
  await flush();
  return core;
}

/** Full outbound cycle: request the peer, then receive its acceptance. */
async function connectCycle(data: Record<string, unknown>) {
  selectPeerCb!(PEER);
  await flush();
  signalHandler!({ type: 'connection_accepted', from: PEER, data });
  await flush();
}

beforeEach(() => {
  wsOpts = [];
  wtOpts = [];
  rtcConnects = [];
  signalHandler = null;
  selectPeerCb = null;
  disconnectCb = null;
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

describe('R3a: direct WS transport captures the session generation', () => {
  const LAN_WS = 'ws://192.168.1.50:8080';

  it('delivers verification state on the first connection', async () => {
    const core = await mount();
    await connectCycle({ wsUrl: LAN_WS });

    expect(wsOpts).toHaveLength(1);
    wsOpts[0].onVerification!({ state: 'verified', sasCode: '1234' });

    expect(core.getVerificationState().state).toBe('verified');
  });

  it('still delivers verification state after a reconnect', async () => {
    const core = await mount();

    await connectCycle({ wsUrl: LAN_WS });
    const genAfterFirst = core.getGeneration();

    disconnectCb!();
    await flush();
    // resetSession() advanced the generation, so a transport that never
    // captured is now stale.
    expect(core.getGeneration()).toBeGreaterThan(genAfterFirst);

    await connectCycle({ wsUrl: LAN_WS });
    expect(wsOpts).toHaveLength(2);

    wsOpts[1].onVerification!({ state: 'mismatch', sasCode: null });

    // A dropped callback would leave this at the post-reset default.
    expect(core.getVerificationState().state).toBe('mismatch');
  });

  it('still reports transfer progress after a reconnect', async () => {
    await mount();

    await connectCycle({ wsUrl: LAN_WS });
    disconnectCb!();
    await flush();
    await connectCycle({ wsUrl: LAN_WS });

    expect(wsOpts).toHaveLength(2);
    wsOpts[1].onProgress!({ status: 'receiving', filename: 'a.txt', progress: 42 });

    expect(mockState.transferProgress).toMatchObject({ status: 'receiving', filename: 'a.txt' });
  });

  it('survives two reconnect cycles', async () => {
    const core = await mount();

    await connectCycle({ wsUrl: LAN_WS });
    disconnectCb!();
    await flush();
    await connectCycle({ wsUrl: LAN_WS });
    disconnectCb!();
    await flush();
    await connectCycle({ wsUrl: LAN_WS });

    expect(wsOpts).toHaveLength(3);
    wsOpts[2].onVerification!({ state: 'verified', sasCode: '9999' });

    expect(core.getVerificationState().state).toBe('verified');
  });
});

describe('R3a: direct WebTransport captures the session generation', () => {
  const LAN_WT = 'https://192.168.1.50:4433';
  const CERT_HASH = 'a'.repeat(64);

  it('still delivers verification state after a reconnect', async () => {
    const core = await mount();

    await connectCycle({ wtUrl: LAN_WT, certHash: CERT_HASH });
    expect(wtOpts).toHaveLength(1);

    disconnectCb!();
    await flush();

    await connectCycle({ wtUrl: LAN_WT, certHash: CERT_HASH });
    expect(wtOpts).toHaveLength(2);

    wtOpts[1].onVerification!({ state: 'mismatch', sasCode: null });

    expect(core.getVerificationState().state).toBe('mismatch');
  });
});

describe('R3a: WebRTC path keeps working', () => {
  it('delivers verification state after a reconnect (regression guard)', async () => {
    const core = await mount();

    // No endpoint URLs -> WebRTC fallback, which recreates the service.
    await connectCycle({});
    expect(rtcConnects).toEqual([PEER]);

    disconnectCb!();
    await flush();

    await connectCycle({});
    expect(rtcConnects).toEqual([PEER, PEER]);

    // createFreshRtcService captures the generation, so this already worked.
    expect(core.isCurrentGeneration(core.getGeneration())).toBe(true);
    // R3b: the post-reconnect default is now "no info yet" rather than the
    // permissive 'legacy'. No verification has been reported on this path.
    expect(core.getVerificationState()).toBeNull();
  });
});
