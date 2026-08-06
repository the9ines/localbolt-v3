/**
 * Local-endpoint admission policy matrix.
 *
 * Uses the real isPrivateIP from the SDK — this suite pins the composed
 * policy, not a re-implementation of it.
 */

import { describe, it, expect } from 'vitest';
import { isLocalEndpointUrl, endpointScheme } from '@/lib/local-endpoint';

describe('isLocalEndpointUrl: local endpoints stay admitted', () => {
  const allowed = [
    // RFC1918
    'ws://10.0.0.7:8080',
    'ws://10.255.255.254:8080',
    'ws://172.16.0.1:8080',
    'ws://172.31.255.254:8080',
    'ws://192.168.1.50:8080',
    'wss://192.168.1.50:443',
    'https://192.168.1.50:4433',
    // Loopback — local dev
    'ws://localhost:9876',
    'ws://127.0.0.1:9876',
    'ws://127.1.2.3:9876',
    'wss://[::1]:9876',
    // IPv4 link-local
    'ws://169.254.10.20:8080',
    // CGNAT / Tailscale
    'ws://100.64.0.1:8080',
    'ws://100.93.60.117:8080',
    'ws://100.127.255.254:8080',
    // IPv6 ULA + link-local
    'wss://[fd00::1]:443',
    'wss://[fc00::1]:443',
    'wss://[fe80::1]:443',
    // mDNS
    'ws://desktop.local:8080',
    'wss://desktop.local.:443',
  ];

  for (const url of allowed) {
    it(`admits ${url}`, () => {
      expect(isLocalEndpointUrl(url)).toBe(true);
    });
  }
});

describe('isLocalEndpointUrl: public endpoints rejected', () => {
  const rejected = [
    // Public hostnames — scheme is irrelevant
    'ws://attacker.example.com:8080',
    'wss://attacker.example.com:443',
    'https://attacker.example.com:4433',
    'wss://localbolt.app',
    'wss://bolt-rendezvous.fly.dev',
    // Public IP literals
    'ws://93.184.216.34:8080',
    'wss://8.8.8.8:443',
    'wss://[2606:4700:4700::1111]:443',
    // Adjacent-but-public ranges
    'ws://172.15.0.1:8080',
    'ws://172.32.0.1:8080',
    'ws://100.63.255.255:8080',
    'ws://100.128.0.1:8080',
    'ws://11.0.0.1:8080',
    'ws://192.169.1.1:8080',
    // Hostnames that only look like private literals
    'ws://10.evil.com:8080',
    'ws://192.168.evil.com:8080',
    'ws://172.16.attacker.example.com:8080',
    'ws://127.0.0.1.attacker.example.com:8080',
    'ws://fd00.example.com:8080',
    // Credentials smuggling the private form into userinfo
    'ws://192.168.1.5@attacker.example.com:8080',
    'wss://localhost@attacker.example.com:443',
    'wss://desktop.local@attacker.example.com:443',
    // Unroutable / not a dial target
    'ws://0.0.0.0:8080',
  ];

  for (const url of rejected) {
    it(`rejects ${url}`, () => {
      expect(isLocalEndpointUrl(url)).toBe(false);
    });
  }
});

describe('endpointScheme', () => {
  it('reports the scheme each transport gate keys off', () => {
    expect(endpointScheme('ws://192.168.1.50:8080')).toBe('ws:');
    expect(endpointScheme('wss://192.168.1.50:443')).toBe('wss:');
    expect(endpointScheme('https://192.168.1.50:4433')).toBe('https:');
  });

  it('normalizes case so a scheme cannot be disguised', () => {
    expect(endpointScheme('WSS://192.168.1.50:443')).toBe('wss:');
    expect(endpointScheme('HtTpS://192.168.1.50:4433')).toBe('https:');
  });

  it('returns null rather than guessing', () => {
    expect(endpointScheme('')).toBe(null);
    expect(endpointScheme(null)).toBe(null);
    expect(endpointScheme(undefined)).toBe(null);
    expect(endpointScheme('192.168.1.50:8080')).toBe(null);
    expect(endpointScheme('not a url')).toBe(null);
  });
});

describe('isLocalEndpointUrl: locality is independent of transport scheme', () => {
  it('admits all three transport schemes on a local host', () => {
    // The gates narrow this per transport; the helper itself only judges locality.
    expect(isLocalEndpointUrl('ws://192.168.1.50:8080')).toBe(true);
    expect(isLocalEndpointUrl('wss://192.168.1.50:443')).toBe(true);
    expect(isLocalEndpointUrl('https://192.168.1.50:4433')).toBe(true);
  });
});

describe('isLocalEndpointUrl: fails closed', () => {
  it('rejects empty and nullish input', () => {
    expect(isLocalEndpointUrl('')).toBe(false);
    expect(isLocalEndpointUrl(null)).toBe(false);
    expect(isLocalEndpointUrl(undefined)).toBe(false);
  });

  it('rejects unparseable URLs', () => {
    expect(isLocalEndpointUrl('not a url')).toBe(false);
    expect(isLocalEndpointUrl('192.168.1.5:8080')).toBe(false); // no scheme
    expect(isLocalEndpointUrl('//192.168.1.5:8080')).toBe(false);
  });

  it('rejects off-policy schemes even on a local host', () => {
    expect(isLocalEndpointUrl('http://192.168.1.50:8080')).toBe(false);
    expect(isLocalEndpointUrl('file:///etc/passwd')).toBe(false);
    expect(isLocalEndpointUrl('javascript:alert(1)')).toBe(false);
    expect(isLocalEndpointUrl('data:text/html,x')).toBe(false);
  });
});
