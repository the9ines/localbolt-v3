/**
 * T-STREAM-1 PolicyAdapter tests.
 *
 * Tests the TS fallback adapter for behavioral parity with pre-WASM
 * TransferManager behavior, and verifies adapter factory mechanics.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPolicyAdapter,
  setPolicyAdapter,
  resetPolicyAdapter,
  type PolicyAdapter,
  type PolicyDecideInput,
  type StallDetectInput,
  type ProgressCadenceInput,
  type ScheduleDecision,
} from '../services/webrtc/PolicyAdapter.js';

// ─── Helpers ──────────────────────────────────────────────────────────

function makeDecideInput(overrides: Partial<PolicyDecideInput> = {}): PolicyDecideInput {
  return {
    pendingChunkIds: new Uint32Array([0, 1, 2, 3, 4]),
    rttMs: 10,
    lossPpm: 0,
    deviceClass: 0,   // Desktop
    maxParallelChunks: 4,
    maxInFlightBytes: 65536,
    priority: 128,
    fairnessMode: 0,  // Balanced
    configuredChunkSize: 16384,
    transportMaxMessageSize: 65536,
    pressure: 0,      // Clear
    ...overrides,
  };
}

function makeStallInput(overrides: Partial<StallDetectInput> = {}): StallDetectInput {
  return {
    bytesAcked: 1000,
    totalBytes: 10000,
    msSinceProgress: 0,
    stallThresholdMs: 10000,
    warnThresholdMs: 5000,
    ...overrides,
  };
}

function makeProgressInput(overrides: Partial<ProgressCadenceInput> = {}): ProgressCadenceInput {
  return {
    bytesTransferred: 5000,
    totalBytes: 10000,
    elapsedSinceLastReportMs: 300,
    lastReportedPercent: 0,
    minIntervalMs: 250,
    minPercentDelta: 1,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('T-STREAM-1: PolicyAdapter', () => {

  afterEach(() => {
    resetPolicyAdapter();
  });

  describe('Factory mechanics', () => {
    it('getPolicyAdapter returns ts-fallback when no WASM loaded', () => {
      const adapter = getPolicyAdapter();
      expect(adapter.name).toBe('ts-fallback');
    });

    it('setPolicyAdapter overrides the active adapter', () => {
      const mock: PolicyAdapter = {
        name: 'test-mock',
        decide: () => ({
          nextChunkIds: new Uint32Array(),
          pacingDelayMs: 0,
          windowSuggestionChunks: 0,
          backpressure: 'no-change',
          effectiveChunkSize: 16384,
        }),
        detectStall: () => ({ classification: 'healthy', msSinceProgress: 0 }),
        progressCadence: () => ({ shouldEmit: true, percent: 50, bytesTransferred: 5000, totalBytes: 10000 }),
      };
      setPolicyAdapter(mock);
      expect(getPolicyAdapter().name).toBe('test-mock');
    });

    it('resetPolicyAdapter clears the active adapter', () => {
      const mock: PolicyAdapter = {
        name: 'test-mock',
        decide: () => ({
          nextChunkIds: new Uint32Array(),
          pacingDelayMs: 0,
          windowSuggestionChunks: 0,
          backpressure: 'no-change',
          effectiveChunkSize: 16384,
        }),
        detectStall: () => ({ classification: 'healthy', msSinceProgress: 0 }),
        progressCadence: () => ({ shouldEmit: true, percent: 50, bytesTransferred: 5000, totalBytes: 10000 }),
      };
      setPolicyAdapter(mock);
      resetPolicyAdapter();
      expect(getPolicyAdapter().name).toBe('ts-fallback');
    });
  });

  describe('TsFallbackPolicyAdapter.decide — behavioral parity', () => {
    let adapter: PolicyAdapter;

    beforeEach(() => {
      resetPolicyAdapter();
      adapter = getPolicyAdapter();
    });

    it('returns all pending chunks (replicates sequential loop)', () => {
      const input = makeDecideInput();
      const result = adapter.decide(input);

      // Current behavior: for loop processes ALL chunks, one per iteration.
      // Fallback returns all pending so caller iterates them sequentially.
      expect(result.nextChunkIds).toEqual(new Uint32Array([0, 1, 2, 3, 4]));
    });

    it('preserves chunk ordering', () => {
      const input = makeDecideInput({
        pendingChunkIds: new Uint32Array([7, 3, 12, 0, 5]),
      });
      const result = adapter.decide(input);
      expect(Array.from(result.nextChunkIds)).toEqual([7, 3, 12, 0, 5]);
    });

    it('returns zero pacing delay (matches current back-to-back behavior)', () => {
      const result = adapter.decide(makeDecideInput());
      expect(result.pacingDelayMs).toBe(0);
    });

    it('always returns no-change backpressure (TS handles DC bufferedAmount)', () => {
      const result = adapter.decide(makeDecideInput({ pressure: 2 }));
      expect(result.backpressure).toBe('no-change');
    });

    it('uses configuredChunkSize as effectiveChunkSize (no transport cap)', () => {
      const result = adapter.decide(makeDecideInput({
        configuredChunkSize: 16384,
        transportMaxMessageSize: 8192,
      }));
      // Current behavior: DEFAULT_CHUNK_SIZE used directly, no transport cap.
      expect(result.effectiveChunkSize).toBe(16384);
    });

    it('handles empty pending chunks', () => {
      const result = adapter.decide(makeDecideInput({
        pendingChunkIds: new Uint32Array(),
      }));
      expect(result.nextChunkIds.length).toBe(0);
      expect(result.windowSuggestionChunks).toBe(0);
    });

    it('windowSuggestionChunks equals pending count (no windowing)', () => {
      const input = makeDecideInput({
        pendingChunkIds: new Uint32Array([0, 1, 2]),
      });
      const result = adapter.decide(input);
      expect(result.windowSuggestionChunks).toBe(3);
    });
  });

  describe('TsFallbackPolicyAdapter.detectStall — behavioral parity', () => {
    let adapter: PolicyAdapter;

    beforeEach(() => {
      resetPolicyAdapter();
      adapter = getPolicyAdapter();
    });

    it('always returns healthy (current send path has no stall detection)', () => {
      expect(adapter.detectStall(makeStallInput()).classification).toBe('healthy');
    });

    it('returns healthy even with high ms_since_progress', () => {
      const result = adapter.detectStall(makeStallInput({
        msSinceProgress: 999999,
      }));
      expect(result.classification).toBe('healthy');
    });

    it('returns healthy even when complete', () => {
      const result = adapter.detectStall(makeStallInput({
        bytesAcked: 10000,
        totalBytes: 10000,
      }));
      expect(result.classification).toBe('healthy');
    });
  });

  describe('TsFallbackPolicyAdapter.progressCadence — behavioral parity', () => {
    let adapter: PolicyAdapter;

    beforeEach(() => {
      resetPolicyAdapter();
      adapter = getPolicyAdapter();
    });

    it('always emits (current behavior: emitProgress after every chunk)', () => {
      const result = adapter.progressCadence(makeProgressInput());
      expect(result.shouldEmit).toBe(true);
    });

    it('emits even when elapsed < minInterval (no cadence gating)', () => {
      const result = adapter.progressCadence(makeProgressInput({
        elapsedSinceLastReportMs: 1,
      }));
      expect(result.shouldEmit).toBe(true);
    });

    it('emits even when delta < minPercentDelta (no cadence gating)', () => {
      const result = adapter.progressCadence(makeProgressInput({
        lastReportedPercent: 50,
        bytesTransferred: 5100,
        totalBytes: 10000,
      }));
      expect(result.shouldEmit).toBe(true);
    });

    it('computes correct percent', () => {
      const result = adapter.progressCadence(makeProgressInput({
        bytesTransferred: 7500,
        totalBytes: 10000,
      }));
      expect(result.percent).toBe(75);
    });

    it('caps percent at 100', () => {
      const result = adapter.progressCadence(makeProgressInput({
        bytesTransferred: 20000,
        totalBytes: 10000,
      }));
      expect(result.percent).toBe(100);
    });

    it('returns 0 percent for zero total', () => {
      const result = adapter.progressCadence(makeProgressInput({
        bytesTransferred: 0,
        totalBytes: 0,
      }));
      expect(result.shouldEmit).toBe(true);
      expect(result.percent).toBe(0);
    });

    it('passes through bytesTransferred and totalBytes', () => {
      const result = adapter.progressCadence(makeProgressInput({
        bytesTransferred: 3000,
        totalBytes: 9000,
      }));
      expect(result.bytesTransferred).toBe(3000);
      expect(result.totalBytes).toBe(9000);
    });
  });
});
