/**
 * Transfer gating policy.
 *
 * Pure function encoding which verification states allow file transfer.
 *
 * Policy (C-pre-2 stabilization):
 *   verified   → transfer allowed
 *   legacy     → transfer allowed (pre-SAS peer, encryption still active)
 *   unverified → transfer BLOCKED (SAS pending — user must verify or reject)
 *   mismatch   → transfer BLOCKED (fail-closed, connection should already be down)
 *
 * R3b: `null` means no verification info has been received yet (see
 * verification-state.ts) and is BLOCKED. That is a new input case, not a change
 * to the three named states above — their mapping is the canonical contract in
 * parity_fixture.json (transfer_gating) and is unchanged.
 */

import type { VerificationInfo } from '@the9ines/localbolt-browser';

export function isTransferAllowed(
  verificationState: VerificationInfo['state'] | null,
  isConnected: boolean,
): boolean {
  return isConnected && (verificationState === 'verified' || verificationState === 'legacy');
}
