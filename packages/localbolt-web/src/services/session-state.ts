/**
 * Session orchestration layer — C-pre-1.
 *
 * Local v3 state machine that guards/sequences calls to the SDK store.
 * This does NOT replace the SDK store — it is a coordination layer that
 * ensures clean transitions and prevents stale state leakage.
 *
 * Session phases:
 *   idle → requesting → connecting → connected → disconnecting → idle
 *   idle → incoming_request → connecting → connected → disconnecting → idle
 *
 * Verification states (aligned to SDK VerificationInfo.state):
 *   legacy | unverified | verified | mismatch
 *
 * Generation counter:
 *   Monotonically increasing integer incremented on every reset.
 *   Used by C-pre-2 to guard stale async callbacks.
 */

import { store } from '@the9ines/bolt-transport-web';
import type { VerificationInfo } from '@the9ines/bolt-transport-web';
import { resetVerificationState, setVerificationState } from './verification-state';

// ── Types ────────────────────────────────────────────────────────────────

export type SessionPhase =
  | 'idle'
  | 'requesting'
  | 'incoming_request'
  | 'connecting'
  | 'connected'
  | 'disconnecting';

export interface SessionSnapshot {
  phase: SessionPhase;
  generation: number;
  targetPeer: string | null;
  verificationState: VerificationInfo['state'];
}

type SessionListener = (snapshot: SessionSnapshot) => void;

// ── State ────────────────────────────────────────────────────────────────

let phase: SessionPhase = 'idle';
let generation = 0;
let targetPeer: string | null = null;

const listeners = new Set<SessionListener>();

// ── Helpers ──────────────────────────────────────────────────────────────

function snapshot(): SessionSnapshot {
  return {
    phase,
    generation,
    targetPeer,
    verificationState: 'legacy', // read from verification-state bus if needed
  };
}

function notify(): void {
  const s = snapshot();
  listeners.forEach((fn) => fn(s));
}

// ── Public API ───────────────────────────────────────────────────────────

/** Current session generation (monotonically increasing). */
export function getGeneration(): number {
  return generation;
}

/** Current session phase. */
export function getPhase(): SessionPhase {
  return phase;
}

/** Target peer code for current session (connecting to / connected to). */
export function getTargetPeer(): string | null {
  return targetPeer;
}

/** Full snapshot of session state. */
export function getSessionSnapshot(): SessionSnapshot {
  return snapshot();
}

/** Subscribe to session state changes. Returns unsubscribe function. */
export function onSessionChange(fn: SessionListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── Transitions ──────────────────────────────────────────────────────────

/**
 * Transition to 'requesting' — user selected a peer to connect to.
 * Only valid from 'idle'.
 */
export function beginRequest(peerCode: string): boolean {
  if (phase !== 'idle') return false;
  phase = 'requesting';
  targetPeer = peerCode;
  notify();
  return true;
}

/**
 * Record an incoming connection request.
 * Only valid from 'idle'.
 */
export function receiveRequest(peerCode: string): boolean {
  if (phase !== 'idle') return false;
  phase = 'incoming_request';
  targetPeer = peerCode;
  notify();
  return true;
}

/**
 * Transition to 'connecting' — approval received, WebRTC handshake starting.
 * Valid from 'requesting' or 'incoming_request'.
 */
export function beginConnecting(peerCode: string): boolean {
  if (phase !== 'requesting' && phase !== 'incoming_request') return false;
  phase = 'connecting';
  targetPeer = peerCode;
  notify();
  return true;
}

/**
 * Transition to 'connected' — WebRTC data channel open.
 * Valid from 'connecting'.
 */
export function markConnected(): boolean {
  if (phase !== 'connecting') return false;
  phase = 'connected';
  notify();
  return true;
}

/**
 * Canonical reset — the ONE path that clears all session state.
 * Increments generation counter so stale callbacks can be detected.
 *
 * Clears:
 *  - session phase → idle
 *  - target peer → null
 *  - verification state → legacy (via resetVerificationState)
 *  - SDK store: connectingTo, incomingRequest, connectedDevice,
 *               isConnected, transferProgress, showDeviceList
 */
export function resetSession(): number {
  phase = 'disconnecting';
  generation++;
  targetPeer = null;

  // Clear verification
  resetVerificationState();

  // Clear SDK store — single canonical setState
  store.setState({
    isConnected: false,
    connectedDevice: null,
    connectingTo: null,
    incomingRequest: null,
    transferProgress: null,
    showDeviceList: false,
  });

  phase = 'idle';
  notify();
  return generation;
}

/**
 * Check if a generation token is still current (not stale).
 */
export function isCurrentGeneration(gen: number): boolean {
  return gen === generation;
}

/**
 * Reset to initial state for testing. Not for production use.
 * @internal
 */
export function _resetForTest(): void {
  phase = 'idle';
  generation = 0;
  targetPeer = null;
  listeners.clear();
}
