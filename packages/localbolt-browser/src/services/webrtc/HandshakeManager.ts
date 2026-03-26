/**
 * HandshakeManager — owns HELLO handshake logic, TOFU/SAS verification,
 * and capability negotiation.
 *
 * Extracted from WebRTCService (A1). All behavior preserved exactly.
 *
 * State ownership: HandshakeManager does NOT own handshake state. All state
 * lives on WebRTCService (for test compatibility — tests set fields directly
 * via `(service as any).fieldName`). The manager reads/writes shared state
 * through the ConnectionContext bridge.
 */
import { openBoxPayload, sealBoxPayload, toBase64, fromBase64, KeyMismatchError, computeSas, negotiateBtr, btrLogToken, BtrMode } from '@the9ines/bolt-core';
import { ConnectionError } from '../../types/webrtc-errors.js';
import { verifyPinnedIdentity } from './pin-verify.js';
import type { HandshakeContext } from './context.js';
import type { VerificationState, VerificationInfo } from './types.js';

const HELLO_TIMEOUT_MS = 5000;

export class HandshakeManager {
  constructor(private ctx: HandshakeContext) {}

  // ─── HELLO Protocol ────────────────────────────────────────────────

  initiateHello(): void {
    const options = this.ctx.getOptions();
    const keyPair = this.ctx.getKeyPair();
    const remotePublicKey = this.ctx.getRemotePublicKey();
    const dc = this.ctx.getDc();

    if (!options.identityPublicKey || !keyPair || !remotePublicKey) {
      // No identity configured — this node operates in legacy mode
      this.ctx.setSessionState('post_hello');
      this.ctx.setHelloComplete(true);
      this.ctx.setSessionLegacy(true);
      this.ctx.setVerificationInfo({ state: 'legacy', sasCode: null });
      options.onVerificationState?.(this.ctx.getVerificationInfo());
      console.log('[HELLO] No identity configured, skipping HELLO');
      return;
    }

    // Send encrypted HELLO over DataChannel
    const hello = JSON.stringify({
      type: 'hello',
      version: 1,
      identityPublicKey: toBase64(options.identityPublicKey),
      capabilities: this.ctx.getLocalCapabilities(),
    });
    const plaintext = new TextEncoder().encode(hello);
    const encrypted = sealBoxPayload(plaintext, remotePublicKey, keyPair.secretKey);
    dc!.send(JSON.stringify({ type: 'hello', payload: encrypted }));
    console.log('[HELLO] Sent encrypted HELLO');

    // Start timeout — fail-closed if remote doesn't complete HELLO (SA10)
    // SA14: capture session generation to detect stale callbacks after disconnect+reconnect
    const gen = this.ctx.getSessionGeneration();
    this.ctx.setHelloTimeout(setTimeout(() => {
      if (gen !== this.ctx.getSessionGeneration()) return; // stale timeout from previous session
      if (!this.ctx.isHelloComplete()) {
        console.error('[HELLO_TIMEOUT] HELLO not completed within timeout — identity required, failing closed');
        const error = new ConnectionError('HELLO handshake timed out while identity is required');
        this.ctx.disconnect();
        this.ctx.onError(error);
      }
    }, HELLO_TIMEOUT_MS));
  }

