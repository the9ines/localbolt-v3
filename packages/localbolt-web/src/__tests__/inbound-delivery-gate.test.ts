/**
 * Inbound file delivery gating.
 *
 * handleFileReceive is the only place in the codebase that writes a received
 * file to disk (createObjectURL + anchor click). Every transport - WebRTC,
 * direct WS, direct WebTransport - funnels into it, and both the modern and
 * legacy TransferManager receive paths end there.
 *
 * It ran ungated: a peer that completed HELLO but had not been verified could
 * push a file straight into the user's downloads. The outbound picker was gated
 * by isTransferAllowed; inbound was not. This pins the same policy on both
 * directions.
 *
 * Scope note: this prevents WRITING the file, not receiving it. The bytes are
 * still transferred and assembled in memory before being discarded. Refusing
 * the transfer itself would be a protocol-boundary change.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type TransportOpts = {
  daemonUrl: string;
  onVerification?: (info: { state: string; sasCode: string | null }) => void;
  onReceiveFile?: (file: Blob, filename: string) => void;
};

let wsOpts: TransportOpts[] = [];
let signalHandler: ((signal: Record<string, any>) => void) | null = null;
let selectPeerCb: ((peerCode: string) => void) | null = null;
let showToastCalls: unknown[][] = [];

const mockState: Record<string, unknown> = {};

vi.mock('@the9ines/bolt-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  generateSecurePeerCode: () => 'TEST-CODE',
}));

// Real localbolt-core is used below; it imports `store` from here.
vi.mock('@the9ines/localbolt-browser', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    isPrivateIP: actual.isPrivateIP,
    store: {
      getState: () => ({ ...mockState }),
      setState: (partial: Record<string, unknown>) => Object.assign(mockState, partial),
      subscribe: vi.fn(),
    },
    // Stable delegate so assertions survive module resets.
    showToast: (...args: unknown[]) => { showToastCalls.push(args); },
    createConnectionStatus: () => document.createElement('div'),
    createDeviceDiscovery: (select: (peerCode: string) => void) => {
      selectPeerCb = select;
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
      constructor(opts: TransportOpts) { wsOpts.push(opts); }
      connect() { return Promise.resolve(true); }
      disconnect() {}
      markPeerVerified() { return Promise.resolve(); }
    },
    WebRTCService: class {
      setConnectionStateHandler() {}
      getRemotePeerCode() { return 'DESKTOP-PEER'; }
      connect() { return Promise.resolve(); }
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

// ── Download observation ─────────────────────────────────────────────────

let createObjectURLCalls: unknown[] = [];
let anchorClicks = 0;
let clickSpy: ReturnType<typeof vi.spyOn>;

const PEER = 'DESKTOP-PEER';
const flush = () => new Promise((r) => setTimeout(r, 0));

/** Fresh module graph; peer-connection and core must share one core instance. */
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

/** Connect over a LAN direct-WS transport and return its captured options. */
async function connectDirectWs(): Promise<TransportOpts> {
  selectPeerCb!(PEER);
  await flush();
  signalHandler!({
    type: 'connection_accepted',
    from: PEER,
    data: { wsUrl: 'ws://192.168.1.50:8080' },
  });
  await flush();
  return wsOpts[0];
}

function deliveredToDisk(): boolean {
  return createObjectURLCalls.length > 0 || anchorClicks > 0;
}

beforeEach(() => {
  wsOpts = [];
  signalHandler = null;
  selectPeerCb = null;
  showToastCalls = [];
  createObjectURLCalls = [];
  anchorClicks = 0;

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

  // jsdom does not implement object URLs.
  (URL as any).createObjectURL = (blob: unknown) => {
    createObjectURLCalls.push(blob);
    return 'blob:mock';
  };
  (URL as any).revokeObjectURL = () => {};

  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    anchorClicks += 1;
  });
});

afterEach(() => {
  clickSpy.mockRestore();
});

// ── Blocked states ───────────────────────────────────────────────────────

describe('inbound delivery is blocked when transfer is not allowed', () => {
  it('does not write to disk with no verification info yet', async () => {
    const core = await mount();
    const opts = await connectDirectWs();

    // Nothing has reported verification; R3b leaves this as no-info.
    expect(core.getVerificationState()).toBeNull();
    expect(mockState.isConnected).toBe(true);

    opts.onReceiveFile!(new Blob(['payload']), 'secret.txt');

    expect(createObjectURLCalls).toEqual([]);
    expect(anchorClicks).toBe(0);
    expect(deliveredToDisk()).toBe(false);
  });

  it('does not write to disk while unverified', async () => {
    const core = await mount();
    const opts = await connectDirectWs();

    opts.onVerification!({ state: 'unverified', sasCode: '1234' });
    expect(core.getVerificationState()?.state).toBe('unverified');

    opts.onReceiveFile!(new Blob(['payload']), 'secret.txt');

    expect(createObjectURLCalls).toEqual([]);
    expect(anchorClicks).toBe(0);
  });

  it('shows a toast and does not throw when blocked', async () => {
    await mount();
    const opts = await connectDirectWs();

    expect(() => opts.onReceiveFile!(new Blob(['payload']), 'secret.txt')).not.toThrow();

    expect(showToastCalls.length).toBeGreaterThan(0);
    expect(anchorClicks).toBe(0);
  });
});

// ── Allowed states ───────────────────────────────────────────────────────

describe('inbound delivery still works when transfer is allowed', () => {
  it('delivers when verified', async () => {
    await mount();
    const opts = await connectDirectWs();

    opts.onVerification!({ state: 'verified', sasCode: '1234' });
    opts.onReceiveFile!(new Blob(['payload']), 'ok.txt');

    expect(createObjectURLCalls).toHaveLength(1);
    expect(anchorClicks).toBe(1);
  });

  it('delivers for a genuine legacy peer (pre-SAS compatibility guard)', async () => {
    const core = await mount();
    const opts = await connectDirectWs();

    opts.onVerification!({ state: 'legacy', sasCode: null });
    expect(core.getVerificationState()?.state).toBe('legacy');

    opts.onReceiveFile!(new Blob(['payload']), 'legacy-peer.txt');

    expect(createObjectURLCalls).toHaveLength(1);
    expect(anchorClicks).toBe(1);
  });
});

// ── Ordering guard ───────────────────────────────────────────────────────

describe('pre-verification window', () => {
  it('a normal direct-WS connect reporting verification before the file still delivers', async () => {
    await mount();
    const opts = await connectDirectWs();

    // Realistic ordering: HELLO completes and reports verification, then the
    // transfer completes. This must not be caught by the gate.
    opts.onVerification!({ state: 'verified', sasCode: 'ABCD' });
    await flush();
    opts.onReceiveFile!(new Blob(['payload']), 'ordered.txt');

    expect(anchorClicks).toBe(1);
    expect(showToastCalls.filter((c) => String(c[0]).toLowerCase().includes('block'))).toEqual([]);
  });
});
