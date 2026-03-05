/**
 * Transfer gating policy tests.
 *
 * Validates the isTransferAllowed pure function against all verification
 * states and connection combinations.
 */

import { describe, it, expect } from 'vitest';
import { isTransferAllowed } from '../transfer-policy';

describe('isTransferAllowed', () => {
  it('allows transfer when connected and verified', () => {
    expect(isTransferAllowed('verified', true)).toBe(true);
  });

  it('allows transfer when connected and legacy', () => {
    expect(isTransferAllowed('legacy', true)).toBe(true);
  });

  it('blocks transfer when connected but unverified', () => {
    expect(isTransferAllowed('unverified', true)).toBe(false);
  });

  it('blocks transfer when connected but mismatch', () => {
    expect(isTransferAllowed('mismatch', true)).toBe(false);
  });

  it('blocks transfer when disconnected and verified', () => {
    expect(isTransferAllowed('verified', false)).toBe(false);
  });

  it('blocks transfer when disconnected and legacy', () => {
    expect(isTransferAllowed('legacy', false)).toBe(false);
  });

  it('blocks transfer when disconnected and unverified', () => {
    expect(isTransferAllowed('unverified', false)).toBe(false);
  });

  it('blocks transfer when disconnected and mismatch', () => {
    expect(isTransferAllowed('mismatch', false)).toBe(false);
  });
});
