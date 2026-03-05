// ── Session orchestration ────────────────────────────────────────────────
export type { SessionPhase, SessionSnapshot } from './session-state';
export {
  getPhase,
  getGeneration,
  getTargetPeer,
  getSessionSnapshot,
  isCurrentGeneration,
  onSessionChange,
  beginRequest,
  receiveRequest,
  beginConnecting,
  markConnected,
  resetSession,
  _resetForTest,
} from './session-state';

// ── Verification state bus ──────────────────────────────────────────────
export {
  getVerificationState,
  setVerificationState,
  onVerificationStateChange,
  resetVerificationState,
} from './verification-state';

// ── Transfer gating policy ──────────────────────────────────────────────
export { isTransferAllowed } from './transfer-policy';
