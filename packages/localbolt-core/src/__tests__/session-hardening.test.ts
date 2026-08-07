/**
 * C-pre-2 — Session orchestration + race hardening tests.
 *
 * Tests the session-state orchestration layer (phase transitions,
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
} from '../session-state';
import {
  getVerificationState, setVerificationState, resetVerificationState,
} from '../verification-state';

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
    expect(getVerificationState()).toBeNull(); // R3b: no verification info yet
  });

  it('clears verification state on reset', () => {
    setVerificationState({ state: 'verified', sasCode: 'DEADBE' });
    resetSession();
    expect(getVerificationState()).toBeNull(); // R3b: no verification info yet
    expect(getVerificationState()?.sasCode ?? null).toBeNull();
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
    expect(getVerificationState()).toBeNull(); // R3b: no verification info yet
    expect(getVerificationState()?.sasCode ?? null).toBeNull();
  });

  it('verified state does not leak into new session', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();
    setVerificationState({ state: 'verified', sasCode: 'SAS-A' });

    resetSession();

    beginRequest('PEER-B');
    // Before SDK emits verification state for new session, state is legacy
    expect(getVerificationState()).toBeNull(); // R3b: no verification info yet
  });
});

describe('Race: no stale verification UI after reset', () => {
  it('verification state listener fires with no-info on reset', () => {
    const listener = vi.fn();
    const unsub = onSessionChange(listener);

    setVerificationState({ state: 'unverified', sasCode: 'BEEF42' });
    resetSession();

    // Verification bus should be reset
    expect(getVerificationState()).toBeNull(); // R3b: no verification info yet
    unsub();
  });
});

// ── C7: rapid multi-cycle generation monotonicity ────────────────────

describe('C7: rapid 5+ connect/reset cycles', () => {
  it('generation increases monotonically with no state corruption', () => {
    const generations: number[] = [getGeneration()];

    for (let i = 0; i < 7; i++) {
      beginRequest(`PEER-${i}`);
      beginConnecting(`PEER-${i}`);
      markConnected();
      setVerificationState({ state: 'unverified', sasCode: `SAS-${i}` });
      mockState.transferProgress = { status: 'receiving', filename: `file-${i}.dat` };

      const gen = resetSession();
      generations.push(gen);

      // After each reset: clean state
      expect(getPhase()).toBe('idle');
      expect(getTargetPeer()).toBeNull();
      expect(getVerificationState()).toBeNull(); // R3b: no verification info yet
      expect(mockState.transferProgress).toBeNull();
      expect(mockState.isConnected).toBe(false);
    }

    // Monotonicity: each generation strictly greater than previous
    for (let i = 1; i < generations.length; i++) {
      expect(generations[i]).toBeGreaterThan(generations[i - 1]);
    }

    // All prior generations are stale
    for (let i = 0; i < generations.length - 1; i++) {
      expect(isCurrentGeneration(generations[i])).toBe(false);
    }
    expect(isCurrentGeneration(generations[generations.length - 1])).toBe(true);
  });
});

// ── C7: late verification callback from previous session ─────────────

describe('C7: late verification callback for previous peer rejected', () => {
  it('verification callback from session A is stale after reset into session B', () => {
    // Session A: connect to PEER-A, capture generation
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();
    const genA = getGeneration();

    // Simulate async verification callback in-flight for PEER-A
    const pendingVerification = { state: 'unverified' as const, sasCode: 'SAS-A' };

    // User disconnects from A, connects to B
    resetSession();
    beginRequest('PEER-B');
    beginConnecting('PEER-B');
    markConnected();
    setVerificationState({ state: 'unverified', sasCode: 'SAS-B' });

    // Late callback from session A arrives — generation guard rejects it
    expect(isCurrentGeneration(genA)).toBe(false);
    // If caller ignores guard, wrong SAS would be shown. Guard prevents this.

    // Current session B state is intact
    expect(getTargetPeer()).toBe('PEER-B');
    expect(getVerificationState().sasCode).toBe('SAS-B');
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
    // R3b: must set legacy explicitly. This previously relied on the module
    // default also being 'legacy', so it asserted the permissive default rather
    // than a peer that genuinely negotiated a pre-SAS session.
    setVerificationState({ state: 'legacy', sasCode: null });
    const vState = getVerificationState()?.state ?? null;
    const transferAllowed = vState === 'verified' || vState === 'legacy';
    expect(transferAllowed).toBe(true);
  });

  it('no verification info yet blocks transfer', () => {
    resetVerificationState();
    const vState = getVerificationState()?.state ?? null;
    const transferAllowed = vState === 'verified' || vState === 'legacy';
    expect(transferAllowed).toBe(false);
  });

  it('mismatch blocks transfer (state resets to no-info and connection is down)', () => {
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

  it('snapshot reflects current verification state (not hardcoded legacy)', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();
    setVerificationState({ state: 'unverified', sasCode: 'SAS-A' });

    const snap = getSessionSnapshot();
    expect(snap.verificationState).toBe('unverified');
  });

  it('snapshot reflects verified state', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();
    setVerificationState({ state: 'verified', sasCode: 'SAS-A' });

    const snap = getSessionSnapshot();
    expect(snap.verificationState).toBe('verified');
  });

  it('snapshot reflects no verification info after reset', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();
    setVerificationState({ state: 'verified', sasCode: 'SAS-A' });
    resetSession();

    const snap = getSessionSnapshot();
    expect(snap.verificationState).toBeNull(); // R3b: no info yet
  });

  it('snapshot verification state tracks through full lifecycle', () => {
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();

    expect(getSessionSnapshot().verificationState).toBeNull(); // R3b: no info yet
    setVerificationState({ state: 'unverified', sasCode: 'ABC' });
    expect(getSessionSnapshot().verificationState).toBe('unverified');
    setVerificationState({ state: 'verified', sasCode: 'ABC' });
    expect(getSessionSnapshot().verificationState).toBe('verified');

    resetSession();
    expect(getSessionSnapshot().verificationState).toBeNull(); // R3b: no info yet
  });
});
