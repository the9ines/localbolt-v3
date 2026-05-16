// ── Session orchestration ────────────────────────────────────────────────
export type { SessionPhase, SessionSnapshot } from './session-state.js';
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
} from './session-state.js';

// ── Verification state bus ──────────────────────────────────────────────
export {
  getVerificationState,
  setVerificationState,
  onVerificationStateChange,
  resetVerificationState,
} from './verification-state.js';

// ── Transfer gating policy ──────────────────────────────────────────────
export { isTransferAllowed } from './transfer-policy.js';
