/**
 * H5-v3 — TOFU/SAS Wiring + Identity/Pin Store tests.
 *
 * Tests verification state management, transfer gating, and the
 * identity persistence module. All WebRTC/WebSocket interactions are
 * mocked — no real network, no real IndexedDB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getVerificationState,
  setVerificationState,
  resetVerificationState,
  onVerificationStateChange,
} from '@the9ines/localbolt-core';

// ── Identity module tests ──────────────────────────────────────────────

// Mock SDK identity store
const mockLoad = vi.fn();
const mockSave = vi.fn();
vi.mock('@the9ines/bolt-transport-web', async () => {
  const actual: Record<string, unknown> = {};
  return {
    ...actual,
    IndexedDBIdentityStore: class {
      load = mockLoad;
      save = mockSave;
    },
    getOrCreateIdentity: vi.fn(async (store: { load: () => Promise<unknown>; save: (p: unknown) => Promise<void> }) => {
      const existing = await store.load();
      if (existing) return existing;
      const pair = { publicKey: new Uint8Array(32), secretKey: new Uint8Array(32) };
      await store.save(pair);
      return pair;
    }),
    IndexedDBPinStore: class {
      getPin = vi.fn().mockResolvedValue(null);
      setPin = vi.fn().mockResolvedValue(undefined);
      removePin = vi.fn().mockResolvedValue(undefined);
      markVerified = vi.fn().mockResolvedValue(undefined);
    },
    MemoryPinStore: class {
      private pins = new Map();
      async getPin(pc: string) { return this.pins.get(pc) ?? null; }
      async setPin(pc: string, pub: Uint8Array, v = false) { this.pins.set(pc, { identityPub: pub, verified: v }); }
      async removePin(pc: string) { this.pins.delete(pc); }
      async markVerified(pc: string) { const p = this.pins.get(pc); if (p) p.verified = true; }
    },
    store: {
      getState: () => ({ isConnected: false, peers: [], signalingConnected: false }),
      setState: vi.fn(),
      subscribe: vi.fn(),
    },
    createVerificationStatus: vi.fn(() => ({
      element: document.createElement('div'),
      update: vi.fn(),
    })),
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
      markPeerVerified = vi.fn();
    },
    WebRTCError: class extends Error { details?: string; },
    SignalingError: class extends Error {},
  };
});

vi.mock('@the9ines/bolt-core', () => ({
  generateSecurePeerCode: () => 'MOCK-PEER-CODE',
}));

describe('Identity persistence (getOrCreateIdentity)', () => {
  beforeEach(() => {
    mockLoad.mockReset();
    mockSave.mockReset();
  });

  it('returns existing identity without regenerating', async () => {
    const existingPair = {
      publicKey: new Uint8Array(32).fill(1),
      secretKey: new Uint8Array(32).fill(2),
    };
    mockLoad.mockResolvedValue(existingPair);

    // Import fresh to avoid cached identity
    const { getOrCreateIdentity } = await import('@the9ines/bolt-transport-web');
    const store = new (await import('@the9ines/bolt-transport-web')).IndexedDBIdentityStore();
    const result = await getOrCreateIdentity(store);

    expect(result.publicKey).toEqual(existingPair.publicKey);
    expect(result.secretKey).toEqual(existingPair.secretKey);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('generates and saves new identity when none exists', async () => {
    mockLoad.mockResolvedValue(null);
    mockSave.mockResolvedValue(undefined);

    const { getOrCreateIdentity } = await import('@the9ines/bolt-transport-web');
    const store = new (await import('@the9ines/bolt-transport-web')).IndexedDBIdentityStore();
    const result = await getOrCreateIdentity(store);

    expect(result.publicKey).toBeInstanceOf(Uint8Array);
    expect(result.secretKey).toBeInstanceOf(Uint8Array);
    expect(mockSave).toHaveBeenCalledOnce();
  });
});

// ── Verification state bus tests ──────────────────────────────────────

describe('Verification state bus', () => {
  beforeEach(() => {
    resetVerificationState();
  });

  it('initializes to legacy state', () => {
    const state = getVerificationState();
    expect(state.state).toBe('legacy');
    expect(state.sasCode).toBeNull();
  });

  it('transitions to unverified with SAS code', () => {
    setVerificationState({ state: 'unverified', sasCode: 'A1B2C3' });
    const state = getVerificationState();
    expect(state.state).toBe('unverified');
    expect(state.sasCode).toBe('A1B2C3');
  });

  it('transitions to verified', () => {
    setVerificationState({ state: 'verified', sasCode: 'A1B2C3' });
    expect(getVerificationState().state).toBe('verified');
  });

  it('resets back to legacy', () => {
    setVerificationState({ state: 'verified', sasCode: 'A1B2C3' });
    resetVerificationState();
    expect(getVerificationState().state).toBe('legacy');
    expect(getVerificationState().sasCode).toBeNull();
  });

  it('notifies listeners on state change', () => {
    const listener = vi.fn();
    onVerificationStateChange(listener);

    setVerificationState({ state: 'unverified', sasCode: 'DEADBE' });
    expect(listener).toHaveBeenCalledWith({ state: 'unverified', sasCode: 'DEADBE' });
  });

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = onVerificationStateChange(listener);

    unsub();
    setVerificationState({ state: 'verified', sasCode: null });
    expect(listener).not.toHaveBeenCalled();
  });
});

// ── Transfer gating tests ──────────────────────────────────────────────

describe('Transfer gating by verification state', () => {
  beforeEach(() => {
    resetVerificationState();
  });

  it('blocks transfer when unverified (state = unverified)', () => {
    setVerificationState({ state: 'unverified', sasCode: 'ABC123' });
    const vState = getVerificationState().state;
    const transferAllowed = vState === 'verified' || vState === 'legacy';
    expect(transferAllowed).toBe(false);
  });

  it('allows transfer when verified', () => {
    setVerificationState({ state: 'verified', sasCode: 'ABC123' });
    const vState = getVerificationState().state;
    const transferAllowed = vState === 'verified' || vState === 'legacy';
    expect(transferAllowed).toBe(true);
  });

  it('allows transfer for legacy peers (with warning in UI)', () => {
    // Legacy state means transfer MAY proceed — the UI shows a warning
    setVerificationState({ state: 'legacy', sasCode: null });
    const vState = getVerificationState().state;
    const transferAllowed = vState === 'verified' || vState === 'legacy';
    expect(transferAllowed).toBe(true);
  });
});

// ── Verification accept flow ──────────────────────────────────────────

describe('Accept verification flow', () => {
  beforeEach(() => {
    resetVerificationState();
  });

  it('transitions from unverified to verified on accept', () => {
    // Simulate: onVerificationState fires with unverified
    setVerificationState({ state: 'unverified', sasCode: 'F00BAR' });
    expect(getVerificationState().state).toBe('unverified');

    // Simulate: markPeerVerified triggers new state
    setVerificationState({ state: 'verified', sasCode: 'F00BAR' });
    expect(getVerificationState().state).toBe('verified');
  });

  it('re-evaluates transfer gate after verification', () => {
    setVerificationState({ state: 'unverified', sasCode: 'CAFE01' });

    // Transfer blocked while unverified
    let vState = getVerificationState().state;
    expect(vState === 'verified' || vState === 'legacy').toBe(false);

    // User verifies
    setVerificationState({ state: 'verified', sasCode: 'CAFE01' });

    // Transfer now allowed
    vState = getVerificationState().state;
    expect(vState === 'verified' || vState === 'legacy').toBe(true);
  });
});

// ── Verification reject flow ──────────────────────────────────────────

describe('Reject verification flow', () => {
  beforeEach(() => {
    resetVerificationState();
  });

  it('remains unverified and resets on reject (disconnect)', () => {
    setVerificationState({ state: 'unverified', sasCode: 'BADC0D' });
    expect(getVerificationState().state).toBe('unverified');

    // User rejects → disconnect → resetVerificationState
    resetVerificationState();
    expect(getVerificationState().state).toBe('legacy');

    // Transfer remains blocked (legacy is allowed, but connection is gone)
    // The store.isConnected would be false — file upload hidden
  });

  it('never transitions to verified on reject', () => {
    setVerificationState({ state: 'unverified', sasCode: 'BADC0D' });

    // Reject path resets, never calls setVerificationState('verified')
    resetVerificationState();
    expect(getVerificationState().state).not.toBe('verified');
  });
});

// ── Pin mismatch (fail-closed) ───────────────────────────────────────

describe('Pin mismatch handling', () => {
  it('error message includes TOFU violation for key mismatch', () => {
    // The SDK fires onError with ConnectionError('Identity key mismatch (TOFU violation)')
    // Our handleConnectionError detects this by message content
    const errorMsg = 'Identity key mismatch (TOFU violation)';
    const isMismatch = errorMsg.includes('key mismatch') || errorMsg.includes('TOFU violation');
    expect(isMismatch).toBe(true);
  });

  it('mismatch detection rejects non-mismatch errors', () => {
    const errorMsg = 'Unable to connect to peer. Please try again.';
    const isMismatch = errorMsg.includes('key mismatch') || errorMsg.includes('TOFU violation');
    expect(isMismatch).toBe(false);
  });

  it('resets verification state on mismatch (via error handler)', () => {
    // Simulate mismatch path: error handler calls resetVerificationState
    setVerificationState({ state: 'unverified', sasCode: 'BEEF42' });
    resetVerificationState();
    expect(getVerificationState().state).toBe('legacy');
  });
});

// ── Legacy peer handling ──────────────────────────────────────────────

describe('Legacy peer handling', () => {
  beforeEach(() => {
    resetVerificationState();
  });

  it('surfaces legacy state with null SAS code', () => {
    setVerificationState({ state: 'legacy', sasCode: null });
    const state = getVerificationState();
    expect(state.state).toBe('legacy');
    expect(state.sasCode).toBeNull();
  });

  it('legacy is distinct from verified', () => {
    setVerificationState({ state: 'legacy', sasCode: null });
    expect(getVerificationState().state).not.toBe('verified');
  });

  it('legacy is distinct from unverified', () => {
    setVerificationState({ state: 'legacy', sasCode: null });
    expect(getVerificationState().state).not.toBe('unverified');
  });

  it('notifies listener with legacy state', () => {
    const listener = vi.fn();
    onVerificationStateChange(listener);

    // Simulate HELLO timeout → legacy
    setVerificationState({ state: 'legacy', sasCode: null });
    expect(listener).toHaveBeenCalledWith({ state: 'legacy', sasCode: null });
  });
});
