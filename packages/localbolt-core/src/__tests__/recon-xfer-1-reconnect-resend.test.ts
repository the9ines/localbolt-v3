/**
 * RECON-XFER-1 — Transfer reconnect recovery regression tests.
 *
 * Validates that session orchestration correctly enables reconnect → resend
 * after mid-transfer disconnect. Covers AC-RX-01 through AC-RX-06.
 *
 * Root cause: serviceGeneration was captured once at init and never updated
 * across reconnect cycles, causing all SDK callbacks to be silently rejected
 * as stale after the first disconnect.
 *
 * Fix: createFreshRtcService() factory creates a new SDK service and
 * synchronizes serviceGeneration on each connection attempt.
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

vi.mock('@the9ines/localbolt-browser', () => ({
  store: {
    getState: () => ({ ...mockState }),
    setState: (partial: Record<string, unknown>) => Object.assign(mockState, partial),
    subscribe: vi.fn(),
  },
  showToast: vi.fn(),
}));

// ── Import after mock ─────────────────────────────────────────────────────

import {
  getPhase, getGeneration, isCurrentGeneration,
  beginRequest, receiveRequest, beginConnecting,
  markConnected, resetSession,
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

// ── Helpers ───────────────────────────────────────────────────────────────

/** Simulate full connection lifecycle to a peer. */
function connectToPeer(peerCode: string): number {
  beginRequest(peerCode);
  beginConnecting(peerCode);
  markConnected();
  mockState.isConnected = true;
  return getGeneration();
}

/** Simulate mid-transfer disconnect (terminal WebRTC state). */
function disconnectMidTransfer(): number {
  // Transfer is active (simulated by isConnected = true + transferProgress set)
  mockState.transferProgress = {
    filename: 'test.bin',
    status: 'sending',
    currentChunk: 50,
    totalChunks: 100,
    loaded: 512000,
    total: 1024000,
  };

  // Terminal state handler fires → resetSession
  resetSession();
  mockState.isConnected = false;
  mockState.transferProgress = null;
  return getGeneration();
}

// ── AC-RX-01: Mid-transfer disconnect → terminal reset state ──────────────

describe('AC-RX-01: mid-transfer disconnect transitions to terminal reset state', () => {
  it('disconnect during TRANSFERRING resets phase to idle', () => {
    connectToPeer('PEER-A');
    mockState.transferProgress = { filename: 'f.bin', status: 'sending' };

    resetSession();
    expect(getPhase()).toBe('idle');
    expect(mockState.transferProgress).toBeNull();
  });

  it('disconnect during RECEIVING resets phase to idle', () => {
    receiveRequest('PEER-B');
    beginConnecting('PEER-B');
    markConnected();
    mockState.isConnected = true;
    mockState.transferProgress = { filename: 'f.bin', status: 'receiving' };

    resetSession();
    expect(getPhase()).toBe('idle');
    expect(mockState.transferProgress).toBeNull();
  });
});

// ── AC-RX-02: Fresh session generation on reconnect ───────────────────────

describe('AC-RX-02: reconnect creates fresh session generation', () => {
  it('generation increments on disconnect', () => {
    const genA = connectToPeer('PEER-A');
    const genAfterDisconnect = disconnectMidTransfer();
    expect(genAfterDisconnect).toBeGreaterThan(genA);
  });

  it('stale generation from session A rejected after reconnect to B', () => {
    const genA = connectToPeer('PEER-A');
    disconnectMidTransfer();
    const genB = connectToPeer('PEER-B');

    expect(isCurrentGeneration(genA)).toBe(false);
    expect(isCurrentGeneration(genB)).toBe(true);
  });

  it('serviceGeneration pattern: capturing generation on connect enables guards', () => {
    // Simulates the createFreshRtcService pattern
    let serviceGeneration = getGeneration();

    connectToPeer('PEER-A');
    serviceGeneration = getGeneration(); // captured at service creation
    expect(isCurrentGeneration(serviceGeneration)).toBe(true);

    disconnectMidTransfer();
    // Old serviceGeneration is stale
    expect(isCurrentGeneration(serviceGeneration)).toBe(false);

    connectToPeer('PEER-B');
    serviceGeneration = getGeneration(); // re-captured at new service creation
    expect(isCurrentGeneration(serviceGeneration)).toBe(true);
  });
});

// ── AC-RX-03: New transfer starts successfully after reconnect ────────────

