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
 */

import type { VerificationInfo } from '@the9ines/localbolt-browser';

export function isTransferAllowed(
  verificationState: VerificationInfo['state'],
  isConnected: boolean,
): boolean {
  return isConnected && (verificationState === 'verified' || verificationState === 'legacy');
}
