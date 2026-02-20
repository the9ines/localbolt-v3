# LocalBolt v3 — Product Requirements Document

**Version:** 1.0.0
**Date:** 2026-02-20

---

## 1. Current State Summary

**Version:** v3.0.38-faq-sync (production web, live at localbolt.site)
**Stack:** Vanilla TypeScript, Tailwind CSS, Vite, TweetNaCl, Rust signal server, Netlify + Fly.io
**Test coverage:** None (no automated test suite)
**Deployment:** Netlify (web), Fly.io (signal server at wss://localbolt-signal.fly.dev)

### Implemented and Working

- Full encrypted file transfer (NaCl box, per-chunk nonce, 16KB chunks, WebRTC)
- Dual signaling (cloud Fly.io + local LAN if running localbolt/localbolt-app nearby)
- IP-based peer discovery with CGNAT/Tailscale support
- Security hardening (CSP, XSS prevention, peer validation, ICE relay blocking, SAS verification)
- Netlify deployment with Observatory A+ security headers (HSTS, COOP, Permissions-Policy)
- Comprehensive SEO (structured data, Open Graph, FAQ schema)
- CI/CD (GitHub Actions: fmt, clippy, tests, build; Dependabot)
- Documentation (CHANGELOG.md with 39 entries, STATE.md, CLAUDE.md)
- Consent-based analytics (Google Analytics with denied-by-default storage)
- Monorepo: packages/localbolt-web + packages/localbolt-signal + apps/tauri (scaffold)

### Partially Implemented

- Tauri native app scaffold (apps/tauri): config in place, builds runnable, but missing file system integration, mDNS, and background transfers
- Transfer retry: exists but untested

### Missing

- Automated test suite (WebRTCService 679 lines untested, DualSignaling untested)
- TypeScript strict mode (noImplicitAny, strictNullChecks disabled)
- File resume on interrupted transfer
- Directory transfer
- mDNS offline discovery (for Tauri app)
- Persistent identity keys
- Compression

### Unstable

- Nothing currently unstable. Web deployment is stable and live.

### Legacy Debt

- apps/tauri scaffold from early v3 development — needs updating or removing if localbolt-app supersedes it
- Some SEO sections (how-it-works, features, FAQ) serve marketing purposes rather than app functionality

### Production-Ready

- Web frontend (localbolt.site)
- Signal server (localbolt-signal.fly.dev)
- Deployment pipeline (Netlify + Fly.io)
- Security posture (A+ Observatory, CSP, hardened headers)

---

## 2. Target State (12-Month Horizon)

LocalBolt v3 is the flagship hosted web experience:

1. Consumes bolt-core-sdk instead of inline TweetNaCl
2. Comprehensive test suite (crypto, signaling, transfer)
3. TypeScript strict mode enabled
4. Resolve Tauri scaffold: either complete it or remove in favor of localbolt-app
5. Performance optimization (compression, adaptive chunk sizes)
6. PWA support (installable, offline-capable via service worker)

---

## 3. Gap Analysis

| Capability | Current | Target | Gap |
|-----------|---------|--------|-----|
| Encryption source | Inline TweetNaCl | bolt-core-sdk | SDK not yet published |
| Test coverage | 0% | 80%+ | Full test suite needed |
| TypeScript strict | Disabled | Enabled | Incremental migration |
| Tauri scaffold | Incomplete | Resolved | Decision: complete or remove |
| PWA | No | Yes | Service worker + manifest |
| Compression | No | Optional | Feature implementation |

---

## 4. Non-Goals

1. **Not self-hosted.** Self-hosted is localbolt. This is the hosted version.
2. **Not a native app.** Native apps are localbolt-app (or resolve Tauri scaffold).
3. **No accounts.** Zero-knowledge design.
4. **No server-side file storage.** Files are always peer-to-peer.
5. **No relay support.** Local discovery + cloud signaling only. Global relay is ByteBolt.
6. **No paid features.** This is a free, open-source product.

---

## 5. Technical Constraints

- Must deploy as static site on Netlify (no server-side rendering)
- Signal server must deploy on Fly.io (or compatible platform)
- Frontend must remain vanilla TypeScript (no React/Vue/Svelte)
- Must maintain Observatory A+ security rating
- Must maintain structured data for SEO (JSON-LD)
- Signal server endpoint: wss://localbolt-signal.fly.dev (stable URL)
- Private repository (not publicly visible on GitHub)

---

## 6. Dependency Requirements

| Dependency | Status | Required For |
|-----------|--------|-------------|
| bolt-core-sdk (TypeScript) | Not published | SDK migration |
| bolt-rendezvous | Hosted endpoint only | Signal server |
| bolt-daemon | Not applicable | — |
| bytebolt-relay | Not applicable | — |

---

## 7. Release Milestones

| Milestone | Tag | Description |
|-----------|-----|-------------|
| Test suite | v3.1.0-tests | Add Vitest suite for crypto, signaling, WebRTC |
| TS strict mode | v3.1.1-strict | Enable noImplicitAny and strictNullChecks |
| SDK migration | v3.2.0-sdk | Replace inline TweetNaCl with bolt-core-sdk |
| Tauri resolution | v3.2.1-tauri-cleanup | Complete or remove apps/tauri scaffold |
| PWA support | v3.3.0-pwa | Service worker, offline manifest, install prompt |
| Compression | v3.3.1-compression | Optional gzip before encryption |

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|:---:|:---:|-----------|
| No tests → regression on refactor | High | High | Prioritize test suite (milestone 1) |
| SDK migration breaks crypto | Low | Critical | Conformance vectors validate equivalence |
| Tauri scaffold confuses contributors | Medium | Low | Resolve in v3.2.1 |
| Fly.io pricing changes | Low | Medium | Signal server can deploy anywhere (Docker) |
| Netlify build limits | Low | Low | Static site, minimal build compute |

---

## 9. Success Metrics

- localbolt.site uptime 99.9%
- Signal server latency <100ms p95
- First meaningful paint <2 seconds
- Lighthouse performance score 90+
- Test coverage 80%+
- Zero critical security vulnerabilities (Observatory A+ maintained)
- Organic search traffic growth month-over-month
