/**
 * Verification state bus — H5-v3.
 *
 * Lightweight pub/sub for TOFU verification state that sits alongside
 * the SDK store. Components subscribe to verification changes without
 * polluting the shared AppState type.
 */

import type { VerificationInfo } from '@the9ines/localbolt-browser';

type Listener = (info: VerificationInfo) => void;

const INITIAL: VerificationInfo = { state: 'legacy', sasCode: null };

let current: VerificationInfo = { ...INITIAL };
const listeners = new Set<Listener>();

export function getVerificationState(): VerificationInfo {
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

export function resetVerificationState(): void {
  current = { ...INITIAL };
  listeners.forEach((fn) => fn(current));
}
