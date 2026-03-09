# LocalBolt v3 Changelog

## v3.0.87-domain-rename — Rename localbolt.site to localbolt.app (2026-03-08, 69ec25c)
- **Domain rename**: Update all `localbolt.site` references to `localbolt.app` across source, SEO files, and docs.
- Files changed:
  - `packages/localbolt-web/index.html`
  - `packages/localbolt-web/src/sections/how-it-works.ts`
  - `packages/localbolt-web/src/sections/faq.ts`
  - `packages/localbolt-web/public/robots.txt`
  - `packages/localbolt-web/public/sitemap.xml`
  - `README.md`
  - `ROADMAP.md`
  - `PRD.md`

## v3.0.86-csp-wasm — Allow WASM compilation in CSP for policy adapter (2026-03-08, 98610d3)
- **CSP update**: Add `wasm-unsafe-eval` and `https://www.googletagmanager.com` to `script-src` directive in Content-Security-Policy meta tag. Required for WASM compilation by policy adapter and Google Tag Manager script loading.
- Files changed:
  - `packages/localbolt-web/index.html`

## v3.0.80-c-stream-r1-ui-state-fix — C-STREAM-R1: UI/state regression recovery (2026-03-06, 9f3546e)
- **State/session hardening (P2)**: Generation guards on `handleConnectionStateChange`, `handleReceiveProgress`, `handleVerificationState` reject stale callbacks from previous sessions. Terminal-state-only reset prevents premature disconnect on intermediate WebRTC states. Transfer terminal flag prevents late progress after cancel. Idempotent `disconnect()`.
- **Trust UI consistency (P3)**: `snapshot()` returns live verification state from bus (was hardcoded 'legacy'). Full transfer gating truth table enforced in tests.
- **Tests**: +15 new tests (4 core snapshot, 8 truth table, 2 stale verification guard, 1 snapshot live state). Baseline: core 50→54, web 59→70. Total: 107→122 (pre-existing failures: 2 unchanged).
- Files changed:
  - `packages/localbolt-core/src/session-state.ts`
  - `packages/localbolt-core/src/__tests__/session-hardening.test.ts`
  - `packages/localbolt-web/src/components/peer-connection.ts`
  - `packages/localbolt-web/src/__tests__/session-hardening.test.ts`

## v3.0.79-s-stream-r1-r1.4-security-test-lift — R1-4: security-focused reconnect integrity tests (2026-03-06, 31046ac)
- **R1-4 security test lift**: 7 new tests covering crypto-path integrity around reconnect boundary and trust/verification state isolation between consecutive sessions.
- Crypto-path integrity tests: generation guard + verification reset + transfer policy consistency at reconnect boundary, stale verification callback rejection, mismatch path termination.
- Trust isolation tests: verified session A to session B starts at legacy, SAS code independence between peers, same-peer reconnect requires re-verification, three consecutive peers with no trust leakage.
- Baseline core tests: 43 to 50. Web 59 unchanged. Total: 109.
- Files changed:
  - `packages/localbolt-core/src/__tests__/security-reconnect-integrity.test.ts` (new, 199 lines)

## v3.0.78-d5-registry-guards — D5: registry/auth regression guards (2026-03-06, fec153b)
- **D5 guards**: Two new CI guard scripts prevent registry/auth regressions.
- `check-registry-mapping.sh`: ensures `.npmrc` maps `@the9ines` to `registry.npmjs.org`, rejects GitHub Packages refs and PAT dependencies.
- `check-lockfile-registry.sh`: ensures `package-lock.json` resolves `@the9ines` packages from `registry.npmjs.org`.
- CI cleanup: removed `registry-url`/`scope` from `setup-node`, removed `NODE_AUTH_TOKEN` from `npm ci`, removed `packages:read` permission.
- Files changed:
  - `scripts/check-registry-mapping.sh` (new)
  - `scripts/check-lockfile-registry.sh` (new)
  - `.github/workflows/ci.yml`

## v3.0.77-d4-netlify-build-fix — D4: fix Netlify build for workspace symlink (2026-03-06, 0746275)
- **Build fix**: Build `localbolt-core` before `localbolt-web` in `netlify.toml` so the workspace symlink `dist/` exists on clean clone.
- Removed `base` directive to avoid monorepo path conflict with `publish`.
- `publish` path updated to `packages/localbolt-web/dist` (absolute from repo root).
- Deploy verified at localbolt.app.
- Files changed:
  - `netlify.toml`

## v3.0.76-d4-npmjs-cutover — D4: switch consumer resolution to npmjs.org (2026-03-05, ef0543e)
- **D4 cutover**: Switch `@the9ines` scope from GitHub Packages to npmjs.org registry.
- PAT no longer required for public package installs.
- `.npmrc` (root + localbolt-web): `@the9ines:registry` → `registry.npmjs.org`, PAT token line removed.
- Dependencies updated: bolt-core 0.5.1, transport-web 0.6.4, localbolt-core 0.1.2.
- `package-lock.json` regenerated — all `@the9ines` resolved from `registry.npmjs.org`.
- 102 tests pass, build succeeds.
- Files changed:
  - `.npmrc`
  - `package-lock.json`
  - `packages/localbolt-web/.npmrc`
  - `packages/localbolt-web/package.json`

## v3.0.75-d3-registry-migration — D3: migrate localbolt-core to npmjs.org (2026-03-05, 92adc37)
- **D3**: Publish `localbolt-core` to npmjs.org for PAT-free installs.
- Version 0.1.0 → 0.1.2 (0.1.0/0.1.1 locked on npmjs).
- `publishConfig` changed from GH Packages registry to `access: public`.
- `bolt-transport-web` dependency relaxed from exact `0.6.2` to `>=0.6.2`.
- New `publish-localbolt-core-npmjs.yml` workflow (workflow_dispatch).
- Files changed:
  - `.github/workflows/publish-localbolt-core-npmjs.yml` (new)
  - `packages/localbolt-core/package.json`

## v3.0.74-c7-closure — C7 closure: rapid cycling + late verification tests (2026-03-05, b867426)
- **C7 closure**: Add 2 targeted tests to `@the9ines/localbolt-core` filling remaining C7 evidence gaps.
  - Rapid 5+ connect/reset cycles (7 iterations): generation monotonicity, state cleanliness, stale generation rejection.
  - Late verification callback from previous peer: generation guard prevents wrong-SAS display after session switch.
- Test count: 43 in localbolt-core (41 → 43, +2). No runtime changes.
- Files changed:
  - `packages/localbolt-core/src/__tests__/session-hardening.test.ts`

## v3.0.73-c6-hardening — Add localbolt-core drift guard to CI (2026-03-05, 2a4d098)
- **C6 hardening**: Add `check-core-drift.sh` to detect ad-hoc orchestration reimplementation in `packages/localbolt-web/src`. CI wired with explicit `SRC_DIR`.
- Consumer-style guards (version-pin, single-install) not applicable — localbolt-v3 is the origin workspace. Workspace exemption documented.
- Files changed:
  - `scripts/check-core-drift.sh` (new)
  - `.github/workflows/ci.yml` (core drift guard step)

## v3.0.72-localbolt-core-publish — Publish @the9ines/localbolt-core 0.1.0 (2026-03-05, 7cb8d8d)
- **Batch 3 P1**: Publish `@the9ines/localbolt-core@0.1.0` to GitHub Packages (`npm.pkg.github.com`).
- Removed `"private": true`, added `"files"`, `"publishConfig"`, and `"exports"` to `packages/localbolt-core/package.json`.
- Pinned `localbolt-web` dependency from `"*"` to `"0.1.0"`.
- Files changed:
  - `packages/localbolt-core/package.json`
  - `packages/localbolt-web/package.json`
  - `package-lock.json`

