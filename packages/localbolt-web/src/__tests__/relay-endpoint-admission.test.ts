/**
 * Relay-supplied direct endpoint admission.
 *
 * The signaling relay is untrusted: `wsUrl`, `wtUrl` and `certHash` arrive
 * inside connection_request / connection_accepted payloads and are attacker
 * controlled. LocalBolt is LAN-scoped, so a direct transport may only be
 * dialed when the endpoint host is local.
 *
 * That locality rule is not identical to the ICE candidate policy. Address
 * literals and mDNS `.local` names reuse the ICE private-address policy via
 * isPrivateIP, so there is one definition of "private address". Loopback is an
 * intentional direct-transport exception on top of it: isLocalCandidate has no
 * loopback rule, but a browser reaching the desktop app on the same machine is
 * the primary local-dev path. The ICE policy itself is unchanged.
 *
 * A scheme check alone is not admission control: wss:// and https:// say
 * nothing about where the host lives. Locality is likewise not sufficient on
 * its own - each transport also accepts only its own schemes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Captured constructor calls / callbacks ───────────────────────────────

let wsTransportUrls: string[] = [];
let wtTransportUrls: string[] = [];
let rtcConnectCalls: string[] = [];
let signalHandler: ((signal: Record<string, any>) => void) | null = null;
let acceptRequestCb: (() => void) | null = null;
let phase = 'idle';

const mockState: Record<string, unknown> = {};

function resetMockState() {
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
}

// Partial: the real SDK barrel is loaded below via importOriginal and needs
// the rest of bolt-core's exports intact.
vi.mock('@the9ines/bolt-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  generateSecurePeerCode: () => 'TEST-CODE',
}));

// Keep the real isPrivateIP — this suite asserts against the actual policy,
// not a stand-in for it.
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
      _select: () => void,
      _disconnect: () => void,
      accept: () => void,
    ) => {
      acceptRequestCb = accept;
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
      connect(peer: string) { rtcConnectCalls.push(peer); return Promise.resolve(); }
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

// ── Harness ──────────────────────────────────────────────────────────────

const PEER = 'DESKTOP-PEER';

/** Fresh peer-connection module instance (it holds module-level singletons). */
async function mountPeerConnection() {
  vi.resetModules();
  const mod = await import('../components/peer-connection');
  mod.createPeerConnection();
  await Promise.resolve();
  await Promise.resolve();
}

/** Drive the outbound path: we requested, desktop accepted with endpoints. */
async function acceptedWith(data: Record<string, unknown>) {
  phase = 'requesting';
  mockState.connectingTo = PEER;
  signalHandler!({ type: 'connection_accepted', from: PEER, data });
  await Promise.resolve();
}

/** Drive the inbound path: desktop requested, local user taps Accept. */
async function requestedThenAccept(data: Record<string, unknown>) {
  phase = 'idle';
  signalHandler!({
    type: 'connection_request',
    from: PEER,
    data: { deviceName: 'Desk', deviceType: 'desktop', ...data },
  });
  await Promise.resolve();
  phase = 'incoming_request';
  acceptRequestCb!();
  await Promise.resolve();
}

beforeEach(async () => {
  wsTransportUrls = [];
  wtTransportUrls = [];
  rtcConnectCalls = [];
  signalHandler = null;
  acceptRequestCb = null;
  phase = 'idle';
  resetMockState();
  sessionStorage.clear?.();
  // WebTransport is absent in jsdom; the WT path requires it to exist.
  (globalThis as any).WebTransport = class {};
  await mountPeerConnection();
});

afterEach(() => {
  delete (globalThis as any).WebTransport;
});

// ── Direct WS admission ──────────────────────────────────────────────────

