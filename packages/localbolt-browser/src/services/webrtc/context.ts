/**
 * ConnectionContext — shared state surface for decomposed WebRTC managers.
 *
 * State ownership: All state lives on WebRTCService. Managers read/write
 * through this interface so that tests (which set fields directly via
 * `(service as any).fieldName`) continue to work without modification.
 */
import type { WebRTCServiceOptions, VerificationInfo } from './types.js';

/**
 * HandshakeContext — the subset of ConnectionContext that HandshakeManager needs.
 * Provides read/write access to handshake-related fields on WebRTCService.
 */
export interface HandshakeContext {
  // ─── Crypto keys (per-session, read-only from handshake perspective) ──
  getKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } | null;
  getRemotePublicKey(): Uint8Array | null;

  // ─── DataChannel (read-only) ────────────────────────────────────
  getDc(): RTCDataChannel | null;

  // ─── Peer codes (read-only) ─────────────────────────────────────
  getLocalPeerCode(): string;
  getRemotePeerCode(): string;

  // ─── Options (read-only) ────────────────────────────────────────
  getOptions(): WebRTCServiceOptions;

  // ─── Cross-cutting callbacks ────────────────────────────────────
  /** Send error frame and disconnect (fatal protocol error). */
  onFatalError(code: string, message: string): void;
  /** Surface an error to the consumer without disconnecting. */
  onError(error: Error): void;
  /** Tear down the entire connection. */
  disconnect(): void;

  // ─── Handshake state (read/write) ───────────────────────────────
  isHelloComplete(): boolean;
  setHelloComplete(value: boolean): void;
  getSessionState(): 'pre_hello' | 'post_hello' | 'closed';
  setSessionState(value: 'pre_hello' | 'post_hello' | 'closed'): void;
  getSessionGeneration(): number;
  isHelloProcessing(): boolean;
  setHelloProcessing(value: boolean): void;
  getHelloTimeout(): ReturnType<typeof setTimeout> | null;
  setHelloTimeout(value: ReturnType<typeof setTimeout> | null): void;
  getHelloResolve(): (() => void) | null;
  setHelloResolve(value: (() => void) | null): void;
  setSessionLegacy(value: boolean): void;

  // ─── Verification state (read/write) ────────────────────────────
  getVerificationInfo(): VerificationInfo;
  setVerificationInfo(info: VerificationInfo): void;
  getRemoteIdentityKey(): Uint8Array | null;
  setRemoteIdentityKey(key: Uint8Array | null): void;

  // ─── Capabilities (read/write) ──────────────────────────────────
  getLocalCapabilities(): string[];
  getNegotiatedCapabilities(): string[];
  setNegotiatedCapabilities(caps: string[]): void;
  setRemoteCapabilities(caps: string[]): void;

  // ─── BTR state (read/write) ───────────────────────────────────
  getBtrMode(): string | null;
  setBtrMode(mode: string | null): void;
}
