/**
 * R3b-part-1 — "no verification info yet" is not "legacy peer".
 *
 * `legacy` means a peer genuinely negotiated a pre-SAS session, and it permits
 * transfer. Before this change it was also the module default and the value
 * resetVerificationState() restored, so "we have heard nothing" was
 * indistinguishable from "we heard legacy" and opened the outbound gate.
 *
 * These tests pin the distinction through the public API only. They deliberately
 * do not assert the sentinel's representation, so the internal choice can change
 * without rewriting them.
 *
 * Out of scope, unchanged: transfer_gating for the three named wire states, and
 * inbound delivery (which is not gated on verification state at all).
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
  beginRequest, beginConnecting, markConnected, resetSession, _resetForTest,
} from '../session-state';
import {
  getVerificationState, setVerificationState, resetVerificationState,
  onVerificationStateChange,
} from '../verification-state';
import { isTransferAllowed } from '../transfer-policy';

/**
 * The outbound gate exactly as the UI computes it (sections/transfer.ts).
 * Reads through the public API so the sentinel stays an implementation detail.
 */
function outboundGateOpen(isConnected = true): boolean {
  return isTransferAllowed(getVerificationState()?.state ?? null, isConnected);
}

beforeEach(() => {
  _resetForTest();
  resetVerificationState();
  Object.assign(mockState, { isConnected: false, connectingTo: null, incomingRequest: null });
});

// ── 1. Initial state ─────────────────────────────────────────────────────

describe('R3b: initial verification state', () => {
  it('does not open the transfer gate while connected', () => {
    expect(outboundGateOpen(true)).toBe(false);
  });

  it('is distinguishable from a negotiated legacy peer', () => {
    const initial = getVerificationState();

    setVerificationState({ state: 'legacy', sasCode: null });
    const negotiated = getVerificationState();

    expect(initial).not.toEqual(negotiated);
  });
});

// ── 2. resetVerificationState ────────────────────────────────────────────

describe('R3b: resetVerificationState', () => {
  it('does not open the transfer gate while connected', () => {
    setVerificationState({ state: 'verified', sasCode: 'SAS-1' });
    expect(outboundGateOpen(true)).toBe(true);

    resetVerificationState();

    expect(outboundGateOpen(true)).toBe(false);
  });

  it('clears a negotiated legacy peer back to no-info', () => {
    setVerificationState({ state: 'legacy', sasCode: null });
    expect(outboundGateOpen(true)).toBe(true);

    resetVerificationState();

    expect(outboundGateOpen(true)).toBe(false);
  });

  it('notifies subscribers with the cleared value', () => {
    setVerificationState({ state: 'verified', sasCode: 'SAS-1' });

    const seen: Array<{ state: string } | null> = [];
    const unsubscribe = onVerificationStateChange((info) => seen.push(info));

    resetVerificationState();
    unsubscribe();

    expect(seen).toHaveLength(1);
    // Subscribers are told about the clear, and what they receive must not
    // read as a transfer-allowed peer.
    expect(isTransferAllowed(seen[0]?.state ?? null, true)).toBe(false);
  });
});

// ── 3. resetSession (disconnect) ─────────────────────────────────────────

describe('R3b: resetSession closes the gate', () => {
  it('closes the transfer gate until real verification info arrives', () => {
    // Establish a verified session.
    beginRequest('PEER-A');
    beginConnecting('PEER-A');
    markConnected();
    mockState.isConnected = true;
    setVerificationState({ state: 'verified', sasCode: 'SAS-A' });
    expect(outboundGateOpen(true)).toBe(true);

    // Disconnect - resetSession calls resetVerificationState internally.
    resetSession();

    // Reconnect: connected again, but nothing has been verified yet.
    mockState.isConnected = true;
    expect(outboundGateOpen(true)).toBe(false);

    // Only real verification info reopens it.
    setVerificationState({ state: 'verified', sasCode: 'SAS-B' });
    expect(outboundGateOpen(true)).toBe(true);
  });

  it('does not silently resurrect the previous session trust', () => {
    setVerificationState({ state: 'verified', sasCode: 'SAS-A' });
    resetSession();

    expect(getVerificationState()?.sasCode ?? null).toBeNull();
    expect(outboundGateOpen(true)).toBe(false);
  });
});

// ── 4. Genuine legacy peer stays allowed (compatibility guard) ───────────

describe('R3b: negotiated legacy peers remain allowed', () => {
  it('permits transfer when connected', () => {
    setVerificationState({ state: 'legacy', sasCode: null });

    expect(outboundGateOpen(true)).toBe(true);
  });

  it('still blocks when disconnected', () => {
    setVerificationState({ state: 'legacy', sasCode: null });

    expect(outboundGateOpen(false)).toBe(false);
  });

  it('keeps the three named wire states behaving exactly as the contract says', () => {
    // Guard against this change leaking into transfer_gating semantics.
    expect(isTransferAllowed('verified', true)).toBe(true);
    expect(isTransferAllowed('legacy', true)).toBe(true);
    expect(isTransferAllowed('unverified', true)).toBe(false);

    expect(isTransferAllowed('verified', false)).toBe(false);
    expect(isTransferAllowed('legacy', false)).toBe(false);
    expect(isTransferAllowed('unverified', false)).toBe(false);
  });
});