describe('relay-supplied direct WS endpoints', () => {
  it('rejects a public hostname on the accepted path', async () => {
    await acceptedWith({ wsUrl: 'ws://attacker.example.com:8080' });

    expect(wsTransportUrls).toEqual([]);
    expect(rtcConnectCalls).toEqual([PEER]); // fell back to LAN-only WebRTC
  });

  it('rejects a public hostname over wss://', async () => {
    await acceptedWith({ wsUrl: 'wss://attacker.example.com:443' });

    expect(wsTransportUrls).toEqual([]);
  });

  it('rejects a public IP literal', async () => {
    await acceptedWith({ wsUrl: 'ws://93.184.216.34:8080' });

    expect(wsTransportUrls).toEqual([]);
  });

  it('rejects a public host that merely looks private', async () => {
    // isPrivateIP is a prefix regex; "10.evil.com" must not slip through as 10/8.
    await acceptedWith({ wsUrl: 'ws://10.evil.com:8080' });

    expect(wsTransportUrls).toEqual([]);
  });

  it('rejects a private-IP userinfo prefix on a public host', async () => {
    await acceptedWith({ wsUrl: 'ws://192.168.1.5@attacker.example.com:8080' });

    expect(wsTransportUrls).toEqual([]);
  });

  it('rejects a public hostname on the inbound accept path', async () => {
    await requestedThenAccept({ wsUrl: 'ws://attacker.example.com:8080' });

    expect(wsTransportUrls).toEqual([]);
  });

  it('still admits a LAN RFC1918 endpoint', async () => {
    await acceptedWith({ wsUrl: 'ws://192.168.1.50:8080' });

    expect(wsTransportUrls).toEqual(['ws://192.168.1.50:8080']);
  });

  it('still admits loopback for local dev', async () => {
    await acceptedWith({ wsUrl: 'ws://localhost:9876' });

    expect(wsTransportUrls).toEqual(['ws://localhost:9876']);
  });

  it('still admits a LAN endpoint on the inbound accept path', async () => {
    await requestedThenAccept({ wsUrl: 'ws://10.0.0.7:8080' });

    expect(wsTransportUrls).toEqual(['ws://10.0.0.7:8080']);
  });
});

// ── Transport/scheme pairing ─────────────────────────────────────────────

describe('relay-supplied endpoints must match their transport scheme', () => {
  const CERT_HASH = 'a'.repeat(64);

  it('does not hand an https:// URL to the WS transport', async () => {
    await acceptedWith({ wsUrl: 'https://192.168.1.50:4433' });

    expect(wsTransportUrls).toEqual([]);
    expect(rtcConnectCalls).toEqual([PEER]);
  });

  it('does not hand a ws:// URL to the WebTransport transport', async () => {
    await acceptedWith({ wtUrl: 'ws://192.168.1.50:8080', certHash: CERT_HASH });

    expect(wtTransportUrls).toEqual([]);
    expect(rtcConnectCalls).toEqual([PEER]);
  });

  it('does not hand a wss:// URL to the WebTransport transport', async () => {
    await acceptedWith({ wtUrl: 'wss://192.168.1.50:443', certHash: CERT_HASH });

    expect(wtTransportUrls).toEqual([]);
    expect(rtcConnectCalls).toEqual([PEER]);
  });

  it('does not cross schemes on the inbound accept path', async () => {
    await requestedThenAccept({ wsUrl: 'https://192.168.1.50:4433' });

    expect(wsTransportUrls).toEqual([]);
  });

  it('does not let a mismatched wsUrl reach the WT transport either', async () => {
    // A single payload carrying a scheme-swapped pair must satisfy neither gate.
    await acceptedWith({ wsUrl: 'https://192.168.1.50:4433', wtUrl: 'ws://192.168.1.50:8080', certHash: CERT_HASH });

    expect(wsTransportUrls).toEqual([]);
    expect(wtTransportUrls).toEqual([]);
    expect(rtcConnectCalls).toEqual([PEER]);
  });
});

// ── WebTransport admission ───────────────────────────────────────────────

describe('relay-supplied WebTransport endpoints', () => {
  const CERT_HASH = 'a'.repeat(64);

  it('rejects a public hostname even with a cert hash', async () => {
    await acceptedWith({ wtUrl: 'https://attacker.example.com:4433', certHash: CERT_HASH });

    expect(wtTransportUrls).toEqual([]);
    expect(rtcConnectCalls).toEqual([PEER]);
  });

  it('rejects a public IP literal even with a cert hash', async () => {
    await acceptedWith({ wtUrl: 'https://93.184.216.34:4433', certHash: CERT_HASH });

    expect(wtTransportUrls).toEqual([]);
  });

  it('rejects a public hostname on the inbound accept path', async () => {
    await requestedThenAccept({ wtUrl: 'https://attacker.example.com:4433', certHash: CERT_HASH });

    expect(wtTransportUrls).toEqual([]);
  });

  it('still admits a LAN endpoint with a cert hash', async () => {
    await acceptedWith({ wtUrl: 'https://192.168.1.50:4433', certHash: CERT_HASH });

    expect(wtTransportUrls).toEqual(['https://192.168.1.50:4433']);
  });

  it('still requires a cert hash for a local endpoint', async () => {
    await acceptedWith({ wtUrl: 'https://192.168.1.50:4433' });

    expect(wtTransportUrls).toEqual([]);
    expect(rtcConnectCalls).toEqual([PEER]);
  });
});
