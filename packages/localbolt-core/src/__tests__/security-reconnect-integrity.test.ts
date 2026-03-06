/**
 * R1-4 — Security-focused reconnect integrity tests.
 *
 * Covers R1-0 medium-gap scenarios for localbolt-v3/localbolt-core:
 * 1. Crypto-path integrity around reconnect boundary (verification + generation + transfer policy)
 * 2. Trust/verification state isolation between consecutive peers/sessions
 *
 * These tests make explicit what existing session-hardening tests prove
 * implicitly, combining generation guard + verification state + transfer
 * policy into composite reconnect-boundary scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock SDK store ────────────────────────────────────────────────────────

const mockState: Record<string, unknown> = {
  isConnected: false,
  connectedDevice: null,
  connectingTo: null,
  incomingRequest: null,
  transferProgress: null,
  showDeviceList: false,
  signalingConnected: false,
  peerCode: null,
  peers: [],
};

vi.mock('@the9ines/bolt-transport-web', () => ({
  store: {
    getState: () => ({ ...mockState }),
    setState: (partial: Record<string, unknown>) => Object.assign(mockState, partial),
    subscribe: vi.fn(),
  },
  showToast: vi.fn(),
}));

// ── Import after mock ─────────────────────────────────────────────────────

import {
  getGeneration, isCurrentGeneration,
  beginRequest, beginConnecting, markConnected, resetSession,
  _resetForTest,
} from '../session-state';
import {
  getVerificationState, setVerificationState, resetVerificationState,
} from '../verification-state';
import { isTransferAllowed } from '../transfer-policy';

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetForTest();
  resetVerificationState();
  Object.assign(mockState, {
    isConnected: false,
    connectedDevice: null,
    connectingTo: null,
    incomingRequest: null,
    transferProgress: null,
    showDeviceList: false,
  });
});

// ── Helper ────────────────────────────────────────────────────────────────

function connectToPeer(peerCode: string): number {
  beginRequest(peerCode);
  beginConnecting(peerCode);
  markConnected();
  mockState.isConnected = true;
  return getGeneration();
}

// ── 1. Crypto-path integrity around reconnect boundary ────────────────────

describe('R1-4: Crypto-path integrity around reconnect boundary', () => {
  it('generation guard + verification reset + transfer policy are consistent at boundary', () => {
    // Session A: fully verified, transfer allowed
    const genA = connectToPeer('PEER-A');
    setVerificationState({ state: 'verified', sasCode: 'SAS-A' });
    expect(isTransferAllowed('verified', true)).toBe(true);

    // Disconnect
    resetSession();
    mockState.isConnected = false;

    // At boundary: generation stale, verification reset, transfer blocked
    expect(isCurrentGeneration(genA)).toBe(false);
    expect(getVerificationState().state).toBe('legacy');
    expect(isTransferAllowed(getVerificationState().state, false)).toBe(false);

    // Session B: new generation, new verification required
    const genB = connectToPeer('PEER-B');
    expect(genB).toBeGreaterThan(genA);
    expect(getVerificationState().state).toBe('legacy');

    // SDK emits unverified for B — transfer blocked until verified
    setVerificationState({ state: 'unverified', sasCode: 'SAS-B' });
    expect(isTransferAllowed('unverified', true)).toBe(false);

    // User verifies B — transfer now allowed
    setVerificationState({ state: 'verified', sasCode: 'SAS-B' });
    expect(isTransferAllowed('verified', true)).toBe(true);
  });

  it('stale verification callback guarded by generation cannot bypass transfer gate', () => {
    const genA = connectToPeer('PEER-A');
    setVerificationState({ state: 'unverified', sasCode: 'SAS-A' });

    resetSession();
    mockState.isConnected = false;

    // Stale callback from A tries to set verified
    if (isCurrentGeneration(genA)) {
      setVerificationState({ state: 'verified', sasCode: 'SAS-A' });
    }

    // Guard prevented mutation — verification is legacy, transfer blocked
    expect(getVerificationState().state).toBe('legacy');
    expect(isTransferAllowed(getVerificationState().state, false)).toBe(false);
  });

  it('mismatch path: crypto-path correctly terminates and resets', () => {
    connectToPeer('PEER-A');
    setVerificationState({ state: 'unverified', sasCode: 'SAS-A' });

    // Mismatch detected by SDK → error handler calls resetSession
    const genBeforeMismatch = getGeneration();
    resetSession();
    mockState.isConnected = false;

    // All crypto-path state cleared
    expect(isCurrentGeneration(genBeforeMismatch)).toBe(false);
    expect(getVerificationState().state).toBe('legacy');
    expect(isTransferAllowed(getVerificationState().state, false)).toBe(false);
  });
});

// ── 2. Trust/verification state isolation between sessions ────────────────

describe('R1-4: Trust/verification isolation between consecutive sessions', () => {
  it('verified session A → disconnect → session B starts at legacy', () => {
    connectToPeer('PEER-A');
    setVerificationState({ state: 'verified', sasCode: 'SAS-A' });

    resetSession();
    mockState.isConnected = false;

    connectToPeer('PEER-B');
    expect(getVerificationState().state).toBe('legacy');
    expect(getVerificationState().sasCode).toBeNull();
  });

  it('SAS code isolation: A and B have independent SAS codes', () => {
    connectToPeer('PEER-A');
    setVerificationState({ state: 'unverified', sasCode: 'SAS-ALPHA' });

    resetSession();
    connectToPeer('PEER-B');
    setVerificationState({ state: 'unverified', sasCode: 'SAS-BETA' });

    expect(getVerificationState().sasCode).toBe('SAS-BETA');
    expect(getVerificationState().sasCode).not.toBe('SAS-ALPHA');
  });

  it('same peer reconnect: trust must be re-established', () => {
    connectToPeer('PEER-A');
    setVerificationState({ state: 'verified', sasCode: 'SAS-A-1' });

    resetSession();
    connectToPeer('PEER-A'); // same peer, new session
    expect(getVerificationState().state).toBe('legacy');
    // SDK will re-emit verification state — must verify again
  });

  it('three consecutive peers: no trust leakage across any boundary', () => {
    const peers = ['PEER-X', 'PEER-Y', 'PEER-Z'];
    const sasCodes = ['SAS-X', 'SAS-Y', 'SAS-Z'];

    for (let i = 0; i < peers.length; i++) {
      // Before each session: state must be legacy
      expect(getVerificationState().state).toBe('legacy');

      connectToPeer(peers[i]);
      setVerificationState({ state: 'unverified', sasCode: sasCodes[i] });
      expect(getVerificationState().sasCode).toBe(sasCodes[i]);

      setVerificationState({ state: 'verified', sasCode: sasCodes[i] });
      expect(isTransferAllowed('verified', true)).toBe(true);

      resetSession();
      mockState.isConnected = false;
    }

    // After all sessions: clean legacy
    expect(getVerificationState().state).toBe('legacy');
  });
});
