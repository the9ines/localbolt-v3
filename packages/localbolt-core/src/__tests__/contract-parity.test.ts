/**
 * M4-PARITY-1 — Contract parity test.
 *
 * Validates localbolt-v3 session/transfer/verification implementation
 * against the canonical contract defined in bolt-core-sdk.
 *
 * Authority: bolt-core-sdk/rust/bolt-app-core/contracts/parity_fixture.json
 * If this test fails, the web product has drifted from the canonical contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from './parity_fixture.json';

// ── Mock SDK store ────────────────────────────────────────────────────────

const mockState: Record<string, unknown> = {};

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
  getPhase,
  beginRequest, receiveRequest, beginConnecting,
  markConnected, resetSession, _resetForTest,
} from '../session-state';
import { isTransferAllowed } from '../transfer-policy';

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetForTest();
  Object.assign(mockState, {
    isConnected: false, connectedDevice: null, connectingTo: null,
    incomingRequest: null, transferProgress: null, showDeviceList: false,
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────

/** Transition the session to a target phase. Returns false if unreachable. */
function reachPhase(phase: string): boolean {
  _resetForTest();
  Object.assign(mockState, {
    isConnected: false, connectedDevice: null, connectingTo: null,
    incomingRequest: null, transferProgress: null, showDeviceList: false,
  });
  if (phase === 'idle') return true;
  if (phase === 'requesting') return beginRequest('PEER');
  if (phase === 'incoming_request') return receiveRequest('PEER');
  if (phase === 'connecting') {
    beginRequest('PEER');
    return beginConnecting('PEER');
  }
  if (phase === 'connected') {
    beginRequest('PEER');
    beginConnecting('PEER');
    return markConnected();
  }
  return false;
}

/** Attempt a transition from `from` to `to`. Returns true if accepted. */
function attemptTransition(from: string, to: string): boolean {
  if (!reachPhase(from)) return false;

  switch (to) {
    case 'idle': resetSession(); return getPhase() === 'idle';
    case 'requesting': return beginRequest('PEER');
    case 'incoming_request': return receiveRequest('PEER');
    case 'connecting': return beginConnecting('PEER');
    case 'connected': return markConnected();
    default: return false;
  }
}

// ── Contract Parity Tests ─────────────────────────────────────────────────

describe('M4-PARITY-1: Session contract parity', () => {
  it('contract version is 1', () => {
    expect(fixture.contract_version).toBe(1);
  });

  describe('session phases', () => {
    it('web models all canonical session phases', () => {
      // Web's SessionPhase type includes all canonical phases
      // (plus 'disconnecting' which is product-specific and allowed)
      for (const phase of fixture.session_phases) {
        expect(reachPhase(phase)).toBe(true);
        expect(getPhase()).toBe(phase);
      }
    });
  });

  describe('session transitions — legal', () => {
    for (const [from, to] of fixture.session_transitions_legal) {
      it(`${from} → ${to} is accepted`, () => {
        expect(attemptTransition(from, to)).toBe(true);
      });
    }
  });

  describe('session transitions — illegal', () => {
    // Build the full NxN matrix and test all non-legal pairs
    const legalSet = new Set(
      fixture.session_transitions_legal.map(([f, t]: string[]) => `${f}->${t}`)
    );

    for (const from of fixture.session_phases) {
      for (const to of fixture.session_phases) {
        const key = `${from}->${to}`;
        if (!legalSet.has(key)) {
          it(`${from} → ${to} is rejected`, () => {
            // resetSession() always succeeds (canonical P3), so skip idle->idle
            // which is really "reset from idle" — not a meaningful illegal case
            if (from === to) {
              // Self-transitions: attempting the same phase should fail
              // (except idle->idle via resetSession which is a no-op)
              if (from !== 'idle') {
                expect(attemptTransition(from, to)).toBe(false);
              }
              return;
            }
            expect(attemptTransition(from, to)).toBe(false);
          });
        }
      }
    }
  });

  describe('transfer gating policy P1', () => {
    for (const [state, allowed] of Object.entries(fixture.transfer_gating)) {
      it(`${state} + connected → ${allowed ? 'allowed' : 'blocked'}`, () => {
        expect(isTransferAllowed(state as any, true)).toBe(allowed);
      });

      it(`${state} + disconnected → blocked`, () => {
        expect(isTransferAllowed(state as any, false)).toBe(false);
      });
    }
  });

  describe('invariant INV-1: disconnect resets transfer', () => {
    it('resetSession clears transferProgress', () => {
      mockState.transferProgress = { filename: 'test.bin', status: 'receiving' };
      resetSession();
      expect(mockState.transferProgress).toBeNull();
    });
  });

  describe('invariant INV-3: single session', () => {
    it('cannot begin two requests simultaneously', () => {
      expect(beginRequest('PEER_A')).toBe(true);
      expect(beginRequest('PEER_B')).toBe(false);
      expect(getPhase()).toBe('requesting');
    });

    it('cannot receive request while requesting', () => {
      beginRequest('PEER_A');
      expect(receiveRequest('PEER_B')).toBe(false);
    });
  });
});
