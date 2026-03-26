/**
 * Shared types for the WebRTC service decomposition.
 *
 * Types formerly defined in WebRTCService.ts are canonical here;
 * WebRTCService.ts re-exports them to preserve the public API.
 */

export interface TransferStats {
  speed: number;
  averageSpeed: number;
  estimatedTimeRemaining: number;
  retryCount: number;
  maxRetries: number;
  startTime: number;
  pauseDuration: number;
  lastPausedAt?: number;
}

export interface TransferProgress {
  filename: string;
  currentChunk: number;
  totalChunks: number;
  loaded: number;
  total: number;
  status?: 'receiving' | 'transferring' | 'paused' | 'canceled_by_sender' | 'canceled_by_receiver' | 'error' | 'completed';
  stats?: TransferStats;
  /** RU3: user-meaningful reason when status is 'error' */
  errorDetail?: string;
}

export interface FileChunkMessage {
  type: 'file-chunk';
  filename: string;
  chunk?: string;
  chunkIndex?: number;
  totalChunks?: number;
  fileSize?: number;
  transferId?: string;
  fileHash?: string;
  // Legacy control flags — deprecated (UI-XFER-1). Receive-only for backward compat.
  // Removal target: next major SDK version after all peers emit canonical control messages.
  cancelled?: boolean;
  cancelledBy?: 'sender' | 'receiver';
  paused?: boolean;
  resumed?: boolean;
}

// ─── Canonical DC control messages (UI-XFER-1) ───────────────────────────
// These match the daemon's dc_messages.rs wire format exactly.
// Emit path MUST use these shapes. Legacy file-chunk control flags are receive-only.

export interface PauseMessage {
  type: 'pause';
  transferId: string;
}

export interface ResumeMessage {
  type: 'resume';
  transferId: string;
}

export interface CancelMessage {
  type: 'cancel';
  transferId: string;
  cancelledBy: 'sender' | 'receiver';
}

/** Union of canonical DC control message types. */
export type DcControlMessage = PauseMessage | ResumeMessage | CancelMessage;

/** Set of canonical control type strings for gate checks. */
export const CANONICAL_CONTROL_TYPES = new Set(['pause', 'resume', 'cancel']);

/** Profile Envelope v1 wire format — encrypts inner messages over DataChannel. */
export interface ProfileEnvelopeV1 {
  type: 'profile-envelope';
  version: 1;
  encoding: 'base64';
  payload: string;
  // BTR envelope-level fields (§16.2, BTR-0 wire lock)
  /** Base64-encoded 32-byte ratchet public key. Present on first chunk of a transfer (DH ratchet step). */
  ratchet_public_key?: string;
  /** DH ratchet epoch counter. Present with ratchet_public_key. */
  ratchet_generation?: number;
  /** Symmetric chain position (0-based). Present on every FILE_CHUNK in a BTR session. */
  chain_index?: number;
}

/** Receiver-side state for a guarded transfer (transferId present). */
export interface ActiveTransfer {
  transferId: string;
  filename: string;
  totalChunks: number;
  fileSize: number;
  buffer: (Blob | null)[];
  receivedSet: Set<number>;
  remoteIdentityKey: string;
  expectedHash?: string;
}

export type VerificationState = 'unverified' | 'verified' | 'legacy';

export interface VerificationInfo {
  state: VerificationState;
  sasCode: string | null;
}

export interface WebRTCServiceOptions {
  /** Local identity public key to send in encrypted HELLO. */
  identityPublicKey?: Uint8Array;
  /** Pin store for TOFU peer identity verification. */
  pinStore?: import('./pin-verify.js').PinPersistence;
  /** Callback fired when verification state changes (after HELLO or on legacy timeout). */
  onVerificationState?: (info: VerificationInfo) => void;
  /** Enable BTR (Bolt Transfer Ratchet) capability advertisement. Default: false (dark launch). */
  btrEnabled?: boolean;
  /** Callback fired when BTR downgrade occurs (one-sided support). */
  onBtrDowngrade?: () => void;
}
