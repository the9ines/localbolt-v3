import { describe, expect, it } from 'vitest';
import { getLocalOnlyRTCConfig, getPlatformICEServers, isLocalCandidate } from '../lib/platform-utils.js';

describe('LAN-only ICE policy', () => {
  it('does not configure STUN or TURN servers', () => {
    expect(getPlatformICEServers()).toEqual([]);
    expect(getLocalOnlyRTCConfig().iceServers).toEqual([]);
  });

  it('accepts host candidates', () => {
    const candidate = {
      candidate: 'candidate:1 1 udp 2122260223 192.168.1.1 54321 typ host',
      type: 'host',
    } as RTCIceCandidate;
    expect(isLocalCandidate(candidate)).toBe(true);
  });

  it('rejects server-reflexive candidates', () => {
    const candidate = {
      candidate: 'candidate:1 1 udp 1686052607 203.0.113.10 54321 typ srflx raddr 192.168.1.1 rport 54321',
      type: 'srflx',
    } as RTCIceCandidate;
    expect(isLocalCandidate(candidate)).toBe(false);
  });

  it('rejects relay candidates', () => {
    const candidate = {
      candidate: 'candidate:1 1 udp 41885439 203.0.113.20 54321 typ relay raddr 192.168.1.1 rport 54321',
      type: 'relay',
    } as RTCIceCandidate;
    expect(isLocalCandidate(candidate)).toBe(false);
  });

  it('parses type from candidate string when type property is missing', () => {
    const candidate = {
      candidate: 'candidate:1 1 udp 2122260223 192.168.1.1 54321 typ host',
    } as RTCIceCandidate;
    expect(isLocalCandidate(candidate)).toBe(true);
  });

  it('rejects candidates without a type', () => {
    const candidate = {
      candidate: '',
    } as RTCIceCandidate;
    expect(isLocalCandidate(candidate)).toBe(false);
  });
});