## v3.0.71-localbolt-core-c2 — Extract @the9ines/localbolt-core package (2026-03-04, aa9e40e)
- **C-2**: New workspace package `@the9ines/localbolt-core` (v0.1.0) at `packages/localbolt-core`. Extracts shared app-layer orchestration out of `localbolt-web` into a standalone package that any shell (web, Tauri, etc.) can depend on.
- **Moved to core**: `session-state.ts` (session phase machine + generation counter), `verification-state.ts` (verification state pub/sub bus), and new `transfer-policy.ts` (pure `isTransferAllowed` function encoding which verification states permit file transfer).
- **localbolt-web now depends on `@the9ines/localbolt-core`**: all imports of session-state, verification-state, and transfer policy updated from local `@/services/*` paths to `@the9ines/localbolt-core`. Inline transfer gating logic in `transfer.ts` replaced with `isTransferAllowed()` call.
- **Barrel export** (`index.ts`): re-exports all session orchestration, verification bus, and transfer policy APIs.
- **Tests**: 41 tests in core (session-hardening + transfer-policy), 59 in web, 100 total.
- Files changed:
  - `packages/localbolt-core/package.json` (new)
  - `packages/localbolt-core/tsconfig.json` (new)
  - `packages/localbolt-core/vitest.config.ts` (new)
  - `packages/localbolt-core/README.md` (new)
  - `packages/localbolt-core/src/index.ts` (new — barrel export)
  - `packages/localbolt-core/src/session-state.ts` (moved from `localbolt-web/src/services/`)
  - `packages/localbolt-core/src/verification-state.ts` (moved from `localbolt-web/src/services/`)
  - `packages/localbolt-core/src/transfer-policy.ts` (new — `isTransferAllowed` pure function)
  - `packages/localbolt-core/src/__tests__/session-hardening.test.ts` (new — 33 tests)
  - `packages/localbolt-core/src/__tests__/transfer-policy.test.ts` (new — 8 tests)
  - `packages/localbolt-web/package.json` (added `@the9ines/localbolt-core` dependency)
  - `packages/localbolt-web/src/__tests__/h5-tofu-verification.test.ts` (import path updated)
  - `packages/localbolt-web/src/__tests__/session-hardening.test.ts` (import path updated)
  - `packages/localbolt-web/src/components/peer-connection.ts` (import path updated)
  - `packages/localbolt-web/src/sections/transfer.ts` (import path updated, inline policy replaced with `isTransferAllowed`)
  - `package-lock.json`

## v3.0.70-session-hardening-cpre2 — Session orchestration layer and race hardening (2026-03-04, cac5e4a)
- **C-pre-1 + C-pre-2**: New session orchestration layer (`session-state.ts`) with a phase machine (`IDLE` / `CONNECTING` / `CONNECTED` / `DISCONNECTING`) and monotonic generation counter. Provides a canonical reset path for disconnect, error, and cancel flows, replacing scattered ad-hoc cleanup.
- Transfer gating policy aligned with verification states: `unverified` blocks file upload; `verified` and `legacy` allow transfer.
- Race hardening via generation guards on async callbacks: stale async completions (e.g., WebRTC callbacks arriving after disconnect) are silently dropped when the generation has advanced, preventing ghost-state corruption.
- **Tests**: 33 new tests in `session-hardening.test.ts` (59 total, up from 26). Coverage: 58.22% lines (up from 54.26%).
- Files changed:
  - `packages/localbolt-web/src/services/session-state.ts` (new)
  - `packages/localbolt-web/src/__tests__/session-hardening.test.ts` (new)
  - `packages/localbolt-web/src/components/peer-connection.ts`
  - `packages/localbolt-web/src/sections/transfer.ts`

## v3.0.69-dp9-backpressure-fix — Fix bidirectional transfer: backpressure hang (2026-03-04, 48617f0)
- **DP-9**: Bump `@the9ines/bolt-transport-web` from 0.6.1 to 0.6.2. Fixes responder's `sendFile` hanging indefinitely due to backpressure mechanism with `bufferedAmountLowThreshold` defaulting to 0. SDK fix: (1) sets threshold to 64KB in `setupDataChannel()`, (2) adds 5s timeout fallback to backpressure await, (3) adds `sendInProgress` guard against concurrent `sendFile` calls. Diagnostic logging from DP-9 investigation removed from source (was never committed).
- Files changed:
  - `packages/localbolt-web/package.json`
  - `package-lock.json`

## v3.0.68-dp8-netlify-npmrc — Fix Netlify deployment: add .npmrc with GitHub Packages auth (2026-03-04, b1a2cd4)
- **DP-8**: Add `.npmrc` files with GitHub Packages auth token references (`${NPM_TOKEN}`) so Netlify can install `@the9ines/*` scoped packages from the GitHub Packages registry. Production site was stale (serving pre-DP-6 code) because `npm install` failed silently without the auth config.
- Root `.npmrc`: added `//npm.pkg.github.com/:_authToken=${NPM_TOKEN}` line (registry scope already present)
- `packages/localbolt-web/.npmrc`: new file with both registry scope and auth token lines (Netlify builds from this workspace directory)
- Files changed:
  - `.npmrc`
  - `packages/localbolt-web/.npmrc` (new)

## v3.0.67-dp7-bolt-core-050 — Bump bolt-core to 0.5.0 (DP-7 fix) (2026-03-03, 6bb21b3)
- **DP-7**: Bump `@the9ines/bolt-core` from 0.4.0 to 0.5.0. Fixes build failure caused by missing `isValidWireErrorCode` export (wire error code registry added in SA2/AC-8 but never published). Unblocks Netlify deploy and WebRTC connections.
- Files changed:
  - `packages/localbolt-web/package.json`
  - `package-lock.json`

## v3.0.66-dp6-transport-web-bump — Bump bolt-transport-web to 0.6.1 (DP-6 fix) (2026-03-03, 8f98716)
- **DP-6**: Bump `@the9ines/bolt-transport-web` from 0.6.0 to 0.6.1. Fixes responder send button permanently disabled after receiving a file.
- Files changed:
  - `packages/localbolt-web/package.json`
  - `package-lock.json`

## v3.0.65-dp3b-dp4-phantom-transfer — DP-3b + DP-4: Phantom device fix and transfer gate removal (2026-03-03, 08382f1)
- **DP-3b**: Persist peer code in `sessionStorage` so page refreshes reuse the same code. Previously, each refresh generated a new peer code; if the old WebSocket had not been cleaned up on the server yet, the stale code appeared as a phantom device entry. Now the code is stored under `bolt_peer_code` in sessionStorage and only regenerated when no existing code is found.
- **DP-4**: Remove verification-based gate on file upload. All three TOFU states (verified, unverified, legacy) have working end-to-end encryption. The SAS verification step is an optional MITM confirmation, not a prerequisite for secure transfer. The file upload visibility now depends only on `isConnected`, removing the previous requirement for `verified` or `legacy` verification state.
- Files changed:
  - `packages/localbolt-web/src/components/peer-connection.ts` (sessionStorage peer code persistence)
  - `packages/localbolt-web/src/sections/transfer.ts` (removed verification state gate from file upload visibility)

## v3.0.64-ac4-coverage-enforced — AC-4: CI coverage enforcement (2026-03-02, a5d0237)
- CI now enforces coverage thresholds via `vitest run --coverage` (previously ran tests without `--coverage` flag, so thresholds were not checked in CI)
- Added jsdom polyfill for `HTMLDialogElement.showModal()` to fix v8 instrumentation exit code: under v8 coverage instrumentation, deferred `requestAnimationFrame` callbacks fire and call `showModal()` on jsdom (which does not implement it), producing an uncaught TypeError that exits vitest non-zero even though all tests and thresholds pass
- Added `setupFiles` entry in vite.config.ts to load the new polyfill setup file
- Closes AC-4
- Files changed:
  - `.github/workflows/ci.yml` (`--coverage` flag added to test step)
  - `packages/localbolt-web/vite.config.ts` (setupFiles added)
  - `packages/localbolt-web/src/__tests__/setup.ts` (new: jsdom polyfill for HTMLDialogElement.showModal/close)

## v3.0.63-s0-canonical-rendezvous — S0 canonical rendezvous integration (2026-02-26, 2963539)
- **S0**: Replaced localbolt-signal local implementation with canonical `bolt-rendezvous` wrapper
- Removed `protocol.rs`, `server.rs`, `room.rs` — all signaling logic now delegated to the `bolt-rendezvous` crate (git dep, tag `rendezvous-v0.2.2-s0-canonical-lib-verified`)
- `lib.rs` rewritten as a thin wrapper: configures `bolt-rendezvous` server with LocalBolt-specific IP-based room grouping, private IP detection, CGNAT/Tailscale support, peer code validation, and keepalive
- Crate version bumped to 0.1.1; direct dependencies reduced (dashmap, futures-util, serde, tokio-tungstenite, tracing, uuid removed — now transitive via bolt-rendezvous)
- Wire-format parity preserved — existing clients connect without changes
- LAN-only compatible — no cloud-only requirements introduced
- Dockerfile updated: installs `git` for cargo git dependency resolution; strips `[dev-dependencies]` (path deps unavailable in Docker build context)
- 36 tests pass (up from 32): cargo test suite validates room logic, IP grouping, peer code validation, keepalive, and bolt-core parity
- Files changed:
  - `packages/localbolt-signal/Cargo.toml` (bolt-rendezvous dep, version bump, deps reduced)
  - `packages/localbolt-signal/Cargo.lock` (bolt-rendezvous + bolt-rendezvous-protocol added)
  - `packages/localbolt-signal/src/lib.rs` (rewritten as canonical wrapper)
  - `packages/localbolt-signal/src/protocol.rs` (REMOVED)
  - `packages/localbolt-signal/src/server.rs` (REMOVED)
  - `packages/localbolt-signal/src/room.rs` (REMOVED)
  - `packages/localbolt-signal/Dockerfile` (git install + dev-dep stripping)

