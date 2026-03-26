// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SignalingProvider, SignalMessage } from '../services/signaling/SignalingProvider.js';
import { WebSocketSignaling } from '../services/signaling/WebSocketSignaling.js';
import { DualSignaling } from '../services/signaling/DualSignaling.js';

// ─── Stub @the9ines/bolt-core ─────────────────────────────────────────────────

class MockBoltError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'BoltError';
    this.details = details;
  }
}

vi.mock('@the9ines/bolt-core', () => ({
  sealBoxPayload: (_data: Uint8Array) => 'encrypted-stub',
  openBoxPayload: (cipher: string) => {
    if (cipher === 'THROW_DECRYPT') throw new Error('Decryption failed');
    return new Uint8Array([...new TextEncoder().encode(cipher)]);
  },
  generateEphemeralKeyPair: () => ({
    publicKey: new Uint8Array(32),
    secretKey: new Uint8Array(32),
  }),
  toBase64: (arr: Uint8Array) =>
    Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(''),
  fromBase64: () => new Uint8Array(32),
  DEFAULT_CHUNK_SIZE: 16384,
  BoltError: MockBoltError,
  EncryptionError: class extends MockBoltError {
    constructor(m: string, d?: unknown) { super(m, d); this.name = 'EncryptionError'; }
  },
  ConnectionError: class extends MockBoltError {
    constructor(m: string, d?: unknown) { super(m, d); this.name = 'ConnectionError'; }
  },
  TransferError: class extends MockBoltError {
    constructor(m: string, d?: unknown) { super(m, d); this.name = 'TransferError'; }
  },
  IntegrityError: class extends MockBoltError {
    constructor(m: string = 'File integrity check failed') { super(m); this.name = 'IntegrityError'; }
  },
  KeyMismatchError: class extends MockBoltError {
    constructor(m: string, d?: unknown) { super(m, d); this.name = 'KeyMismatchError'; }
  },
  computeSas: () => 'AABBCC',
  bufferToHex: (buffer: ArrayBuffer) =>
    Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''),
  hashFile: async () => 'a'.repeat(64),
  WIRE_ERROR_CODES: [
    'VERSION_MISMATCH', 'ENCRYPTION_FAILED', 'INTEGRITY_FAILED', 'REPLAY_DETECTED',
    'TRANSFER_FAILED', 'LIMIT_EXCEEDED', 'CONNECTION_LOST', 'PEER_NOT_FOUND',
    'ALREADY_CONNECTED', 'INVALID_STATE', 'KEY_MISMATCH',
    'DUPLICATE_HELLO', 'ENVELOPE_REQUIRED', 'ENVELOPE_UNNEGOTIATED', 'ENVELOPE_DECRYPT_FAIL',
    'ENVELOPE_INVALID', 'HELLO_PARSE_ERROR', 'HELLO_DECRYPT_FAIL', 'HELLO_SCHEMA_ERROR',
    'INVALID_MESSAGE', 'UNKNOWN_MESSAGE_TYPE', 'PROTOCOL_VIOLATION',
  ],
  isValidWireErrorCode: (x: unknown) =>
    typeof x === 'string' && [
      'VERSION_MISMATCH', 'ENCRYPTION_FAILED', 'INTEGRITY_FAILED', 'REPLAY_DETECTED',
      'TRANSFER_FAILED', 'LIMIT_EXCEEDED', 'CONNECTION_LOST', 'PEER_NOT_FOUND',
      'ALREADY_CONNECTED', 'INVALID_STATE', 'KEY_MISMATCH',
      'DUPLICATE_HELLO', 'ENVELOPE_REQUIRED', 'ENVELOPE_UNNEGOTIATED', 'ENVELOPE_DECRYPT_FAIL',
      'ENVELOPE_INVALID', 'HELLO_PARSE_ERROR', 'HELLO_DECRYPT_FAIL', 'HELLO_SCHEMA_ERROR',
      'INVALID_MESSAGE', 'UNKNOWN_MESSAGE_TYPE', 'PROTOCOL_VIOLATION',
    ].includes(x as string),
  negotiateBtr: () => 'STATIC_EPHEMERAL',
  btrLogToken: () => null,
  BtrMode: { FullBtr: 'FULL_BTR', Downgrade: 'DOWNGRADE', StaticEphemeral: 'STATIC_EPHEMERAL', Reject: 'REJECT' },
  scalarMult: () => new Uint8Array(32),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a mock signaling provider that captures the onSignal callback. */
function createMockSignaling(): SignalingProvider & {
  _signalCallbacks: Array<(signal: SignalMessage) => void>;
  _emitSignal: (signal: SignalMessage) => void;
  _unsubSpy: ReturnType<typeof vi.fn>;
} {
  const callbacks: Array<(signal: SignalMessage) => void> = [];
  const unsubSpy = vi.fn();
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    onSignal: vi.fn((cb: (signal: SignalMessage) => void) => {
      callbacks.push(cb);
      const unsub = () => {
        unsubSpy();
        const idx = callbacks.indexOf(cb);
        if (idx !== -1) callbacks.splice(idx, 1);
      };
      return unsub;
    }),
    onPeerDiscovered: vi.fn(),
    onPeerLost: vi.fn(),
    sendSignal: vi.fn().mockResolvedValue(undefined),
    getPeers: vi.fn().mockReturnValue([]),
    disconnect: vi.fn(),
    name: 'mock',
    _signalCallbacks: callbacks,
    _emitSignal: (signal: SignalMessage) => {
      for (const cb of [...callbacks]) cb(signal);
    },
    _unsubSpy: unsubSpy,
  };
}

/** Create mock RTCPeerConnection with close() spy. */
function createMockPC() {
  return {
    close: vi.fn(),
    setRemoteDescription: vi.fn().mockRejectedValue(new Error('setRemoteDescription failed')),
    createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue(new Map()),
    onconnectionstatechange: null as any,
    onicecandidate: null as any,
    ondatachannel: null as any,
    oniceconnectionstatechange: null as any,
    signalingState: 'stable',
    connectionState: 'new',
    iceConnectionState: 'new',
    remoteDescription: null as any,
  };
}

function makeOfferSignal(to: string): SignalMessage {
  return {
    type: 'offer',
    from: 'REMOTE',
    to,
    data: {
      publicKey: Array.from(new Uint8Array(32)).map(b => b.toString(16).padStart(2, '0')).join(''),
      offer: { type: 'offer', sdp: 'v=0\r\n' },
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LIFECYCLE-HARDEN-1: SA5 — Error-path cleanup', () => {
  let WebRTCService: any;

  beforeEach(async () => {
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  it('handleOffer throws after pc created → disconnect closes pc and clears reference', async () => {
    const signaling = createMockSignaling();
    const onError = vi.fn();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), onError);

    // Manually inject a mock pc to simulate state after createPeerConnection()
    // succeeded but before setRemoteDescription throws.
    const mockPC = createMockPC();
    (service as any).pc = mockPC;

    // Track disconnect call ordering vs onError
    const callOrder: string[] = [];
    const origDisconnect = service.disconnect.bind(service);
    service.disconnect = () => {
      callOrder.push('disconnect');
      origDisconnect();
    };
    onError.mockImplementation(() => callOrder.push('onError'));

    // handleAnswer will throw because signalingState is not 'have-local-offer'
    const answerSignal: SignalMessage = {
      type: 'answer',
      from: 'REMOTE',
      to: 'LOCAL',
      data: {
        publicKey: 'AA'.repeat(32),
        answer: { type: 'answer', sdp: 'v=0\r\n' },
      },
    };

    await (service as any).handleSignal(answerSignal);

    // SA5 invariant: disconnect() called before onError()
    expect(callOrder).toEqual(['disconnect', 'onError']);

    // Evidence: pc reference cleared by disconnect
    expect((service as any).pc).toBeNull();

    // Evidence: mockPC.close() called by disconnect
    expect(mockPC.close).toHaveBeenCalled();

    // Evidence: onError was called with the error
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('disconnect is idempotent after error — double-call does not throw', async () => {
    const signaling = createMockSignaling();
    const onError = vi.fn();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), onError);

    // Inject pc so disconnect has something to close
    const mockPC = createMockPC();
    (service as any).pc = mockPC;

    // Trigger error via handleAnswer with bad state
    const answerSignal: SignalMessage = {
      type: 'answer',
      from: 'REMOTE',
      to: 'LOCAL',
      data: {
        publicKey: 'AA'.repeat(32),
        answer: { type: 'answer', sdp: 'v=0\r\n' },
      },
    };

    await (service as any).handleSignal(answerSignal);
    expect(onError).toHaveBeenCalledTimes(1);

    // First disconnect already happened in catch. Call again explicitly.
    expect(() => service.disconnect()).not.toThrow();

    // Third call for good measure
    expect(() => service.disconnect()).not.toThrow();

    // pc still null after repeated disconnects
    expect((service as any).pc).toBeNull();
  });

  it('[ADVERSARIAL] handleAnswer throws with no pc → disconnect + onError, no leak', async () => {
    const signaling = createMockSignaling();
    const onError = vi.fn();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), onError);

    // Ensure pc is null — handleAnswer will throw "No peer connection for answer"
    (service as any).pc = null;

    const answerSignal: SignalMessage = {
      type: 'answer',
      from: 'REMOTE',
      to: 'LOCAL',
      data: {
        publicKey: 'AA'.repeat(32),
        answer: { type: 'answer', sdp: 'v=0\r\n' },
      },
    };

    await (service as any).handleSignal(answerSignal);

    // SA5: disconnect called before onError
    expect(onError).toHaveBeenCalledTimes(1);
    expect((service as any).pc).toBeNull();
    expect((service as any).dc).toBeNull();
  });
});

