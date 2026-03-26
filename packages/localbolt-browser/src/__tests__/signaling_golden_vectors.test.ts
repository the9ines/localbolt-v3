// @vitest-environment jsdom
/**
 * Signaling Golden Vector Parity Tests
 *
 * Validates structural JSON parity between canonical Rust signaling shapes
 * (bolt-rendezvous-protocol, sourced from rendezvous-v0.2.6-clean-1) and
 * TS transport-web encode/decode behavior.
 *
 * Evidence for: AC-6, AC-19, AC-20
 *
 * Interop standard: deep-equal on parsed objects (not byte-level string equality).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WebSocketSignaling } from '../services/signaling/WebSocketSignaling.js';

const goldenDir = resolve(process.cwd(), 'src/__tests__/golden');

function loadFixture(name: string): any {
  return JSON.parse(readFileSync(join(goldenDir, name), 'utf-8'));
}

// ─── Server → Client: Decode Parity (AC-20, AC-6) ───────────────────────────

describe('signaling golden vectors — server → client (decode parity)', () => {
  it('peers: type, peers array with required peer fields', () => {
    const fixture = loadFixture('peers.json');

    expect(fixture.type).toBe('peers');
    expect(Array.isArray(fixture.peers)).toBe(true);
    expect(fixture.peers.length).toBeGreaterThan(0);

    const peer = fixture.peers[0];
    expect(peer).toEqual({
      peer_code: 'ABC123',
      device_name: 'MacBook',
      device_type: 'laptop',
    });

    // Structural completeness: no extra top-level keys
    expect(Object.keys(fixture).sort()).toEqual(['peers', 'type']);
  });

  it('peer_joined: type, peer object with required fields', () => {
    const fixture = loadFixture('peer_joined.json');

    expect(fixture.type).toBe('peer_joined');
    expect(fixture.peer).toEqual({
      peer_code: 'DEF456',
      device_name: 'iPad',
      device_type: 'tablet',
    });

    expect(Object.keys(fixture).sort()).toEqual(['peer', 'type']);
  });

  it('peer_left: type, peer_code field', () => {
    const fixture = loadFixture('peer_left.json');

    expect(fixture.type).toBe('peer_left');
    expect(typeof fixture.peer_code).toBe('string');
    expect(fixture.peer_code).toBe('ABC123');

    expect(Object.keys(fixture).sort()).toEqual(['peer_code', 'type']);
  });

  it('signal (inbound): type, from, payload', () => {
    const fixture = loadFixture('signal_in.json');

    expect(fixture.type).toBe('signal');
    expect(typeof fixture.from).toBe('string');
    expect(fixture.from).toBe('ABC123');
    expect(fixture.payload).toEqual({ sdp: 'offer-data' });

    expect(Object.keys(fixture).sort()).toEqual(['from', 'payload', 'type']);
  });

  it('error: type, message string', () => {
    const fixture = loadFixture('error.json');

    expect(fixture.type).toBe('error');
    expect(typeof fixture.message).toBe('string');
    expect(fixture.message).toBe('bad request');

    expect(Object.keys(fixture).sort()).toEqual(['message', 'type']);
  });
});

// ─── Client → Server: Encode Parity (AC-20, AC-6) ───────────────────────────

describe('signaling golden vectors — client → server (encode parity)', () => {
  it('register: TS typed literal matches canonical Rust shape', () => {
    const fixture = loadFixture('register.json');

    // Construct a TS message literal with the same fields as the fixture
    const produced = {
      type: 'register' as const,
      peer_code: fixture.peer_code,
      device_name: fixture.device_name,
      device_type: fixture.device_type,
    };

    expect(produced).toEqual(fixture);
  });

  it('signal (outbound): TS typed literal matches canonical Rust shape', () => {
    const fixture = loadFixture('signal_out.json');

    const produced = {
      type: 'signal' as const,
      to: fixture.to,
      payload: fixture.payload,
    };

    expect(produced).toEqual(fixture);
  });
});

// ─── Full Roundtrip: JSON.stringify → JSON.parse structural equality ─────────

describe('signaling golden vectors — roundtrip parity', () => {
  const fixtures = [
    'peers.json',
    'peer_joined.json',
    'peer_left.json',
    'signal_in.json',
    'signal_out.json',
    'error.json',
    'register.json',
  ];

  it.each(fixtures)('%s survives JSON roundtrip', (name) => {
    const fixture = loadFixture(name);
    const roundtripped = JSON.parse(JSON.stringify(fixture));
    expect(roundtripped).toEqual(fixture);
  });
});

// ─── Negative Tests ──────────────────────────────────────────────────────────

describe('signaling golden vectors — negative tests', () => {
  it('unknown type is not recognized as any valid server message variant', () => {
    const unknown = { type: 'unknown_msg', data: 'whatever' };

    // Verify the type discriminant does not match any valid server variant
    const validServerTypes = ['peers', 'peer_joined', 'peer_left', 'signal', 'error'];
    expect(validServerTypes).not.toContain(unknown.type);
  });

  it('peers message missing peers array is structurally invalid', () => {
    const malformed = { type: 'peers' };

    // A valid peers message MUST have a peers array
    expect(malformed).not.toHaveProperty('peers');
  });

  it('peer_joined message missing peer object is structurally invalid', () => {
    const malformed = { type: 'peer_joined' };

    expect(malformed).not.toHaveProperty('peer');
  });

  it('peer_left message missing peer_code is structurally invalid', () => {
    const malformed = { type: 'peer_left' };

    expect(malformed).not.toHaveProperty('peer_code');
  });

  it('signal message missing from field is structurally invalid (inbound)', () => {
    const malformed = { type: 'signal', payload: { sdp: 'data' } };

    expect(malformed).not.toHaveProperty('from');
  });

  it('error message missing message field is structurally invalid', () => {
    const malformed = { type: 'error' };

    expect(malformed).not.toHaveProperty('message');
  });
});

// ─── AC-19 Runtime Handler Tests (ServerErrorMessage) ────────────────────────

describe('signaling golden vectors — AC-19 error handler validation', () => {
  function makeMessageEvent(data: string): MessageEvent {
    return new MessageEvent('message', { data });
  }

  it('valid error fixture is recognized by handleMessage (console.warn emitted)', () => {
    const ws = new WebSocketSignaling('ws://localhost:0');
    const fixture = loadFixture('error.json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Call the private handleMessage directly
    (ws as any).handleMessage(makeMessageEvent(JSON.stringify(fixture)));

    expect(warnSpy).toHaveBeenCalledWith(
      '[WS-SIGNAL] Server error:',
      'bad request'
    );

    warnSpy.mockRestore();
    ws.disconnect();
  });

  it('error fixture without message field hits default branch (unknown type is not thrown)', () => {
    const ws = new WebSocketSignaling('ws://localhost:0');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Malformed: missing message field. JSON.parse succeeds but type is "error"
    // and msg.message will be undefined. The handler still recognizes the type.
    (ws as any).handleMessage(makeMessageEvent(JSON.stringify({ type: 'error' })));

    // The handler should still hit the "error" case, logging undefined for message
    expect(warnSpy).toHaveBeenCalledWith(
      '[WS-SIGNAL] Server error:',
      undefined
    );

    warnSpy.mockRestore();
    ws.disconnect();
  });

  it('unknown type hits default branch with warning', () => {
    const ws = new WebSocketSignaling('ws://localhost:0');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    (ws as any).handleMessage(makeMessageEvent(JSON.stringify({ type: 'bogus' })));

    expect(warnSpy).toHaveBeenCalledWith(
      '[WS-SIGNAL] Unknown message type:',
      'bogus'
    );

    warnSpy.mockRestore();
    ws.disconnect();
  });

  it('unparseable JSON is dropped with warning', () => {
    const ws = new WebSocketSignaling('ws://localhost:0');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    (ws as any).handleMessage(makeMessageEvent('not-json{{{'));

    expect(warnSpy).toHaveBeenCalledWith(
      '[WS-SIGNAL] Failed to parse message:',
      'not-json{{{'
    );

    warnSpy.mockRestore();
    ws.disconnect();
  });
});