  async processHello(msg: { type: 'hello'; payload: string }): Promise<void> {
    // SA12: synchronous reentrancy guard — must be set before any await
    if (this.ctx.isHelloProcessing()) {
      console.warn('[DUPLICATE_HELLO] HELLO received while processing — disconnecting');
      this.ctx.onFatalError('DUPLICATE_HELLO', 'Duplicate HELLO');
      return;
    }
    this.ctx.setHelloProcessing(true);

    // N2: scoped-lock — try/finally guarantees reset on all exits (success, error, unexpected throw)
    try {
      const keyPair = this.ctx.getKeyPair();
      const remotePublicKey = this.ctx.getRemotePublicKey();
      const options = this.ctx.getOptions();

      // H2: Fail-closed HELLO processing — all failures send error + disconnect
      if (!keyPair || !remotePublicKey) {
        console.warn('[HELLO_DECRYPT_FAIL] Cannot decrypt — no ephemeral keys');
        this.ctx.onFatalError('HELLO_DECRYPT_FAIL', 'Cannot decrypt HELLO');
        return;
      }

      let decrypted: Uint8Array;
      try {
        decrypted = openBoxPayload(msg.payload, remotePublicKey, keyPair.secretKey);
      } catch {
        console.warn('[HELLO_DECRYPT_FAIL] Failed to decrypt HELLO payload');
        this.ctx.onFatalError('HELLO_DECRYPT_FAIL', 'Failed to decrypt HELLO');
        return;
      }

      let hello: any;
      try {
        hello = JSON.parse(new TextDecoder().decode(decrypted));
      } catch {
        console.warn('[HELLO_PARSE_ERROR] Failed to parse HELLO JSON');
        this.ctx.onFatalError('HELLO_PARSE_ERROR', 'Failed to parse HELLO');
        return;
      }

      if (hello.type !== 'hello' || hello.version !== 1 || !hello.identityPublicKey) {
        console.warn('[HELLO_SCHEMA_ERROR] Invalid HELLO format');
        this.ctx.onFatalError('HELLO_SCHEMA_ERROR', 'Invalid HELLO schema');
        return;
      }

      const remoteIdentityKey = fromBase64(hello.identityPublicKey);
      this.ctx.setRemoteIdentityKey(remoteIdentityKey);

      // Capabilities negotiation — missing field treated as empty (backward compat)
      // SA17: reject oversized capabilities array (max 32)
      const rawCaps = Array.isArray(hello.capabilities) ? hello.capabilities : [];
      if (rawCaps.length > 32) {
        console.warn(`[PROTOCOL_VIOLATION] capabilities array length ${rawCaps.length} exceeds max 32 — disconnecting`);
        this.ctx.onFatalError('PROTOCOL_VIOLATION', 'Capabilities array exceeds maximum length');
        return;
      }
      // N8: reject individual capability strings exceeding 64 UTF-8 bytes
      const encoder = new TextEncoder();
      for (const cap of rawCaps) {
        if (encoder.encode(cap).length > 64) {
          console.warn('[PROTOCOL_VIOLATION] capability too long — disconnecting');
          this.ctx.onFatalError('PROTOCOL_VIOLATION', 'capability too long');
          return;
        }
      }
      this.ctx.setRemoteCapabilities(rawCaps);
      const localSet = new Set(this.ctx.getLocalCapabilities());
      this.ctx.setNegotiatedCapabilities(rawCaps.filter((c: string) => localSet.has(c)));
      console.log('[HELLO] Remote capabilities:', rawCaps, '→ negotiated:', this.ctx.getNegotiatedCapabilities());

      // BTR negotiation (§16.2): determine BTR mode from capability intersection
      const localSupportsBtr = localSet.has('bolt.transfer-ratchet-v1');
      const remoteSupportsBtr = rawCaps.includes('bolt.transfer-ratchet-v1');
      // Remote is well-formed if they advertise BTR and pass all other validation
      // (reaching this point means no protocol violations detected)
      const remoteWellFormed = remoteSupportsBtr;
      const btrMode = negotiateBtr(localSupportsBtr, remoteSupportsBtr, remoteWellFormed);
      this.ctx.setBtrMode(btrMode);

      const btrToken = btrLogToken(btrMode);
      if (btrMode === BtrMode.FullBtr) {
        console.log('[BTR_FULL] BTR negotiated — per-transfer DH ratchet + per-chunk chain active');
      } else if (btrToken) {
        console.warn(`${btrToken} BTR mode: ${btrMode}`);
      }
      if (btrMode === BtrMode.Reject) {
        this.ctx.onFatalError('RATCHET_DOWNGRADE_REJECTED', 'Malformed BTR capability advertisement');
        return;
      }
      if (btrMode === BtrMode.Downgrade) {
        options.onBtrDowngrade?.();
      }

      // N5: Enforce envelope-v1 in identity-configured sessions.
      // If we reach processHello(), identity IS configured. Remote MUST
      // advertise bolt.profile-envelope-v1 — omission is downgrade attack.
      if (!rawCaps.includes('bolt.profile-envelope-v1')) {
        console.warn('[PROTOCOL_VIOLATION] Remote omitted required capability bolt.profile-envelope-v1 — disconnecting');
        this.ctx.onFatalError('PROTOCOL_VIOLATION', 'Missing required capability: bolt.profile-envelope-v1');
        return;
      }

      console.log('[HELLO] Received identity from peer', this.ctx.getRemotePeerCode());

      // TOFU verification — determines verification state
      let verificationState: VerificationState = 'unverified';

      if (options.pinStore) {
        try {
          const result = await verifyPinnedIdentity(
            options.pinStore,
            this.ctx.getRemotePeerCode(),
            remoteIdentityKey,
          );
          if (result.outcome === 'pinned') {
            console.log('[TOFU] First contact — pinned identity for', this.ctx.getRemotePeerCode());
            verificationState = 'unverified';
          } else {
            console.log('[TOFU] Identity verified for', this.ctx.getRemotePeerCode());
            verificationState = result.verified ? 'verified' : 'unverified';
          }
        } catch (error) {
          if (error instanceof KeyMismatchError) {
            console.error('[TOFU] IDENTITY MISMATCH — aborting session:', error.message);
            this.ctx.onError(new ConnectionError('Identity key mismatch (TOFU violation)', error));
            this.ctx.onFatalError('KEY_MISMATCH', 'Identity key mismatch');
            return;
          }
          throw error;
        }
      }

      // Compute SAS — only when all 4 keys are available (never in legacy path)
      let sasCode: string | null = null;
      if (options.identityPublicKey && keyPair && remotePublicKey) {
        sasCode = await computeSas(
          options.identityPublicKey,
          remoteIdentityKey,
          keyPair.publicKey,
          remotePublicKey,
        );
        console.log('[SAS] Computed verification code:', sasCode);
      }

      // Emit verification state exactly once per HELLO
      this.ctx.setVerificationInfo({ state: verificationState, sasCode });
      options.onVerificationState?.(this.ctx.getVerificationInfo());

      // HELLO complete — transition state
      const helloTimeout = this.ctx.getHelloTimeout();
      if (helloTimeout) {
        clearTimeout(helloTimeout);
        this.ctx.setHelloTimeout(null);
      }
      this.ctx.setSessionState('post_hello');
      this.ctx.setHelloComplete(true);
      this.ctx.setSessionLegacy(false);
      const helloResolve = this.ctx.getHelloResolve();
      if (helloResolve) {
        helloResolve();
        this.ctx.setHelloResolve(null);
      }
    } finally {
      this.ctx.setHelloProcessing(false);
    }
  }

  // ─── Public accessors ─────────────────────────────────────────────

  /** Whether profile-envelope-v1 was mutually negotiated. */
  negotiatedEnvelopeV1(): boolean {
    return this.ctx.getNegotiatedCapabilities().includes('bolt.profile-envelope-v1');
  }

  /** Mark the current peer as verified. Persists to pin store. */
  async markPeerVerified(): Promise<void> {
    const options = this.ctx.getOptions();
    const remotePeerCode = this.ctx.getRemotePeerCode();
    if (!options.pinStore || !remotePeerCode) return;
    await options.pinStore.markVerified(remotePeerCode);
    const info = this.ctx.getVerificationInfo();
    this.ctx.setVerificationInfo({ ...info, state: 'verified' });
    options.onVerificationState?.(this.ctx.getVerificationInfo());
  }
}
