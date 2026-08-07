/**
 * Verification state bus — H5-v3.
 *
 * Lightweight pub/sub for TOFU verification state that sits alongside
 * the SDK store. Components subscribe to verification changes without
 * polluting the shared AppState type.
 */

import type { VerificationInfo } from '@the9ines/localbolt-browser';

/**
 * R3b: `null` means "no verification info received yet" - the state before any
 * handshake reports, and the state restored on every reset.
 *
 * It is deliberately NOT `legacy`. `legacy` is a wire state meaning a peer
 * genuinely negotiated a pre-SAS session, and it permits transfer; using it as
 * the default made "we have heard nothing" indistinguishable from "we heard
 * legacy" and left the outbound gate open before any peer was assessed.
 *
 * This sentinel is internal app state only. It is not a fourth VerificationState
 * and never crosses the wire - the union stays 'unverified' | 'verified' | 'legacy'.
 * Callers must handle null explicitly and treat it as not-yet-trusted.
 */
type Listener = (info: VerificationInfo | null) => void;

let current: VerificationInfo | null = null;
const listeners = new Set<Listener>();

/** Current verification info, or null when nothing has been reported yet. */
export function getVerificationState(): VerificationInfo | null {
  return current;
}

export function setVerificationState(info: VerificationInfo): void {
  current = info;
  listeners.forEach((fn) => fn(info));
}

export function onVerificationStateChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Clear back to "no info yet". Subscribers are notified with null. */
export function resetVerificationState(): void {
  current = null;
  listeners.forEach((fn) => fn(current));
}
