# LocalBolt v3 — Product Requirements Document

**Version:** 1.0.0
**Date:** 2026-02-20

---

## 1. Current State Summary

**Version:** v3.0.104-netlify-logo lineage (production web, live at localbolt.app)
**Stack:** Vanilla TypeScript, Tailwind CSS, Vite static shell generation, TweetNaCl/Bolt packages, Netlify + Fly.io rendezvous
**Test coverage:** Automated Vitest + Rust signal compatibility tests
**Deployment:** Netlify (web), Fly.io canonical rendezvous endpoint at wss://bolt-rendezvous.fly.dev for same-network discovery

### Implemented and Working

- Full encrypted file transfer (NaCl box, per-chunk nonce, 16KB chunks, WebRTC)
- LAN-only discovery using hosted or local rendezvous signaling
- IP-based peer discovery with CGNAT/Tailscale support
- Security hardening (CSP, XSS prevention, peer validation, ICE relay blocking, SAS verification)
- Netlify deployment with Observatory A+ security headers (HSTS, COOP, Permissions-Policy)
- Comprehensive SEO (structured data, Open Graph, FAQ schema)
- Static HTML shell generated at build time for first paint and crawlability
- CI/CD (GitHub Actions: fmt, clippy, tests, build; registry guards; Dependabot)
- Documentation (README, PRD, ROADMAP, CHANGELOG, public package docs)
- Consent-based analytics (Google Analytics with denied-by-default storage)
- Monorepo: packages/localbolt-web, browser/core packages, and signal compatibility wrapper

### Partially Implemented

- Transfer retry: exists but untested

### Missing

- TypeScript strict mode (noImplicitAny, strictNullChecks disabled)
- File resume on interrupted transfer
- Directory transfer
- Compression

### Unstable

- Nothing currently unstable. Web deployment is stable and live.

### Legacy Debt

- Early native scaffold removed; native/mobile shells live in localbolt-app
- Some SEO sections (how-it-works, features, FAQ) serve marketing purposes rather than app functionality

### Production-Ready

- Web frontend (localbolt.app)
- Hosted rendezvous endpoint (bolt-rendezvous.fly.dev) for same-network discovery
- Deployment pipeline (Netlify + Fly.io)
- Security posture (A+ Observatory, CSP, hardened headers)

---

## 2. Target State (12-Month Horizon)

LocalBolt v3 is the flagship hosted web experience:

1. Consumes bolt-core-sdk instead of inline TweetNaCl
2. Comprehensive test suite (crypto, signaling, transfer)
3. TypeScript strict mode enabled
4. Keep native/mobile ownership in localbolt-app and keep v3 web-only
5. Performance optimization (compression, adaptive chunk sizes)
6. PWA support (installable, offline-capable via service worker)

---

## 3. Gap Analysis

| Capability | Current | Target | Gap |
|-----------|---------|--------|-----|
| Encryption source | Inline TweetNaCl | bolt-core-sdk | SDK not yet published |
| Test coverage | Enforced baseline | Raise over time | Coverage lift needed |
| TypeScript strict | Disabled | Enabled | Incremental migration |
| Native scaffold | Removed | Native shells live in localbolt-app | None |
| PWA | No | Yes | Service worker + manifest |
| Compression | No | Optional | Feature implementation |

---

## 4. Non-Goals

1. **Not self-hosted.** Self-hosted is localbolt. This is the hosted version.
2. **Not a native app.** Native/mobile shells are localbolt-app.
3. **No accounts.** Zero-knowledge design.
4. **No server-side file storage.** Files are always peer-to-peer.
5. **No relay support.** Local discovery + hosted same-network signaling only. Global relay is ByteBolt.
6. **No paid features.** This is a free, open-source product.

---

## 5. Technical Constraints

- Must deploy as a static site on Netlify. Server-rendered HTML may be generated at build time, but LocalBolt v3 must not require a runtime SSR server.
- Signal server must deploy on Fly.io (or compatible platform) without expanding LocalBolt beyond LAN-only discovery
- Frontend must remain vanilla TypeScript (no React/Vue/Svelte)
- Must maintain Observatory A+ security rating
- Must maintain structured data for SEO (JSON-LD)
- Signal server endpoint: wss://bolt-rendezvous.fly.dev (canonical hosted URL; LocalBolt remains LAN-only)
- Private repository (not publicly visible on GitHub)

---

## 6. Dependency Requirements

| Dependency | Status | Required For |
|-----------|--------|-------------|
| bolt-core-sdk / browser packages | Published / workspace | Browser crypto and transport |
| bolt-rendezvous | Hosted endpoint | Signal server |
| bolt-daemon | Not applicable | — |
| bytebolt-relay | Not applicable | — |

---

## 7. Release Milestones

| Milestone | Tag | Description |
|-----------|-----|-------------|
| Test suite | v3.1.0-tests | Maintain and expand Vitest/Rust coverage |
| TS strict mode | v3.1.1-strict | Enable noImplicitAny and strictNullChecks |
| SDK migration | v3.2.0-sdk | Replace inline TweetNaCl with bolt-core-sdk |
| Native scaffold cleanup | v3.2.1-native-cleanup | Removed from v3; native shells live in localbolt-app |
| PWA support | v3.3.0-pwa | Service worker, offline manifest, install prompt |
| Compression | v3.3.1-compression | Optional gzip before encryption |

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|:---:|:---:|-----------|
| No tests → regression on refactor | High | High | Prioritize test suite (milestone 1) |
| SDK migration breaks crypto | Low | Critical | Conformance vectors validate equivalence |
| Native/web ownership confuses contributors | Medium | Low | Keep v3 web-only; native shells live in localbolt-app |
| Fly.io pricing changes | Low | Medium | Signal server can deploy anywhere (Docker) |
| Netlify build limits | Low | Low | Static site, minimal build compute |

---

## 9. Success Metrics

- localbolt.app uptime 99.9%
- Signal server latency <100ms p95
- First meaningful paint <2 seconds
- Lighthouse performance score 90+
- Test coverage 80%+
- Zero critical security vulnerabilities (Observatory A+ maintained)
- Organic search traffic growth month-over-month