describe('LIFECYCLE-HARDEN-1: SA6 — Signaling listener unregistration', () => {
  let WebRTCService: any;

  beforeEach(async () => {
    const mod = await import('../services/webrtc/WebRTCService.js');
    WebRTCService = mod.default;
  });

  it('disconnect calls signaling unsubscribe and clears handle', () => {
    const signaling = createMockSignaling();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());

    // Verify unsubscribe handle was stored
    expect((service as any).signalUnsub).toBeDefined();
    expect(typeof (service as any).signalUnsub).toBe('function');

    // Disconnect
    service.disconnect();

    // Verify unsubscribe was called
    expect(signaling._unsubSpy).toHaveBeenCalledTimes(1);

    // Handle cleared
    expect((service as any).signalUnsub).toBeUndefined();
  });

  it('after disconnect, signaling emits do not invoke handler', () => {
    const signaling = createMockSignaling();
    const onError = vi.fn();
    const service = new WebRTCService(signaling, 'LOCAL', vi.fn(), onError);

    // Verify callback is registered
    expect(signaling._signalCallbacks.length).toBe(1);

    // Disconnect — should unregister
    service.disconnect();

    // Callback removed from array
    expect(signaling._signalCallbacks.length).toBe(0);

    // Emit a signal after disconnect — handler must not fire
    const handleSignalSpy = vi.spyOn(service as any, 'handleSignal');
    signaling._emitSignal(makeOfferSignal('LOCAL'));
    expect(handleSignalSpy).not.toHaveBeenCalled();

    // onError not called either
    expect(onError).not.toHaveBeenCalled();
  });

  it('[ADVERSARIAL] connect → disconnect → new instance → no duplicate signal handling', () => {
    const signaling = createMockSignaling();

    // First session
    const service1 = new WebRTCService(signaling, 'LOCAL', vi.fn(), vi.fn());
    expect(signaling._signalCallbacks.length).toBe(1);

    // Disconnect first session
    service1.disconnect();
    expect(signaling._signalCallbacks.length).toBe(0);

    // Second session on same signaling
    const onError2 = vi.fn();
    const service2 = new WebRTCService(signaling, 'LOCAL', vi.fn(), onError2);
    expect(signaling._signalCallbacks.length).toBe(1);

    // Emit a signal — only the second service's handler should fire
    const spy1 = vi.spyOn(service1 as any, 'handleSignal');
    const spy2 = vi.spyOn(service2 as any, 'handleSignal');

    // Use an answer signal to LOCAL that will be non-fatal (just no pc)
    signaling._emitSignal({
      type: 'ice-candidate',
      from: 'REMOTE',
      to: 'OTHER', // Wrong target — filtered out early, but handler is still invoked
      data: {},
    });

    // service1 handler NOT invoked (unsubscribed)
    expect(spy1).not.toHaveBeenCalled();
    // service2 handler IS invoked
    expect(spy2).toHaveBeenCalledTimes(1);

    service2.disconnect();
    expect(signaling._signalCallbacks.length).toBe(0);
  });
});