## v3.0.62-h1-mainline-merge — Merge H1 signal hardening into main (2026-02-25, 7571d35)
- **Mainline convergence**: Merged `feature/h1-signal-hardening` into main via `--no-ff`
- H1 signal server trust-boundary hardening (v3.0.59-signal-hardening, ac5110c) now on main
- Conflicts resolved in docs only (CHANGELOG.md, STATE.md) — preserved H5v3 + H6 entries alongside H1
- All gates pass: npm test (26/26), npm build, typecheck, cargo fmt/clippy/test (31+1), cargo build --release
- Files changed:
  - `docs/CHANGELOG.md` (conflict resolution + this entry)
  - `docs/STATE.md` (conflict resolution + version bump)

## v3.0.61-h5v3-tofu-sas-pinning — H5-v3: TOFU/SAS wiring + identity/pin store (2026-02-25)
- **H5-v3**: Wire SDK-provided identity, pinning, and SAS verification into localbolt-v3
- **Identity persistence**: Local X25519 identity keypair persisted in IndexedDB via `IndexedDBIdentityStore` + `getOrCreateIdentity` (SDK). Survives page reloads. Shared-device risk documented (IndexedDB not encrypted-at-rest).
- **Pin store**: `IndexedDBPinStore` (SDK) stores TOFU peer identity pins with verified/unverified status.
- **WebRTCService integration**: `peer-connection.ts` now passes `identityPublicKey`, `pinStore`, and `onVerificationState` callback to WebRTCService constructor. Identity loaded in parallel with signaling connect.
- **Verification UX states**:
  - `verified`: green badge, file transfer allowed
  - `unverified`: SAS code shown + "Mark Verified" / "Reject" buttons, file transfer blocked until user verifies
  - `legacy`: gray "Legacy Peer" badge, file transfer allowed with visible unverified warning
  - `mismatch`: fail-closed — automatic disconnect + "Security Alert: Identity Mismatch" error toast
- **Transfer gating**: File upload visibility now requires `isConnected` AND (`verified` OR `legacy`). Unverified peers cannot send/receive files.
- **Verification state bus**: New `services/verification-state.ts` — lightweight pub/sub that decouples verification state from SDK store. Components subscribe independently.
- **Key mismatch detection**: `handleConnectionError` detects TOFU violation errors and shows targeted security alert instead of generic "Connection Failed".
- **Disconnect cleanup**: `resetVerificationState()` called on disconnect and connection state changes to non-connected.
- **LAN-only support preserved**: No cloud-only requirements added. Works with `VITE_LOCAL_SIGNAL_URL` only.
- **Tests**: 22 new deterministic tests in `h5-tofu-verification.test.ts` covering: identity persistence stability, verification state bus transitions, transfer gating (unverified blocks, verified allows, legacy allows), accept/reject flows, pin mismatch fail-closed, legacy peer handling. All mocked (no real WebRTC/IndexedDB).
- **Coverage**: 51/9/40/53% (exceeds thresholds 45/5/31/48%). New services at 100% coverage.
- Files changed:
  - `packages/localbolt-web/src/services/identity.ts` (NEW)
  - `packages/localbolt-web/src/services/verification-state.ts` (NEW)
  - `packages/localbolt-web/src/components/peer-connection.ts` (MODIFIED)
  - `packages/localbolt-web/src/sections/transfer.ts` (MODIFIED)
  - `packages/localbolt-web/src/__tests__/h5-tofu-verification.test.ts` (NEW)
  - `packages/localbolt-web/src/__tests__/app.test.ts` (MODIFIED — mock updated)
  - `docs/STATE.md` (MODIFIED)
  - `docs/CHANGELOG.md` (this entry)

## v3.0.60-h6-ci-enforcement — H6 CI enforcement audit (2026-02-25)
- **H6**: CI enforcement audit — all gates verified present and correct
- Existing CI already enforces: Rust fmt, clippy -D warnings, cargo test, cargo build --release, TS transport guards, npm test, npm build, coverage thresholds (statements:45, branches:5, functions:31, lines:48)
- No code changes required — audit-only tag confirming enforcement posture
- Files changed:
  - `docs/CHANGELOG.md` (this entry)
  - `docs/STATE.md` (updated version)


## v3.0.59-signal-hardening — H1 Signal server trust-boundary hardening (2026-02-25, ac5110c)
- **H1**: Port trust-boundary hardening from bolt-rendezvous into localbolt-v3 signal server
- Hardens the Rust WebSocket signaling server with bolt-rendezvous-grade trust boundary enforcement
- Files changed:
  - `packages/localbolt-signal/Cargo.toml`
  - `packages/localbolt-signal/src/server.rs` (+449/-26 lines)
- **Tag:** `v3.0.59-signal-hardening`
- **Branch:** `feature/h1-signal-hardening` (not yet merged to main)

## v3.0.58-sig-3-url-hygiene — Remove hardcoded cloud signaling fallback (2026-02-24, c3d058e)
- **SIG-3**: Remove hardcoded `wss://localbolt-signal.fly.dev` fallback from `peer-connection.ts`
- Cloud signaling URL (`VITE_SIGNAL_URL`) now required via explicit configuration
- If unset, cloud signaling is disabled with console warning — local-only mode
- Local signaling fallback (`ws://<hostname>:3001`) preserved unchanged
- DualSignaling handles missing cloud URL gracefully via `Promise.allSettled`
- Production `.env` already sets `VITE_SIGNAL_URL` — deployed behavior unchanged
- Updated `.env.example` to document new behavior
- Files changed:
  - `packages/localbolt-web/src/components/peer-connection.ts`
  - `packages/localbolt-web/.env.example`

## v3.0.57-signal-parity-gate — Bolt-core parity gate for signal peer code validation (2026-02-24, 59db709)
- **Merge**: bolt-core parity gate for signal peer code validation (native-3b)
- **Dev dependency**: Added `bolt-core` (0.4.0, path reference) as a dev-only dependency to `packages/localbolt-signal` for test-time peer code validation cross-checking
- **3 parity tests**: Codify intentional divergence between server validation (broad: ASCII alphanumeric, 1..16 chars) and bolt-core strict rules (31-char unambiguous alphabet, length 6 or 8 only)
  - `server_accepts_codes_bolt_core_rejects` — ambiguous chars, length 16, lowercase all accepted by server but rejected by bolt-core
  - `canonical_codes_accepted_by_both` — 6-char and 8-char codes from the canonical alphabet pass both validators
  - `both_reject_empty` — empty string rejected by both
- **No runtime behavior change**: bolt-core is dev-only; server validation rules unchanged
- Files changed:
  - `packages/localbolt-signal/Cargo.toml`
  - `packages/localbolt-signal/Cargo.lock`
  - `packages/localbolt-signal/src/server.rs`

## v3.0.57-bolt-core-bump — Bump bolt-core to 0.4.0 (A1 adoption) (2026-02-24, 14927d7)
- **Dependency bump**: Updated `@the9ines/bolt-core` from `0.3.0` to `0.4.0` in `packages/localbolt-web/package.json`
- **No behavior changes**: Dead constant exports removed upstream; no consumer impact
- **transport-web**: Remains at `0.6.0`
- **Validation**: 4/4 tests pass, `vite build` passes
- Files changed:
  - `packages/localbolt-web/package.json`
  - `package-lock.json`

## v3.0.56-signaling-adr — ADR for signaling integration model (A3 close) (2026-02-24, 6c8b422)
- **ADR-0001**: Documents architecture decision that localbolt-v3 uses `packages/localbolt-signal` as a native workspace crate, not a git subtree from bolt-rendezvous
- **Rationale**: Workspace co-versioning, Fly.io deployment ownership, Rust crate layout divergence, product-specific features
- **Drift control**: Wire protocol changes in bolt-rendezvous must be propagated; Fly.io deployment owned by localbolt-v3; subtree repos continue pulling bolt-rendezvous canonical
- **Audit item A3**: Closed — docs-only, no code changes
- Files changed:
  - `docs/adr/ADR-0001-signaling-integration-model.md` (new)

## v3.0.55-coverage-thresholds — Enforce coverage thresholds (Q6 close) (2026-02-24, fa59742)
- **Coverage enforcement**: Added `@vitest/coverage-v8` and coverage threshold block to `vite.config.ts`
- **Thresholds**: statements 45%, branches 5%, functions 31%, lines 48% (current floor minus 2%, prevents regression)
- **Audit item Q6**: Closed — localbolt-v3 now has coverage enforcement matching localbolt policy
- 4/4 tests pass, coverage above all thresholds
- Files changed:
  - `.gitignore` (added `coverage/`)
  - `packages/localbolt-web/vite.config.ts`
  - `packages/localbolt-web/package.json`
  - `package-lock.json`

