# LocalBolt v3 — Roadmap

**Date:** 2026-02-20

---

## Stability Work

### S1. Test suite
- Add Vitest to packages/localbolt-web
- Test WebRTCService: encryption, decryption, key exchange, nonce handling
- Test DualSignaling: merge logic, server failover, peer deduplication
- Test signaling protocol: Rust message serialization (expand cargo test)
- Target 80% coverage
- **Priority:** Highest — blocks all refactoring

### S2. TypeScript strict mode
- Enable noImplicitAny
- Enable strictNullChecks
- Fix type errors incrementally
- **Depends on:** S1 (tests validate no regressions)

### S3. SDK migration
- Replace inline TweetNaCl with @the9ines/bolt-core
- Validate with conformance test vectors
- **Depends on:** bolt-core-sdk npm publish, S1 (tests)

### S4. Tauri scaffold resolution
- Decision: complete apps/tauri or remove in favor of localbolt-app
- If keep: update to match current localbolt-app architecture
- If remove: delete apps/ directory, update package.json scripts
- **Depends on:** Ecosystem decision (ECOSYSTEM_PRD)

---

## Infrastructure Work

### I1. Signal server CI
- Add dedicated CI for packages/localbolt-signal
- cargo fmt, clippy, test, build independently
- Deploy to Fly.io on tag push

### I2. Monitoring
- Signal server health endpoint
- Uptime monitoring for localbolt.app and localbolt-signal.fly.dev
- Alert on downtime

### I3. Performance baseline
- Lighthouse CI integration
- Track performance score, FCP, LCP across releases
- Fail CI if score drops below 90

---

## Feature Work

### F1. PWA support
- Service worker for offline caching
- Web app manifest with install prompt
- Offline fallback page (local signaling only)

### F2. Compression
- Optional gzip before encryption
- Capability negotiation via HELLO message
- Skip for pre-compressed formats

### F3. Adaptive chunks
- Detect connection quality (RTT, loss)
- Adjust chunk size dynamically (8KB-32KB range)
- Track throughput and optimize

---

## Execution Order

```
S1 (tests) ──► S2 (TS strict) ──► S3 (SDK migration) ──► F2 (compression)
                                       │                       │
                                       ▼                       ▼
                                  S4 (Tauri decision)     F3 (adaptive chunks)

I1 (signal CI) ──► I2 (monitoring)
                       │
                       ▼
                  I3 (perf baseline) ──► F1 (PWA)
```

---

## Critical Path

S1 → S2 → S3 → F2

Test suite is the highest priority.
Everything else is blocked by tests.
SDK migration is blocked by bolt-core-sdk publish.

---

## Parallel Tracks

Track A (stability): S1 → S2 → S3
Track B (infra): I1 → I2 → I3
Track C (features): F1 → F2 → F3

Track B can run in parallel with Track A.
Track C starts after S3 completes.