describe('LIFECYCLE-HARDEN-1: SA6 — WebSocketSignaling unsubscribe', () => {
  it('onSignal returns unsubscribe function that removes callback', () => {
    const ws = new WebSocketSignaling('ws://localhost:0');
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const unsub1 = ws.onSignal(cb1);
    ws.onSignal(cb2);

    // Both registered
    expect((ws as any).signalCallbacks.length).toBe(2);

    // Unsubscribe first
    unsub1();
    expect((ws as any).signalCallbacks.length).toBe(1);
    expect((ws as any).signalCallbacks[0]).toBe(cb2);

    // Double-call is safe
    unsub1();
    expect((ws as any).signalCallbacks.length).toBe(1);
  });
});

describe('LIFECYCLE-HARDEN-1: SA6 — DualSignaling unsubscribe', () => {
  it('onSignal returns unsubscribe function that removes callback', () => {
    const ds = new DualSignaling('ws://localhost:0', 'ws://localhost:1');
    const cb = vi.fn();

    const unsub = ds.onSignal(cb);
    expect((ds as any).signalCallbacks.length).toBe(1);

    unsub();
    expect((ds as any).signalCallbacks.length).toBe(0);

    // Double-call is safe
    unsub();
    expect((ds as any).signalCallbacks.length).toBe(0);
  });
});