## v3.0.54-sdk-upgrade — Upgrade SDK: bolt-core 0.3.0, bolt-transport-web 0.6.0 (2026-02-24, 463e963)
- **Dependency bump**: Updated `@the9ines/bolt-core` from `0.2.0` to `0.3.0` and `@the9ines/bolt-transport-web` from `0.3.0` to `0.6.0` in `packages/localbolt-web/package.json`
- **Merge**: Branch `feature/sdk-upgrade-0.3.0-0.6.0` merged to main at 463e963
- **Registry**: Both packages resolve from `npm.pkg.github.com`
- **Validation**: 4/4 tests pass, `vite build` passes, `tsc --noEmit` passes
- **No application code changes** -- only package.json and package-lock.json modified
- Files changed:
  - `packages/localbolt-web/package.json`
  - `package-lock.json`

## v3.0.53-test-pipeline — Establish test pipeline with vitest + jsdom smoke tests (2026-02-23, 8cba99f)
- **Test framework**: Added `vitest` (v4.0.0) and `jsdom` (v26.0.0) as dev dependencies to `packages/localbolt-web`
- **Vite config**: Added `test` block to `vite.config.ts` with `environment: "jsdom"` and `include: ["src/**/*.test.ts"]`
- **FAQ smoke test** (`src/sections/__tests__/faq.test.ts`): 2 tests verifying `createFAQ()` returns a `<section>` with correct aria-label, and that FAQ items render as `<details>` elements with `<summary>` and `<p>` children
- **App smoke test** (`src/__tests__/app.test.ts`): 2 tests with full mocks of `@the9ines/bolt-core` and `@the9ines/bolt-transport-web`; verifies `createApp()` renders without throwing and populates the root element
- **CI pipeline**: Added `npm test -w packages/localbolt-web` step to GitHub Actions CI workflow, running before the build step
- **Root test script**: Added `"test"` script to root `package.json` delegating to the `packages/localbolt-web` workspace
- **Package scripts**: Added `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `packages/localbolt-web/package.json`
- **Registry resolution**: All `@the9ines/*` packages now resolve from `npm.pkg.github.com` (no `file:` refs in lockfile)
- 4 tests pass: 2 FAQ + 2 app render
- Files changed:
  - `.github/workflows/ci.yml`
  - `package.json`
  - `package-lock.json`
  - `packages/localbolt-web/package.json`
  - `packages/localbolt-web/vite.config.ts`
  - `packages/localbolt-web/src/__tests__/app.test.ts` (new)
  - `packages/localbolt-web/src/sections/__tests__/faq.test.ts` (new)

## v3.0.52-sas-verification-deps — Bump bolt-transport-web to 0.3.0 (SAS verification surface) (2026-02-23, 17c6d3f)
- **Dependency bump**: Updated `@the9ines/bolt-transport-web` from `0.2.0` to `0.3.0` in `packages/localbolt-web/package.json`
- Picks up Phase 7B SAS verification surface from bolt-core-sdk
- Files changed:
  - `packages/localbolt-web/package.json`

## v3.0.51-hello-tofu-deps — Bump bolt-core to 0.2.0 and bolt-transport-web to 0.2.0 (2026-02-23, 01a0e1f)
- **Dependency bump**: Updated `@the9ines/bolt-core` from `0.0.5` to `0.2.0` and `@the9ines/bolt-transport-web` from `0.1.1` to `0.2.0` in `packages/localbolt-web/package.json`
- Picks up encrypted HELLO + TOFU (Trust On First Use) identity pinning from bolt-core-sdk Phase 7A
- Files changed:
  - `packages/localbolt-web/package.json`

## v3.0.38-faq-sync — Sync FAQ copy: expand answers and reword network question for offline emphasis (2026-02-20, 1c24c0b)
- **FAQ structured data (index.html)**: Updated three FAQ entries in the JSON-LD FAQPage schema:
  - "Is LocalBolt safer than WeTransfer or Google Drive?" — appended "Not during transfer, not after." to reinforce the zero-server-storage point
  - "Do I need to create an account?" — expanded answer with "Just open the website and start sharing. No email, no password, no personal information required."
  - Renamed "Does LocalBolt work across different networks?" to "Does LocalBolt work without internet?" with a new answer explaining the self-hosted/desktop signaling server for LAN-only operation, cloud signaling for cross-network, and simultaneous local+cloud discovery
- **FAQ section (faq.ts)**: Updated the matching FAQ entry from "Does LocalBolt work across different networks?" to "Does LocalBolt work without internet?" with the same expanded answer covering local signaling server, cloud discovery, and dual discovery behavior
- Files changed:
  - `packages/localbolt-web/index.html`
  - `packages/localbolt-web/src/sections/faq.ts`

## v3.0.37-copy-fix — Replace military-grade copy with accurate encryption description (2026-02-19, a681f13)
- **Features section copy**: Replaced the heading "Military-Grade Encryption, Zero Trust Architecture" with "End-to-End Encrypted, Zero Trust by Design" in the features section. The term "military-grade" is a marketing cliche with no technical meaning; the new copy accurately describes the encryption model (end-to-end encrypted, zero trust).
- Files changed:
  - `packages/localbolt-web/src/sections/features.ts`

## v3.0.36-remove-codeql — Remove CodeQL workflow from private repo (2026-02-19, f27d092)
- **CodeQL workflow removed**: Deleted `.github/workflows/codeql.yml` entirely. Private repos cannot use GitHub code scanning (CodeQL) without GitHub Advanced Security, which requires a paid license. Rather than carrying a broken workflow, it has been removed.
- The CI workflow (`.github/workflows/ci.yml`) and Dependabot config remain unchanged.
- Files changed:
  - `.github/workflows/codeql.yml` (deleted)

## v3.0.35-codeql-perms — Add actions: read permission to CodeQL workflow (2026-02-19, c1e9a76)
- **CodeQL workflow**: Added `actions: read` permission to the `Analyze` job in `.github/workflows/codeql.yml`, alongside the existing `contents: read` and `security-events: write` permissions, to fix a permissions error during CodeQL analysis initialization.
- One-line fix: added `actions: read` to the job-level `permissions` block.
- Note: This fix was superseded by v3.0.36 which removed the CodeQL workflow entirely (private repo cannot use code scanning without GitHub Advanced Security).
- Files changed:
  - `.github/workflows/codeql.yml`

## v3.0.34-codeql-fix — Fix CodeQL checkout failure on private repo (2026-02-19, bc1255c)
- **CodeQL workflow**: Added `contents: read` permission to the `Analyze` job in `.github/workflows/codeql.yml` so the `actions/checkout` step has read access to the repository contents, fixing checkout failures on private repos.
- One-line fix: added `contents: read` alongside existing `security-events: write` in the job-level `permissions` block.
- Files changed:
  - `.github/workflows/codeql.yml`

## v3.0.33-clippy-fix — Fix clippy useless_conversion warning in signal server (2026-02-19, 9ae4d5b)
- **Signal server (Rust)**: Removed redundant `.into()` call on a `String` value passed to `Message::Text()` in `handle_connection()` — clippy flagged this as a `useless_conversion` since the value is already the expected type.
- One-line fix: `Message::Text(json.into())` changed to `Message::Text(json)`.
- Files changed:
  - `packages/localbolt-signal/src/server.rs`

## v3.0.32-cgnat-tailscale — Add CGNAT/Tailscale IP range (100.64.0.0/10) to private IP detection (2026-02-19, 7535d55)
- **Signal server (Rust)**: Added `100.64.0.0/10` (100.64.0.0 - 100.127.255.255) to `is_private_ip()` in `server.rs` — IPv4 CGNAT / shared address space used by Tailscale, WireGuard meshes, and carrier-grade NAT. Devices on the same Tailscale/WireGuard mesh are now treated as "local" to each other and grouped into the same signaling room.
- **Web client (TypeScript)**: Added regex `/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./` to the `isPrivateIP()` function in `platform-utils.ts`, matching the same CGNAT/Tailscale/WireGuard range on the client side.
- **Effect**: Users connected via Tailscale or WireGuard mesh networks now automatically discover each other as local peers, enabling direct P2P file transfers without cloud signaling.
- Files changed:
  - `packages/localbolt-signal/src/server.rs`
  - `packages/localbolt-web/src/lib/platform-utils.ts`

## v3.0.31-security-headers — Add Netlify security headers for Observatory A+ rating; commit Cargo.lock for reproducible builds (2026-02-19, 1b42a4a)
- **Netlify security headers**: Added `[[headers]]` block in `netlify.toml` applying to all routes (`/*`) with 6 HTTP security headers for an Observatory A+ rating:
  - `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing
  - `X-Frame-Options: DENY` — blocks framing (clickjacking protection)
  - `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer info on cross-origin requests
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()` — disables unused browser APIs
  - `Cross-Origin-Opener-Policy: same-origin` — isolates browsing context from cross-origin popups
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — enforces HTTPS for 2 years with HSTS preload
- **Cargo.lock committed**: Added `packages/localbolt-signal/Cargo.lock` (1,130 lines) to version control for deterministic, reproducible Rust signal server builds
- Files changed:
  - `netlify.toml`
  - `packages/localbolt-signal/Cargo.lock` (new)

## v3.0.30-scorecard-hardening — OpenSSF Scorecard hardening: pinned GitHub Actions, SAST, Dependabot, vite/esbuild upgrade, minimatch override (2026-02-18, 234710a)
- **GitHub Actions pinned by SHA**: All workflow `uses:` entries pinned to full commit SHAs instead of mutable tags — `actions/checkout@34e1148...`, `dtolnay/rust-toolchain@631a55b...`, `Swatinem/rust-cache@779680d...`, `actions/setup-node@49933ea...`, `github/codeql-action/*@f5c2471...`
- **CI workflow** (`.github/workflows/ci.yml`, new): Runs on push/PR to main with `permissions: read-all`; two jobs — Signal Server (Rust: fmt check, clippy, test, release build) and Web App (TypeScript: npm ci, npm run build)
- **CodeQL SAST workflow** (`.github/workflows/codeql.yml`, new): Runs on push/PR to main + weekly cron schedule; analyzes `javascript-typescript` language; `permissions: read-all` with `security-events: write` for the analyze job
- **Dependabot config** (`.github/dependabot.yml`, new): Weekly updates for npm (/), cargo (/packages/localbolt-signal), and github-actions (/); PR limits of 10/5/5 respectively
- **Vite 5 to 7 upgrade**: `vite` bumped from `^5.4.1` to `^7.3.1` in `packages/localbolt-web/package.json`; pulls in `esbuild` 0.27.3 (up from 0.21.5), fixing esbuild CVE
- **minimatch override**: Added `"overrides": { "minimatch": "^10.2.1" }` in `packages/localbolt-web/package.json` to fix ReDoS CVE in older minimatch versions
- **cargo fmt fix**: Reformatted `SocketAddr` parse chain in `packages/localbolt-signal/src/main.rs` (flattened `unwrap_or_else` closure formatting)
- **package-lock.json**: Updated with new esbuild 0.27.3 platform binaries (added netbsd-arm64, openbsd-arm64, openharmony-arm64), vite 7.3.1 with new dependencies (fdir, picomatch), and minimatch override
- Files changed:
  - `.github/dependabot.yml` (new)
  - `.github/workflows/ci.yml` (new)
  - `.github/workflows/codeql.yml` (new)
  - `package-lock.json`
  - `packages/localbolt-signal/src/main.rs`
  - `packages/localbolt-web/package.json`

## v3.0.29-security-hardening — Security hardening across web + signal: SAS verification, XSS sanitization, peer validation, relay ICE filtering, CSP, base64 fix, private IP detection (2026-02-18, 8034539)
- **SAS verification**: Added `getVerificationCode()` method to `WebRTCService` that computes a 6-character Short Authentication String from both peers' public keys (sorted, SHA-256 hashed); both sides produce the same code if keys were exchanged correctly, allowing users to confirm before transferring sensitive files
- **XSS sanitization**: New `escapeHTML()` utility in `src/lib/sanitize.ts`; all innerHTML injections of user-controlled data (device names, file names) now escape `&`, `<`, `>`, `"`, `'` to prevent cross-site scripting
  - `device-discovery.ts`: 4 instances of `${peer.deviceName}` / `${deviceName}` escaped
  - `file-upload.ts`: 1 instance of `${file.name}` escaped
- **Peer code validation (signal server)**: New `validate_peer_code()` function in `server.rs` — rejects empty, >16 char, or non-alphanumeric peer codes at registration time
- **Peer code collision detection (signal server)**: `add_peer()` in `room.rs` now returns `Result<Vec<PeerData>, String>` and rejects duplicate peer codes within the same room; server sends error and disconnects on collision
- **Relay ICE candidate filtering**: `WebRTCService` now blocks relay-type ICE candidates (`event.candidate.type === 'relay'`) proactively instead of post-connection filtering, enforcing the same-network policy earlier in the connection process
- **Content Security Policy**: Added CSP `<meta>` tag to `index.html` — `default-src 'self'`; `script-src 'self'`; `style-src 'self' 'unsafe-inline' fonts.googleapis.com`; `font-src 'self' fonts.gstatic.com`; `connect-src 'self' ws: wss:`; `img-src 'self' data:`; `frame-ancestors 'none'`; `base-uri 'self'`
- **Base64 encoding fix**: Replaced manual `btoa(String.fromCharCode(...))` / `Uint8Array.from(atob(...))` in `encryptChunk`/`decryptChunk` with `encodeBase64`/`decodeBase64` from tweetnacl-util, fixing potential issues with large binary chunks exceeding the call stack
- **Private IP detection (signal server)**: New `is_private_ip()` function in `server.rs` — detects RFC 1918 (10.x, 172.16-31.x, 192.168.x), loopback (127.0.0.1, ::1), link-local (169.254.x, fe80::), and IPv6 unique local (fc/fd) addresses; all private/loopback IPs now share a single "local" room so devices on the same LAN discover each other even when the host connects via 127.0.0.1 and others via 192.168.x.x
- **Code reformatting**: Flattened nested `match` arms in registration loop (`server.rs`) for cleaner Rust style; replaced `or_insert_with(Vec::new)` with `or_default()` in `room.rs`
- Files changed:
  - `packages/localbolt-signal/src/room.rs`
  - `packages/localbolt-signal/src/server.rs`
  - `packages/localbolt-web/index.html`
  - `packages/localbolt-web/src/components/device-discovery.ts`
  - `packages/localbolt-web/src/components/file-upload.ts`
  - `packages/localbolt-web/src/lib/sanitize.ts` (new)
  - `packages/localbolt-web/src/services/webrtc/WebRTCService.ts`

## v3.0.28-mobile-bg-fix — Pulsating bg moved to section-level absolute positioning, fixing mobile cutoff (2026-02-18, 36973b9)
- Pulsating background (`bgGlow`) moved from card-anchored negative insets (`-inset-24 sm:-inset-40 lg:-inset-64` on `cardWrap`) to section-level `absolute inset-0` on the transfer section itself
- `bgGlow` is now appended to `transferSection` instead of `cardWrap`, so the radial gradient and grid SVG fill the entire section viewport without negative inset overflow
- `cardWrap` is created after the background and keeps its `relative w-full max-w-2xl mx-auto` classes, sitting above the background layer
- Fixes mobile cutoff where negative insets caused the pulsating glow to be clipped on small screens
- Files changed:
  - `packages/localbolt-web/src/app.ts`

## v3.0.27-card-centered-bg — Pulsating bg anchored to card wrapper with responsive spread sizes (2026-02-18, de36a55)
- Pulsating grid background is now anchored to the card wrapper (`cardWrap`) instead of the full transfer section, so the glow stays centered behind the transfer card regardless of viewport size
- Introduced a `bgGlow` container with responsive negative inset classes (`-inset-24 sm:-inset-40 lg:-inset-64`) so the background spread scales up on larger screens
- Removed the old `bgContainer` div that spanned `absolute inset-0` on the section with a mask-image fade; background sizing is now controlled entirely by the responsive insets on `bgGlow`
- Radial gradient opacity bumped from `0.07` to `0.09` and outer stop changed from `rgba(0,0,0,0)` to `transparent_60%` for a tighter, brighter glow
- Grid SVG mask updated from `radial-gradient(white,transparent_80%)` to `radial-gradient(circle,white_20%,transparent_65%)` for a more focused grid reveal
- `cardWrap` now includes `max-w-2xl mx-auto` to constrain the card width and center it horizontally (previously just `relative w-full`)
- Files changed:
  - `packages/localbolt-web/src/app.ts`

## v3.0.26-fullscreen-card — Full-viewport transfer card with restored SEO content (2026-02-18, baea528)
- Hero section upgraded to a full-viewport screen (`min-h-[calc(100vh-3rem)]`) with flex centering; h1 enlarged to `text-5xl sm:text-6xl`; subtitle enlarged to `text-lg`
- Replaced static animated SVG down-arrow with a clickable green neon scroll button (`.scroll-btn`) that smooth-scrolls the transfer card into view (`scrollIntoView({ behavior: 'smooth', block: 'center' })`)
- Transfer card section now occupies its own full-viewport screen (`min-h-screen flex items-center justify-center`) instead of using fixed vertical padding
- Restored SEO content sections below the transfer card: How It Works, Features, and FAQ — re-imported `createHowItWorks`, `createFeatures`, and `createFAQ` into `app.ts`
- SEO content wrapped in a container with generous spacing (`py-24 lg:py-32 space-y-20`), positioned below the fold so it does not interfere with the transfer card screen
- Removed the placeholder bottom spacer (`h-48 lg:h-64`) that was added in v3.0.25
- Layout is now a clean 3-screen flow: Screen 1 (hero with scroll arrow), Screen 2 (full-viewport transfer card with pulsating grid), Screen 3 (SEO content: how-it-works + features + FAQ)
- Hero and transfer section elements changed from `div` to semantic `section` tags
- Files changed:
  - `packages/localbolt-web/src/app.ts`

## v3.0.25-hero-layout-pulse — Hero-first layout with pulsating grid centered on transfer card (2026-02-18, 79aebdd)
- Removed standalone `hero.ts` section file; hero content (h1 title, subtitle, animated down-arrow) is now inlined directly in `app.ts`
- Removed imports and usage of `createHero`, `createHowItWorks`, `createTrustStrip`, `createFeatures`, and `createFAQ` from `app.ts` — the page is now hero + transfer card + footer only
- Removed the old above-the-fold / below-the-fold split layout; replaced with a single linear flow: header, hero (text-center with pt-20/pt-28 padding), transfer section, bottom spacer, footer
- Pulsating grid background (`radial-gradient` + `grid.svg`) is now scoped to the transfer card section instead of spanning the full viewport; uses `radial-gradient(ellipse at 50% 50%, ...)` mask to fade out around the card
- Transfer card section uses generous vertical padding (`py-32 lg:py-48`) to float the card in the center of the viewport
- Removed the `min-h-screen` class from the wrapper; wrapper is now just `relative bg-dark text-white`
- Removed the `h2` title and subtitle from the transfer card component (`transfer.ts`) since the hero section now provides the page heading
- Hero h1 uses `animate-fade-up` with staggered animation delay (100ms) on the subtitle
- Added a bottom spacer (`h-48 lg:h-64`) where FAQ content previously lived
- Files changed:
  - `packages/localbolt-web/src/app.ts`
  - `packages/localbolt-web/src/sections/hero.ts` (deleted)
  - `packages/localbolt-web/src/sections/transfer.ts`

## v3.0.24-crypto-comment-fix — Fix outdated backward-compatibility comment in crypto-utils (2026-02-18, b5b2abd)
- Updated JSDoc comment for `generateSecurePeerCode()` function: changed "Returns 6-character code for backward compatibility" to "Returns a 6-character alphanumeric code"
- Comment now accurately describes function behavior without legacy context
- Files changed:
  - `packages/localbolt-web/src/lib/crypto-utils.ts`

## v3.0.23-revert-logo — Revert logo SVG, restore zap icon + text header (2026-02-18, 70c35ed)
- Deleted custom logo SVG (`packages/localbolt-web/public/logo.svg`)
- Header: restored inline Zap icon + "LocalBolt" text brand (replaces logo image tag)
- Header brand row now uses `gap-2` spacing, Zap icon sized `w-4 h-4` with `text-neon` color, text uses JetBrains Mono `font-bold tracking-tight text-white/90`
- Simplified header markup by removing external logo dependency
- Files changed:
  - `packages/localbolt-web/public/logo.svg` (deleted)
  - `packages/localbolt-web/src/sections/header.ts`

## v3.0.22-copy-logo-readme — Logo, copy refresh for dual signaling/cross-network, README added (2026-02-18, 9115b28)
- Added `logo.svg` to `packages/localbolt-web/public/` — custom LocalBolt wordmark in brand green (#B8CD1A on dark)
- Header: replaced inline Zap SVG icon + text brand with `<img src="/logo.svg">` logo; removed `icons` import from header
- Hero: rewrote subtitle to mention cross-network support ("Same network or across the internet"); replaced inline Zap icon separator with plain text; replaced `icons.arrowDown` with inline chevron SVG; removed `icons` import from hero
- Features section: updated copy to reflect dual signaling and cross-network capability; "Same-Network First" renamed to "Works Everywhere" with new description; "Lightning Fast" updated to mention LAN-only transfers; "Universal Compatibility" now mentions desktop app and self-hosting; replaced inline Zap icon separators with commas in section header; removed bolt icon from "WebRTC P2P Transfer" description
- How It Works: updated step descriptions for cross-network ("Same network or different networks"); replaced inline Zap icon separator with period in subheading
- FAQ: rewrote answers to reflect dual signaling and cross-network discovery; updated "How do I send large files" to mention automatic device discovery; updated "AirDrop on Windows/Android" to mention cross-network advantage over AirDrop; updated "transfer between iPhone and Android" to mention auto-discovery; updated "Does LocalBolt work across different networks?" answer from "no" to "yes" with dual signaling explanation; added new FAQ: "Can I self-host LocalBolt?" with GitHub/start-script instructions
- Structured data (JSON-LD in `index.html`): updated `featureList` to include cross-platform, cross-network, open source, self-host entries; updated FAQ answers to match new copy; added self-hosting FAQ; updated Organization and SoftwareApplication descriptions
- Open Graph / Twitter meta tags: removed em dashes from `og:description` and `twitter:image:alt`, replaced with commas/hyphens
- Removed all em dash (`—`) usage from copy across all changed files, replaced with commas, periods, or hyphens
- Added `README.md` at repo root: project description, directory structure, features list (dual signaling, cross-network), dev instructions, deployment info, architecture overview (DualSignaling explanation), related project links, MIT license
- Files changed:
  - `README.md` (new)
  - `packages/localbolt-web/public/logo.svg` (new)
  - `packages/localbolt-web/index.html` (structured data, meta tags, FAQ schema)
  - `packages/localbolt-web/src/sections/header.ts` (logo image, removed icons import)
  - `packages/localbolt-web/src/sections/hero.ts` (cross-network copy, inline SVG, removed icons import)
  - `packages/localbolt-web/src/sections/features.ts` (dual signaling copy, "Works Everywhere", removed bolt separators)
  - `packages/localbolt-web/src/sections/how-it-works.ts` (cross-network step descriptions)
  - `packages/localbolt-web/src/sections/faq.ts` (cross-network answers, self-hosting FAQ)

## v3.0.21-dual-signaling-icons — Dual signaling with LAN+cloud and PWA icon overhaul (2026-02-18, 5160235)
- Added `DualSignaling` class that connects to both a local signal server (LAN discovery) and a cloud signal server (internet discovery) simultaneously
- `DualSignaling` implements `SignalingProvider` interface: merges peer lists, tracks peer source (local vs cloud), routes signals to the correct server
- Graceful degradation: if either server connection fails, the other still works; at least one must succeed
- `peer-connection.ts` now imports `DualSignaling` instead of `WebSocketSignaling`; constructs with `VITE_LOCAL_SIGNAL_URL` (default `ws://<hostname>:3001`) and `VITE_SIGNAL_URL` (default `wss://localbolt-signal.fly.dev`)
- Added `setConnectionStateHandler()` on `DualSignaling` to update header status indicator when connection state changes
- Exported `DualSignaling` from the signaling module barrel (`index.ts`)
- Replaced old Lovable `favicon.ico` with custom green bolt PWA icons: `icon-192.png` (192x192), `icon-512.png` (512x512), `apple-touch-icon.png` (180x180)
- Updated `manifest.json`: replaced single `favicon.ico` entry with three properly sized PNG icon entries; changed `background_color` from `#ffffff` to `#121212` to match dark theme
- Added `<link rel="apple-touch-icon">` to `index.html` for iOS home screen support
- Files changed:
  - `packages/localbolt-web/src/services/signaling/DualSignaling.ts` (new, 191 lines)
  - `packages/localbolt-web/src/services/signaling/index.ts` (added DualSignaling export)
  - `packages/localbolt-web/src/components/peer-connection.ts` (switched to DualSignaling, dual URLs, connection state handler)
  - `packages/localbolt-web/index.html` (added apple-touch-icon link)
  - `packages/localbolt-web/public/manifest.json` (new icon entries, dark background)
  - `packages/localbolt-web/public/icon-192.png` (new)
  - `packages/localbolt-web/public/icon-512.png` (new)
  - `packages/localbolt-web/public/apple-touch-icon.png` (new)
  - `packages/localbolt-web/public/favicon.ico` (deleted)

## v3.0.20-remove-signal-toast — Remove redundant signaling error toast (2026-02-18, 16a5b70)
- Removed `handleConnectionError(new SignalingError(...))` call from the signaling connect catch block in `peer-connection.ts`
- The red OFFLINE dot in the header (added in v3.0.19) already communicates signaling failure to the user
- Eliminates a redundant error toast popup that duplicated the header status indicator
- Files changed:
  - `packages/localbolt-web/src/components/peer-connection.ts`

## v3.0.19-signaling-status — Reactive signaling status indicator in header (2026-02-18, 95318c0)
- Added `signalingConnected` boolean to `AppState` interface and initial state in the store
- Header now subscribes to store state changes and reactively updates the status indicator
- Status dot and label start as red `OFFLINE` (previously was always green `ACTIVE`)
- On successful signaling connection: dot becomes green pulsing `ACTIVE` (`bg-neon/70 animate-pulse`)
- On signaling connection failure: dot becomes red `OFFLINE` (`bg-red-500/70`)
- Peer connection component sets `signalingConnected: true` after `signaling.connect()` resolves, and `false` on catch
- Header imports store and uses `store.subscribe()` to react to signaling state changes
- Status dot and label use `.status-dot` / `.status-label` class selectors for DOM queries
- Files changed:
  - `packages/localbolt-web/src/state/store.ts`
  - `packages/localbolt-web/src/components/peer-connection.ts`
  - `packages/localbolt-web/src/sections/header.ts`

## v3.0.18-header-footer-redesign — Port lite header and footer design to v3 (2026-02-18, c29acf0)
- Redesigned header: reduced height from 64px (`h-16`) to 48px (`h-12`), switched brand text and ACTIVE label to JetBrains Mono monospace font
- Header brand icon shrunk from `w-8 h-8` to `w-4 h-4`; brand text set to 13px bold with tight tracking; removed nested `div` wrapper for flatter markup
- ACTIVE indicator: replaced "Network Active" text badge (glass card with border) with minimal `ACTIVE` label in 10px JetBrains Mono with widest tracking; dot reduced from `w-2 h-2` to `w-1.5 h-1.5` at 70% opacity
- Header border opacity reduced from `white/10` to `white/[0.06]`; backdrop blur changed from `backdrop-blur-md` to `backdrop-blur-sm`
- Footer redesigned: stripped GitHub SVG icon, separator pipes, and the9ines zap icon; replaced with compact monospaced links (GitHub / Privacy / the9ines) at 10px JetBrains Mono with `0.05em` letter-spacing
- Footer padding reduced from `py-8` to `py-4`; removed top border; link colors changed to `white/20` with `white/50` hover (the9ines link retains pink hover)
- Added JetBrains Mono (weights 500, 700) to Google Fonts preload in `index.html` alongside existing Inter font
- Files changed:
  - `packages/localbolt-web/index.html`
  - `packages/localbolt-web/src/sections/header.ts`
  - `packages/localbolt-web/src/sections/footer.ts`

## v3.0.17-bg-fade — Smooth background fade-out instead of hard cutoff (2026-02-18, 7c51418)
- Replaced `overflow-hidden` on the background container (`bgContainer`) with a CSS `mask-image` linear gradient that fades from opaque at 60% to transparent at 100%
- Added both `maskImage` and `webkitMaskImage` properties for cross-browser support
- Updated comment from "constrained to above-the-fold area only" to "fade out before below-the-fold content"
- Result: the radial gradient and grid background effects now smoothly fade out instead of ending abruptly at the viewport edge
- Files changed:
  - `packages/localbolt-web/src/app.ts`

## v3.0.16-layout-spacing — Increase how-it-works to transfer spacing, constrain bg to viewport (2026-02-18, 5da86c5)
- Added `!mt-16` to the transfer card element for more vertical gap after the how-it-works section
- Wrapped radial gradient and grid background effects in a new `h-screen` container (`bgContainer`) so the pulsating background is constrained to the above-the-fold viewport area and does not bleed into the FAQ section below
- Changed wrapper className to `relative` to support the new absolute-positioned background container
- Moved `pointer-events-none` from grid background to the container level; background elements now append to `bgContainer` instead of directly to `wrapper`
- Files changed:
  - `packages/localbolt-web/src/app.ts`

## v3.0.15-og-image-green — Update OG image to new brand green #A4E200 (2026-02-18, 4114d72)
- Regenerated `og-image.png` with the correct chartreuse green (#A4E200) to match the v3.0.13 color rebrand (previously used old neon green #14FF6A)
- Added `.netlify` directory to `.gitignore`
- Files changed:
  - `packages/localbolt-web/public/og-image.png` (updated)
  - `.gitignore` (added `.netlify` entry)

## v3.0.14-netlify-deploy — Added Netlify deploy config (2026-02-18, 7ab2586)
- Added `netlify.toml` with build configuration: base `packages/localbolt-web`, build command `npm install && npm run build`, publish directory `dist`
- Added SPA redirect rule in `netlify.toml` (`/* -> /index.html` with status 200)
- Added `_redirects` file in `packages/localbolt-web/public/` for Netlify SPA fallback
- Files changed:
  - `netlify.toml` (new)
  - `packages/localbolt-web/public/_redirects` (new)

## v3.0.13-vanilla-ts — Remove React, rewrite UI in vanilla TypeScript (2026-02-18, 7697d5b)
- Removed React, React DOM, all Radix UI primitives, TanStack Router/Query, shadcn/ui, lucide-react, and 50+ runtime dependencies
- Runtime dependencies reduced from 54 to 2 (tweetnacl, tweetnacl-util); dev dependencies reduced to 7
- Rewrote all UI components in vanilla TypeScript with direct DOM manipulation
- New components: `app.ts`, `device-discovery.ts`, `peer-connection.ts`, `file-upload.ts`, `transfer-progress.ts`, `connection-status.ts`
- New page sections: `header.ts`, `hero.ts`, `features.ts`, `how-it-works.ts`, `faq.ts`, `footer.ts`, `transfer.ts`, `trust-strip.ts`, `consent-modal.ts`
- Added lightweight state store (`state/store.ts`) replacing React hooks and context
- Added SVG icon module (`ui/icons.ts`) replacing lucide-react
- Added toast notification module (`ui/toast.ts`) replacing sonner/radix toast
- Implemented connection approval flow: request, accept/decline, then WebRTC handshake
- Device discovery popup for selecting nearby devices
- Clean device names: iPhone, Mac, Windows PC, Android, Linux, iPad, Chromebook, etc.
- Updated brand color from #14FF6A to #A4E200 in Tailwind config
- WebSocket signaling updated to support multiple concurrent listeners per event
- Added disconnect confirmation before severing WebRTC connection
- Entry point changed from `main.tsx` (React) to `main.ts` (vanilla)
- Removed: React router, React hooks (`use-mobile`, `use-peer-code`, `use-peer-connection`, `use-toast`, `use-transfer-progress`), Supabase integration stubs, `lib/utils.ts`, `vite-env.d.ts`
- 117 files changed (2,502 additions, 13,490 deletions)
- Files changed:
  - `packages/localbolt-web/package.json` (54 deps removed, version bumped to 3.0.0)
  - `packages/localbolt-web/index.html` (inline HTML structure replaces React root)
  - `packages/localbolt-web/src/main.ts` (new, replaces main.tsx)
  - `packages/localbolt-web/src/app.ts` (new, replaces App.tsx)
  - `packages/localbolt-web/src/state/store.ts` (new)
  - `packages/localbolt-web/src/ui/icons.ts` (new)
  - `packages/localbolt-web/src/ui/toast.ts` (new)
  - `packages/localbolt-web/src/components/device-discovery.ts` (new)
  - `packages/localbolt-web/src/components/peer-connection.ts` (new)
  - `packages/localbolt-web/src/components/file-upload.ts` (new)
  - `packages/localbolt-web/src/components/transfer-progress.ts` (new)
  - `packages/localbolt-web/src/components/connection-status.ts` (new)
  - `packages/localbolt-web/src/sections/` (9 new vanilla TS section files)
  - `packages/localbolt-web/src/services/signaling/WebSocketSignaling.ts` (multi-listener support)
  - `packages/localbolt-web/src/services/signaling/device-detect.ts` (clean device names)
  - `packages/localbolt-web/src/services/webrtc/WebRTCService.ts` (minor update)
  - `packages/localbolt-web/tailwind.config.ts` (color update)
  - `packages/localbolt-web/vite.config.ts` (React plugin removed)
  - `packages/localbolt-web/tsconfig.app.json` (JSX config removed)
  - `package-lock.json` (massive reduction)
  - 80+ React component/hook/UI files deleted

## v3.0.12-signal-ping — Handle keepalive pings and log signal relays (2026-02-18, b2d3788)
- Added `Ping` variant to `ClientMessage` enum in protocol — keepalive ping from client, no-op to prevent idle timeout
- Added handler for `ClientMessage::Ping` in server connection loop — continues without action, preventing WS idle disconnect
- Added `tracing::info!` log line for signal relay events (logs `from` and `to` peer codes)
- Files changed:
  - `packages/localbolt-signal/src/protocol.rs`
  - `packages/localbolt-signal/src/server.rs`

## v3.0.11-fly-deploy — Deploy Rust signal server to Fly.io (2026-02-18, c4a6753)
- Bumped Rust base image from 1.82 to 1.85 in signal server Dockerfile
- Fixed WebSocket callback return type from `tungstenite::error::Error` to `ErrorResponse` (imported `ErrorResponse` type)
- Removed `Cargo.lock` from Dockerfile COPY (not committed to repo)
- Added `fly.toml` config: app `localbolt-signal`, region `ewr`, 1 shared CPU, 1GB RAM, port 3001, force HTTPS, auto-stop/start machines
- Files changed:
  - `packages/localbolt-signal/Dockerfile`
  - `packages/localbolt-signal/fly.toml` (new)
  - `packages/localbolt-signal/src/server.rs`

## v3.0.10-faq-clean — Remove bolt emoji from FAQ answer, use period (2026-02-18, 9d8068e)
- Removed bolt emoji (`⚡`) from the FAQ answer for "Is LocalBolt safer than WeTransfer or Google Drive?"
- Replaced with a period and capitalized the following word for clean prose
- Files changed:
  - `packages/localbolt-web/src/components/sections/FAQ.tsx`

## v3.0.9-discovery-polish — Visual refinement of device discovery UI (2026-02-18, eff0bb2)
- Replaced shadcn `Button` with a plain `<button>` for the Disconnect action to match Transfer card visual language
- Replaced `<label>` elements with `<p>` tags for section headings (Nearby Devices, Connected Device) to remove form semantics
- Tightened connected device row: removed wrapper `space-y-2` + label, collapsed to a single flat row (`py-2.5` vs `py-3`)
- Reduced peer chip padding (`px-3 py-2` from `px-3.5 py-2.5`) and icon size (`w-3.5 h-3.5` from `w-4 h-4`)
- Updated idle state background to `bg-dark-accent/60` to match Transfer card surface token
- Changed empty-state text from "Looking for nearby devices..." to "Searching for nearby devices..." and color to `text-muted-foreground`
- Adjusted peer chip text color from `text-gray-300` to `text-gray-400` for softer contrast
- Files changed:
  - `packages/localbolt-web/src/components/peer-connection/DeviceDiscovery.tsx`

## v3.0.8-device-discovery — AirDrop-style device discovery replacing peer code flow (2026-02-18, 5f86aa4)
- Removed `PeerCodeInput` and `TargetPeerInput` components from `PeerConnection.tsx`; replaced with new `DeviceDiscovery` component
- Removed `usePeerCode` hook usage; peer code is now generated internally and used only for signaling
- Added `onPeerDiscovered` / `onPeerLost` signaling callbacks to populate a live `discoveredPeers` list
- Introduced `connectingTo` and `connectedDevice` state to drive connection UX without exposing raw peer codes
- `handleSelectPeer` initiates a WebRTC connection to a discovered peer by code; errors surface via toast
- `handleConnectionStateChange` now resolves connected device from `discoveredPeersRef` and updates `connectedDevice`
- `DeviceDiscovery` renders device-type icons (Smartphone/Tablet/Laptop/Monitor), an animated ping for empty state, and per-chip connecting pulse indicator
- Connected state shows a single compact row with device name, icon, and plain Disconnect button
- Files changed:
  - `packages/localbolt-web/src/components/PeerConnection.tsx`
  - `packages/localbolt-web/src/components/peer-connection/DeviceDiscovery.tsx` (new)

## v3.0.7-bolt-title — Bolt emoji in page title and meta tags (2026-02-18, 4471a2b)
- Replaced em dash separators with bolt emoji (⚡) in HTML page title
- Updated og:title and twitter:title meta tags with bolt emoji separators
- Updated og:description and twitter:image:alt meta tags with bolt emoji
- Files changed:
  - `packages/localbolt-web/src/pages/Index.tsx`

## v3.0.6-bolt-separators — Visual separator icons in copy (2026-02-18, 4ead633)
- Replaced em dash separators with inline grey Zap (lightning bolt) icons across Hero, HowItWorks, and Features sections
- Changed FeatureCard `description` prop type from `string` to `ReactNode` to support inline JSX icons
- Added `Bolt` helper component for consistent icon sizing (w-2.5)
- Files changed:
  - `packages/localbolt-web/src/components/sections/Hero.tsx`
  - `packages/localbolt-web/src/components/sections/HowItWorks.tsx`
  - `packages/localbolt-web/src/components/sections/Features.tsx`

## v3.0.5-signaling-abstraction — Supabase types stub (2026-02-18, fe14191)
- Added stub placeholder file to mark the removal of Supabase types
- Files changed:
  - `packages/localbolt-web/src/integrations/supabase/types.ts`

## v3.0.3-signaling-abstraction — Replace Supabase with WebSocket signaling (2026-02-18, 88434a3)
- Introduced `SignalingProvider` interface (connect, onSignal, sendSignal, discovery)
- Implemented `WebSocketSignaling` with auto-reconnect and heartbeat
- Added device detection utility (type + name from user agent)
- Refactored `WebRTCService` to accept `SignalingProvider` instead of direct Supabase calls
- Updated `PeerConnection.tsx` to create signaling before WebRTCService
- Removed Supabase client, types, and `@supabase/supabase-js` dependency
- Added `VITE_SIGNAL_URL` environment variable for WS server URL
- Added SRE protocol to `CLAUDE.md`
- Files changed:
  - `CLAUDE.md`
  - `packages/localbolt-web/src/services/signaling/SignalingProvider.ts` (new)
  - `packages/localbolt-web/src/services/signaling/WebSocketSignaling.ts` (new)
  - `packages/localbolt-web/src/services/signaling/device-detect.ts` (new)
  - `packages/localbolt-web/src/services/signaling/index.ts` (new)
  - `packages/localbolt-web/src/services/webrtc/WebRTCService.ts` (refactored)
  - `packages/localbolt-web/src/components/PeerConnection.tsx`
  - `packages/localbolt-web/src/integrations/supabase/client.ts` (stub)
  - `packages/localbolt-web/src/integrations/supabase/types.ts` (deleted)
  - `packages/localbolt-web/package.json`
  - `packages/localbolt-web/.env.example` (new)
  - `package-lock.json`

## v3.0.4-tauri-scaffold — Tauri v2 project structure (2026-02-18, 3530e7a)
- Scaffolded Tauri v2 project with desktop and mobile entry points
- Configured Tauri to point to localbolt-web frontend (dev + build)
- Added bundle config for macOS, iOS, Windows, Linux, Android
- Set up default capabilities (core + opener)
- Added placeholder Rust backend with greet command
- Added `@tauri-apps/cli` dev dependency
- Files changed:
  - `apps/tauri/package.json`
  - `apps/tauri/src-tauri/Cargo.toml`
  - `apps/tauri/src-tauri/build.rs`
  - `apps/tauri/src-tauri/tauri.conf.json`
  - `apps/tauri/src-tauri/capabilities/default.json`
  - `apps/tauri/src-tauri/src/lib.rs`
  - `apps/tauri/src-tauri/src/main.rs`
  - `apps/tauri/src-tauri/icons/icon.png`

## v3.0.2-rust-signal-server — Rust WebSocket signaling server (2026-02-18, fa02d88)
- Implemented custom Rust WS signaling server replacing Supabase
- IP-based room grouping for same-network device discovery
- WebRTC signal relay (offer/answer/ICE) between peers
- Peer join/leave broadcasting within IP rooms
- Library API for Tauri embedding (`SignalingServer` struct)
- Standalone binary with CLI args (`--host`, `--port`)
- DashMap concurrent room management
- X-Forwarded-For support for reverse proxy deployment
- Added Dockerfile for single-binary deployment
- Files changed:
  - `packages/localbolt-signal/Cargo.toml`
  - `packages/localbolt-signal/Dockerfile`
  - `packages/localbolt-signal/src/main.rs`
  - `packages/localbolt-signal/src/lib.rs`
  - `packages/localbolt-signal/src/server.rs`
  - `packages/localbolt-signal/src/room.rs`
  - `packages/localbolt-signal/src/protocol.rs`

## v3.0.1-copy-seo-encryption — Copy/SEO encryption emphasis (2026-02-18, 9db4d97)
- Hero: "Secure" changed to "Encrypted", new subtitle emphasizing zero server storage
- Meta tags: new title, description, keywords focused on encryption
- Structured data: NaCl/Curve25519 encryption messaging
- Features: encryption-specific descriptions, military-grade heading
- FAQ: updated answers with encryption standard details
- HowItWorks: NaCl encryption mention
- TrustStrip: NaCl/Curve25519 badge, zero server storage
- Files changed:
  - `packages/localbolt-web/src/components/sections/Hero.tsx`
  - `packages/localbolt-web/src/pages/Index.tsx`
  - `packages/localbolt-web/src/components/sections/Features.tsx`
  - `packages/localbolt-web/src/components/sections/FAQ.tsx`
  - `packages/localbolt-web/src/components/sections/HowItWorks.tsx`
  - `packages/localbolt-web/src/components/sections/TrustStrip.tsx`

## v3.0.0-init — Initial Setup (2026-02-18, 733b7c4)
- Monorepo scaffolded from LocalBolt v2 with npm workspaces
- Web app migrated from v2 (React/Vite/TanStack/TweetNaCl)
- Signaling server placeholder (Rust crate)
- Tauri app placeholder
- Files changed:
  - Root: `package.json`, `CLAUDE.md`, `.gitignore`
  - `docs/STATE.md`, `docs/CHANGELOG.md`
  - `packages/localbolt-web/` (full web app source from v2)
  - `packages/localbolt-signal/` (Rust crate placeholder)
  - `apps/tauri/` (placeholder)
