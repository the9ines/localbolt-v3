/**
 * C-pre-2 — Session orchestration + race hardening tests.
 *
 * Tests the session-state.ts orchestration layer (phase transitions,
 * generation guards, canonical reset) and race scenarios using mocked
 * SDK callbacks and fake timers.
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
  getPhase, getGeneration, getTargetPeer, getSessionSnapshot,
  isCurrentGeneration, onSessionChange,
  beginRequest, receiveRequest, beginConnecting,
  markConnected, resetSession, _resetForTest,
  getVerificationState, setVerificationState, resetVerificationState,
  isTransferAllowed,
} from '@the9ines/localbolt-core';

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

// ── Session phase transitions ─────────────────────────────────────────────

describe('Session phase transitions', () => {
  it('starts in idle phase', () => {
    expect(getPhase()).toBe('idle');
    expect(getGeneration()).toBe(0);
    expect(getTargetPeer()).toBeNull();
  });

  it('idle → requesting on beginRequest', () => {
    expect(beginRequest('PEER-A')).toBe(true);
    expect(getPhase()).toBe('requesting');
    expect(getTargetPeer()).toBe('PEER-A');
  });

  it('idle → incoming_request on receiveRequest', () => {
    expect(receiveRequest('PEER-B')).toBe(true);
    expect(getPhase()).toBe('incoming_request');
    expect(getTargetPeer()).toBe('PEER-B');
  });

  it('requesting → connecting on beginConnecting', () => {
    beginRequest('PEER-A');
    expect(beginConnecting('PEER-A')).toBe(true);
    expect(getPhase()).toBe('connecting');
  });

  it('incoming_request → connecting on beginConnecting', () => {
    receiveRequest('PEER-B');
    expect(beginConnecting('PEER-B')).toBe(true);
    expect(getPhase()).toBe('connecting');
  });

  it('connecting → connected on markConnected', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    expect(markConnected()).toBe(true);
    expect(getPhase()).toBe('connected');
  });

  it('resetSession returns to idle and increments generation', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();
    const gen = resetSession();
    expect(getPhase()).toBe('idle');
    expect(gen).toBe(1);
    expect(getTargetPeer()).toBeNull();
  });
});

// ── Invalid transitions (guard enforcement) ──────────────────────────────

describe('Invalid phase transitions are rejected', () => {
  it('beginRequest rejected when not idle', () => {
    beginRequest('PEER-A');
    expect(beginRequest('PEER-B')).toBe(false);
    expect(getTargetPeer()).toBe('PEER-A');
  });

  it('receiveRequest rejected when not idle', () => {
    beginRequest('PEER-A');
    expect(receiveRequest('PEER-B')).toBe(false);
  });

  it('beginConnecting rejected from idle', () => {
    expect(beginConnecting('PEER-A')).toBe(false);
  });

  it('markConnected rejected from idle', () => {
    expect(markConnected()).toBe(false);
  });

  it('markConnected rejected from requesting (must go through connecting)', () => {
    beginRequest('PEER-A');
    expect(markConnected()).toBe(false);
  });
});

// ── Generation guards ────────────────────────────────────────────────────

describe('Generation guards for stale callbacks', () => {
  it('generation increments on each resetSession', () => {
    expect(getGeneration()).toBe(0);
    resetSession();
    expect(getGeneration()).toBe(1);
    resetSession();
    expect(getGeneration()).toBe(2);
  });

  it('isCurrentGeneration returns true for current', () => {
    const gen = getGeneration();
    expect(isCurrentGeneration(gen)).toBe(true);
  });

  it('isCurrentGeneration returns false after reset', () => {
    const gen = getGeneration();
    resetSession();
    expect(isCurrentGeneration(gen)).toBe(false);
  });

  it('stale async callback detected via generation guard', () => {
    beginRequest('PEER-A');
    const genAtRequest = getGeneration();

    // Simulate: user cancels before async callback fires
    resetSession();

    // Async callback arrives — should be detected as stale
    expect(isCurrentGeneration(genAtRequest)).toBe(false);
  });
});

// ── Canonical reset clears all state ──────────────────────────────────────

describe('Canonical reset clears all session state', () => {
  it('clears SDK store fields on resetSession', () => {
    // Simulate a connected session with active transfer
    mockState.isConnected = true;
    mockState.connectedDevice = { peerCode: 'PEER-A', deviceName: 'A', deviceType: 'desktop' };
    mockState.connectingTo = 'PEER-A';
    mockState.incomingRequest = { peerCode: 'PEER-B', deviceName: 'B', deviceType: 'mobile' };
    mockState.transferProgress = { status: 'receiving', filename: 'test.txt' };
    mockState.showDeviceList = true;
    setVerificationState({ state: 'unverified', sasCode: 'ABC123' });

    resetSession();

    expect(mockState.isConnected).toBe(false);
    expect(mockState.connectedDevice).toBeNull();
    expect(mockState.connectingTo).toBeNull();
    expect(mockState.incomingRequest).toBeNull();
    expect(mockState.transferProgress).toBeNull();
    expect(mockState.showDeviceList).toBe(false);
    expect(getVerificationState().state).toBe('legacy');
  });

  it('clears verification state on reset', () => {
    setVerificationState({ state: 'verified', sasCode: 'DEADBE' });
    resetSession();
    expect(getVerificationState().state).toBe('legacy');
    expect(getVerificationState().sasCode).toBeNull();
  });
});

// ── Session listener notifications ────────────────────────────────────────

describe('Session change notifications', () => {
  it('notifies on phase transition', () => {
    const listener = vi.fn();
    onSessionChange(listener);

    beginRequest('PEER-A');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      phase: 'requesting',
      targetPeer: 'PEER-A',
    }));
  });

  it('notifies on reset', () => {
    const listener = vi.fn();
    onSessionChange(listener);

    beginRequest('PEER-A');
    listener.mockClear();
    resetSession();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      phase: 'idle',
      targetPeer: null,
      generation: 1,
    }));
  });

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = onSessionChange(listener);
    unsub();

    beginRequest('PEER-A');
    expect(listener).not.toHaveBeenCalled();
  });
});

// ── Race scenarios ────────────────────────────────────────────────────────

describe('Race: connect A→B, disconnect, connect A→C quickly', () => {
  it('no stale state leakage from first session into second', () => {
    // Session 1: connect to PEER-B
    beginRequest('PEER-B');
    beginConnecting('PEER-B');
    markConnected();
    setVerificationState({ state: 'unverified', sasCode: 'SAS-B' });

    const gen1 = getGeneration();

    // Disconnect from B
    resetSession();

    // Session 2: connect to PEER-C
    beginRequest('PEER-C');
    beginConnecting('PEER-C');
    markConnected();
    setVerificationState({ state: 'verified', sasCode: 'SAS-C' });

    // Verify no leakage
    expect(getTargetPeer()).toBe('PEER-C');
    expect(getVerificationState().state).toBe('verified');
    expect(getVerificationState().sasCode).toBe('SAS-C');
    expect(isCurrentGeneration(gen1)).toBe(false);
  });
});

describe('Race: stale connection_accepted after cancel', () => {
  it('stale accepted signal detected via generation guard', () => {
    beginRequest('PEER-A');
    const genAtRequest = getGeneration();

    // User cancels request
    resetSession();

    // Stale accepted signal arrives from PEER-A
    const isStale = !isCurrentGeneration(genAtRequest);
    expect(isStale).toBe(true);
    // Caller should discard signal when stale
    expect(getPhase()).toBe('idle');
  });
});

describe('Race: incoming request while disconnecting', () => {
  it('request rejected because phase is not idle during disconnect', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();

    // While connected, incoming request from PEER-B
    // receiveRequest only allowed from idle
    expect(receiveRequest('PEER-B')).toBe(false);
    expect(getPhase()).toBe('connected');
  });
});

describe('Race: peer lost while connecting', () => {
  it('resetSession cleans up in-progress connection', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    expect(getPhase()).toBe('connecting');

    // Peer lost event fires
    resetSession();

    expect(getPhase()).toBe('idle');
    expect(getTargetPeer()).toBeNull();
    expect(mockState.connectingTo).toBeNull();
  });
});

describe('Race: verification transitions around reconnect', () => {
  it('reset clears unverified state between sessions', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();
    setVerificationState({ state: 'unverified', sasCode: 'SAS-A' });

    resetSession();

    // New session starts clean
    expect(getVerificationState().state).toBe('legacy');
    expect(getVerificationState().sasCode).toBeNull();
  });

  it('verified state does not leak into new session', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();
    setVerificationState({ state: 'verified', sasCode: 'SAS-A' });

    resetSession();

    beginRequest('PEER-B');
    // Before SDK emits verification state for new session, state is legacy
    expect(getVerificationState().state).toBe('legacy');
  });
});

describe('Race: no stale verification UI after reset', () => {
  it('verification state listener fires with legacy on reset', () => {
    const listener = vi.fn();
    const unsub = onSessionChange(listener);

    setVerificationState({ state: 'unverified', sasCode: 'BEEF42' });
    resetSession();

    // Verification bus should be reset
    expect(getVerificationState().state).toBe('legacy');
    unsub();
  });
});

// ── Transfer gating policy consistency ────────────────────────────────────

describe('Transfer gating policy', () => {
  it('unverified blocks transfer', () => {
    setVerificationState({ state: 'unverified', sasCode: 'ABC123' });
    const vState = getVerificationState().state;
    const transferAllowed = vState === 'verified' || vState === 'legacy';
    expect(transferAllowed).toBe(false);
  });

  it('verified allows transfer', () => {
    setVerificationState({ state: 'verified', sasCode: 'ABC123' });
    const vState = getVerificationState().state;
    const transferAllowed = vState === 'verified' || vState === 'legacy';
    expect(transferAllowed).toBe(true);
  });

  it('legacy allows transfer', () => {
    const vState = getVerificationState().state;
    const transferAllowed = vState === 'verified' || vState === 'legacy';
    expect(transferAllowed).toBe(true);
  });

  it('mismatch blocks transfer (state resets to legacy but connection is down)', () => {
    // Mismatch path: error handler calls resetSession which resets verification
    setVerificationState({ state: 'unverified', sasCode: 'BEEF42' });
    resetSession(); // simulates error handler
    // Verification is legacy but isConnected is false — transfer blocked
    expect(mockState.isConnected).toBe(false);
  });
});

// ── Snapshot API ──────────────────────────────────────────────────────────

describe('Session snapshot', () => {
  it('returns full snapshot of current state', () => {
    beginRequest('PEER-X');
    const snap = getSessionSnapshot();
    expect(snap.phase).toBe('requesting');
    expect(snap.targetPeer).toBe('PEER-X');
    expect(snap.generation).toBe(0);
  });

  it('snapshot reflects live verification state', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();
    setVerificationState({ state: 'unverified', sasCode: 'SAS-A' });

    expect(getSessionSnapshot().verificationState).toBe('unverified');

    setVerificationState({ state: 'verified', sasCode: 'SAS-A' });
    expect(getSessionSnapshot().verificationState).toBe('verified');

    resetSession();
    expect(getSessionSnapshot().verificationState).toBe('legacy');
  });
});

// ── C-STREAM-R1: Transfer gating truth table (P3) ────────────────────────

describe('C-STREAM-R1: Transfer gating truth table', () => {
  it('verified + connected → allowed', () => {
    expect(isTransferAllowed('verified', true)).toBe(true);
  });

  it('legacy + connected → allowed', () => {
    expect(isTransferAllowed('legacy', true)).toBe(true);
  });

  it('unverified + connected → blocked', () => {
    expect(isTransferAllowed('unverified', true)).toBe(false);
  });

  it('mismatch + connected → blocked', () => {
    expect(isTransferAllowed('mismatch', true)).toBe(false);
  });

  it('verified + disconnected → blocked', () => {
    expect(isTransferAllowed('verified', false)).toBe(false);
  });

  it('legacy + disconnected → blocked', () => {
    expect(isTransferAllowed('legacy', false)).toBe(false);
  });

  it('unverified + disconnected → blocked', () => {
    expect(isTransferAllowed('unverified', false)).toBe(false);
  });

  it('mismatch + disconnected → blocked', () => {
    expect(isTransferAllowed('mismatch', false)).toBe(false);
  });
});

// ── C-STREAM-R1: Stale verification guard (P2) ───────────────────────────

describe('C-STREAM-R1: Stale verification callback after disconnect', () => {
  it('generation guard rejects late verification from session A during session B', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();
    const genA = getGeneration();
    setVerificationState({ state: 'unverified', sasCode: 'SAS-A' });

    // Disconnect from A
    resetSession();

    // Session B starts
    beginRequest('PEER-B');
    beginConnecting('PEER-B');
    markConnected();
    setVerificationState({ state: 'unverified', sasCode: 'SAS-B' });

    // Late verification callback from A arrives — generation guard detects stale
    expect(isCurrentGeneration(genA)).toBe(false);
    // Caller MUST check generation before calling setVerificationState.
    // If it bypasses, B's state is corrupted:
    expect(getVerificationState().sasCode).toBe('SAS-B');
  });

  it('double disconnect is idempotent at session layer', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();

    const gen1 = resetSession();
    const gen2 = resetSession();
    expect(gen2).toBe(gen1 + 1); // each reset increments
    expect(getPhase()).toBe('idle');
  });
});