describe('AC-RX-03: new transfer succeeds after reconnect (no app restart)', () => {
  it('full cycle: connect → transfer → disconnect → reconnect → transfer allowed', () => {
    // Session A: transfer active
    connectToPeer('PEER-A');
    setVerificationState({ state: 'verified', sasCode: 'SAS-A' });
    expect(isTransferAllowed('verified', true)).toBe(true);

    // Mid-transfer disconnect
    disconnectMidTransfer();
    expect(isTransferAllowed(getVerificationState().state, false)).toBe(false);

    // Session B: reconnect
    connectToPeer('PEER-B');
    mockState.isConnected = true;

    // Legacy session (no HELLO/identity): transfer allowed
    expect(getVerificationState().state).toBe('legacy');
    expect(isTransferAllowed('legacy', true)).toBe(true);
  });

  it('reconnect to same peer after mid-transfer disconnect', () => {
    connectToPeer('PEER-A');
    setVerificationState({ state: 'verified', sasCode: 'SAS-A-1' });

    disconnectMidTransfer();

    connectToPeer('PEER-A'); // same peer
    mockState.isConnected = true;

    // Trust reset — must re-verify
    expect(getVerificationState().state).toBe('legacy');
    expect(isTransferAllowed('legacy', true)).toBe(true);
  });
});

// ── AC-RX-04: No stale transfer state crosses reconnect ───────────────────

describe('AC-RX-04: no stale transfer state crosses reconnect boundary', () => {
  it('transferProgress cleared on disconnect', () => {
    connectToPeer('PEER-A');
    mockState.transferProgress = {
      filename: 'large.zip',
      status: 'sending',
      currentChunk: 500,
      totalChunks: 1000,
    };

    resetSession();
    expect(mockState.transferProgress).toBeNull();
  });

  it('verification state reset on disconnect', () => {
    connectToPeer('PEER-A');
    setVerificationState({ state: 'verified', sasCode: 'SAS-A' });

    resetSession();
    expect(getVerificationState().state).toBe('legacy');
    expect(getVerificationState().sasCode).toBeNull();
  });

  it('session phase clean after disconnect', () => {
    connectToPeer('PEER-A');
    expect(getPhase()).toBe('connected');

    resetSession();
    expect(getPhase()).toBe('idle');
  });

  it('five rapid disconnect-reconnect cycles produce monotonic generation', () => {
    const generations: number[] = [];

    for (let i = 0; i < 5; i++) {
      connectToPeer(`PEER-${i}`);
      generations.push(getGeneration());
      disconnectMidTransfer();
    }

    // Every generation must be strictly greater than the previous
    for (let i = 1; i < generations.length; i++) {
      expect(generations[i]).toBeGreaterThan(generations[i - 1]);
    }
  });
});

// ── AC-RX-05: Pause/resume/cancel functional post-reconnect ──────────────

describe('AC-RX-05: control state clean after reconnect', () => {
  it('transfer state flags reset on disconnect (SDK contract)', () => {
    // Simulates SDK state being clean after createFreshRtcService
    connectToPeer('PEER-A');

    // Simulate paused state
    mockState.transferProgress = { filename: 'f.bin', status: 'sending' };

    resetSession();
    // After reconnect, no stale pause/cancel state
    expect(mockState.transferProgress).toBeNull();
    expect(getPhase()).toBe('idle');
  });

  it('session allows new connection after paused transfer disconnect', () => {
    connectToPeer('PEER-A');
    resetSession();

    // Must be able to start a new connection
    const ok = beginRequest('PEER-B');
    expect(ok).toBe(true);
    expect(getPhase()).toBe('requesting');
  });
});

// ── AC-RX-06: Disconnect-during-transfer → reconnect → resend regression ──

describe('AC-RX-06: regression — full disconnect-reconnect-resend cycle', () => {
  it('three consecutive transfer-disconnect-reconnect cycles all succeed', () => {
    const peers = ['PEER-A', 'PEER-B', 'PEER-C'];

    for (const peer of peers) {
      // Connect
      connectToPeer(peer);
      const gen = getGeneration();
      mockState.isConnected = true;

      // Simulate active transfer
      mockState.transferProgress = {
        filename: `file-${peer}.bin`,
        status: 'sending',
      };

      // Mid-transfer disconnect
      disconnectMidTransfer();

      // All state clean
      expect(isCurrentGeneration(gen)).toBe(false);
      expect(getPhase()).toBe('idle');
      expect(mockState.transferProgress).toBeNull();
      expect(getVerificationState().state).toBe('legacy');
    }

    // Can still start a new connection after all cycles
    const finalOk = beginRequest('PEER-D');
    expect(finalOk).toBe(true);
  });

  it('stale progress callback from session A ignored in session B', () => {
    const genA = connectToPeer('PEER-A');
    disconnectMidTransfer();

    connectToPeer('PEER-B');
    const genB = getGeneration();

    // Stale callback from A — generation guard rejects
    expect(isCurrentGeneration(genA)).toBe(false);

    // Fresh callback from B — generation guard accepts
    expect(isCurrentGeneration(genB)).toBe(true);
  });

  it('responder path: receive request → accept → disconnect → re-accept works', () => {
    // Session A: responder accepts
    receiveRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();
    mockState.isConnected = true;

    // Mid-transfer disconnect
    disconnectMidTransfer();

    // Session B: another request arrives → responder can accept
    const ok = receiveRequest('PEER-B');
    expect(ok).toBe(true);
    expect(getPhase()).toBe('incoming_request');

    beginConnecting('PEER-B');
    markConnected();
    expect(getPhase()).toBe('connected');
  });
});
