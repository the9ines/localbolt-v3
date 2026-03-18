# Burn-In Checklist — Browser Rust/WASM Protocol Authority

**Stream:** RUSTIFY-BROWSER-ROLLOUT-1
**Target:** localbolt-v3 (first-stage consumer per PM-BR-02)
**Created:** 2026-03-18 (BR4)

---

## How to Use

Run pre-deploy checks before every production deploy. Run post-deploy checks after Netlify deploy completes. Run forced fallback validation at least once before declaring burn-in complete.

Evidence: capture console output or screenshots for each check. Results feed BR6 disposition.

---

## Pre-Deploy Checks

Run these from the repo root before pushing to production.

| # | Check | Command | Pass Criteria |
|---|-------|---------|---------------|
| 1 | bolt-core tests | `cd bolt-core-sdk/ts/bolt-core && npm test` | 232/232 pass |
| 2 | transport-web tests | `cd bolt-core-sdk/ts/bolt-transport-web && npm test` | 375/375 pass |
| 3 | localbolt-v3 tests | `cd localbolt-v3 && npm test` | 141/143 (2 pre-existing DOM env failures OK) |
| 4 | localbolt-v3 build | `npm run build --workspace=packages/localbolt-web` | Vite build succeeds |
| 5 | WASM artifact in build | `ls packages/localbolt-web/dist/assets/bolt_protocol_wasm*` | `.wasm` file + `.js` glue both present |
| 6 | WASM size gate | `cd bolt-core-sdk && ./scripts/build-wasm-protocol.sh --gate` | `[SIZE_GATE] PASS` (≤300 KiB gzipped) |

---

## Post-Deploy Checks

Run these in a browser after Netlify deploy.

| # | Check | Method | Pass Criteria |
|---|-------|--------|---------------|
| 7 | WASM loads | Open browser DevTools Console on deployed site | `[BOLT-WASM] Protocol WASM loaded and initialized` visible |
| 8 | Authority mode | Look for summary line in console | `[BOLT-WASM] Authority mode: wasm` |
| 9 | Peer discovery | Open site on two devices on same network | Both devices see each other in device list |
| 10 | Small file transfer | Send a ~100 KiB file between two peers | Transfer completes, received file opens correctly |
| 11 | Medium file transfer | Send a ~5 MiB file | Transfer completes with progress indication, file intact |
| 12 | BTR active | Check console during transfer | `[BTR_INIT] WASM-backed BTR adapter (Rust authority)` visible |
| 13 | Cancel mid-transfer | Start a large file transfer, cancel from sender side | Transfer cancelled cleanly, no hang or error |
| 14 | Disconnect/reconnect | Complete a transfer, disconnect one peer, reconnect | Session resets cleanly, new transfer possible |

---

## Forced Fallback Validation

Run once to verify the TS fallback path still works independently.

| # | Check | Method | Pass Criteria |
|---|-------|--------|---------------|
| 15 | Disable WASM init | Temporarily comment out `initProtocolWasm()` in `main.ts`, rebuild, deploy | App loads normally |
| 16 | Authority mode (fallback) | Check console | `[BOLT-WASM] Authority mode: not-initialized` (if init removed) or `ts-fallback` (if init fails) |
| 17 | Transfer with TS fallback | Send a file without WASM active | Transfer completes normally (tweetnacl path) |
| 18 | BTR with TS fallback | Check console during transfer | `[BTR_INIT] TS BTR adapter (fallback)` visible |
| 19 | Restore WASM init | Undo the comment, rebuild, verify WASM resumes | `Authority mode: wasm` returns |

---

## Observable Signals Reference

| Signal | Where | Meaning |
|--------|-------|---------|
| `[BOLT-WASM] Protocol WASM loaded and initialized` | Console (init) | WASM binary loaded and crypto adapter registered |
| `[BOLT-WASM] Authority mode: wasm` | Console (init) | Production authority is Rust/WASM |
| `[BOLT-WASM] Authority mode: ts-fallback` | Console (init) | WASM failed, TS tweetnacl is authority |
| `[BOLT-WASM] Protocol WASM load failed: <reason>` | Console (init) | Why WASM didn't load |
| `[BTR_INIT] WASM-backed BTR adapter (Rust authority)` | Console (per session) | BTR crypto uses Rust |
| `[BTR_INIT] TS BTR adapter (fallback)` | Console (per session) | BTR crypto uses TS tweetnacl |
| `getProtocolAuthorityMode()` | JS API (queryable) | Returns `'wasm'` / `'ts-fallback'` / `'not-initialized'` |

---

## Burn-In Disposition Criteria (for BR6)

| Outcome | Criteria |
|---------|---------|
| **PASS** | All pre-deploy checks green. Post-deploy checks 7–14 all pass. WASM authority confirmed active. At least one successful medium file transfer with BTR WASM. |
| **CONDITIONAL PASS** | All checks pass except minor cosmetic or non-protocol issues. Fallback validation confirms TS path works. |
| **FAIL** | WASM doesn't load in production browser. Transfer fails on WASM path but works on fallback. BTR adapter falls back to TS unexpectedly. |
