import { PEER_CODE_ALPHABET } from './constants.js';

// Rejection sampling threshold: largest multiple of N that fits in a byte.
// N = 31 (PEER_CODE_ALPHABET.length), MAX = floor(256/31) * 31 = 248.
// Bytes >= MAX are discarded to eliminate modulo bias.
const REJECTION_MAX = Math.floor(256 / PEER_CODE_ALPHABET.length) * PEER_CODE_ALPHABET.length;

/**
 * Fill `out` with `count` unbiased alphabet indices via rejection sampling.
 * Bytes >= REJECTION_MAX are discarded; survivors use byte % N.
 */
function fillUnbiased(count: number): string[] {
  const N = PEER_CODE_ALPHABET.length;
  const result: string[] = [];
  while (result.length < count) {
    const batch = new Uint8Array(count - result.length + 4); // small over-request
    crypto.getRandomValues(batch);
    for (let i = 0; i < batch.length && result.length < count; i++) {
      if (batch[i] < REJECTION_MAX) {
        result.push(PEER_CODE_ALPHABET[batch[i] % N]);
      }
    }
  }
  return result;
}

/**
 * Generate a cryptographically secure 6-character peer code.
 * Uses rejection sampling to eliminate modulo bias.
 */
export function generateSecurePeerCode(): string {
  return fillUnbiased(6).join('');
}

/**
 * Generate a longer peer code with dash separator.
 * Format: XXXX-XXXX (~40 bits of entropy)
 * Uses rejection sampling to eliminate modulo bias.
 */
export function generateLongPeerCode(): string {
  const chars = fillUnbiased(8);
  return chars.slice(0, 4).join('') + '-' + chars.slice(4).join('');
}

/**
 * Validate peer code format.
 * Accepts 6-char or 8-char (with optional dash) codes using the unambiguous alphabet.
 */
export function isValidPeerCode(code: string): boolean {
  const normalized = code.replace(/-/g, '').toUpperCase();
  if (normalized.length !== 6 && normalized.length !== 8) {
    return false;
  }
  return normalized.split('').every(char => PEER_CODE_ALPHABET.includes(char));
}

/**
 * Normalize peer code for comparison (remove dashes, uppercase).
 */
export function normalizePeerCode(code: string): string {
  return code.replace(/-/g, '').toUpperCase();
}
