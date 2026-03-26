# LocalBolt v3 — Project State

## Current Version
- **Tag**: v3.0.89-consumer-btr1-p1
- **Commit**: e34e617
- **Branch**: main
- **Date**: 2026-03-11
- **BTR**: Enabled (`btrEnabled: true` in peer-connection.ts)

## Architecture
- **Frontend**: Vanilla TypeScript + Vite + Tailwind CSS (no React, no framework)
- **Signaling**: Dual signaling — `DualSignaling` class connects to both a local WS server (LAN) and a cloud WS server (internet) simultaneously; graceful degradation if either fails. Rust WebSocket server backend is a thin wrapper around canonical `bolt-rendezvous` crate (IP-based room grouping, replaced local protocol/server/room implementation)
- **Encryption**: TweetNaCl NaCl box (Curve25519 + XSalsa20-Poly1305); base64 via tweetnacl-util (encodeBase64/decodeBase64)
- **Transfer**: WebRTC data channel, 16KB chunks, reliable + ordered; relay ICE candidates blocked (same-network policy)
- **Discovery**: AirDrop-style UI — WS server broadcasts same-IP peers (all private/loopback IPs share "local" room); CGNAT/Tailscale/WireGuard IPs (100.64.0.0/10) also treated as private/local; client shows device discovery popup with clean device names (iPhone, Mac, Windows PC, Android, etc.) and one-tap connect; dual signaling merges peer lists from local + cloud servers; works across different networks (not just same LAN); peer code persisted in sessionStorage to prevent phantom devices on refresh (DP-3b); mDNS planned for Tauri offline mode
- **Connection Flow**: Request → Accept/Decline → WebRTC handshake (approval-based, not auto-connect); SAS verification code available for key confirmation; TOFU identity pinning with fail-closed key mismatch
- **Identity**: Persistent X25519 identity keypair stored in IndexedDB via SDK (`IndexedDBIdentityStore`). Created once, reused across sessions. Not encrypted-at-rest (shared-device risk documented). TOFU peer pins stored via `IndexedDBPinStore`.
- **Verification States**: `verified` (pinned + SAS confirmed, transfer allowed), `unverified` (new/unpinned peer, SAS shown, transfer blocked — must verify or pin first), `legacy` (peer lacks identity/HELLO support, transfer allowed with warning), `mismatch` (fail-closed, disconnect + error). Session orchestration layer (`session-state.ts` in `@the9ines/localbolt-core`) enforces phase machine and generation-based race guards; transfer gating via `isTransferAllowed()` pure function aligned with verification policy (v3.0.71).
- **Security**: CSP meta tag (script/style/connect/img/frame-ancestors); XSS sanitization on all innerHTML user data; peer code validation (alphanumeric, max 16 chars) and collision rejection on signal server; Netlify security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, HSTS preload) for Observatory A+ rating
- **Logo**: Inline Zap icon + "LocalBolt" text in header (JetBrains Mono, no external SVG file)
- **Native**: Tauri v2 path **retired**. Native desktop is bolt-ui (transitional) / localbolt-app SwiftUI (future).

## Packages
- `packages/bolt-core-browser` — Browser crypto primitives (`@the9ines/bolt-core` v0.6.5, workspace package). Source rehomed from bolt-core-sdk as part of TS-EXTRACTION-1.
- `packages/localbolt-browser` — Browser transport, signaling, identity, UI components, state (`@the9ines/localbolt-browser` v0.1.0, workspace package). Extracted from bolt-core-sdk. 344 tests (1 skipped).
- `packages/localbolt-core` — Shared app-layer orchestration (`@the9ines/localbolt-core` v0.1.2, published to npmjs.org). Owns session state machine, generation guard, verification state bus, and transfer gating policy. 70 tests.
- `packages/localbolt-web` — Production web app (vanilla TypeScript, fully functional). 75 tests.
- `packages/localbolt-signal` — Rust WS signaling server (canonical `bolt-rendezvous` wrapper); deployed to Fly.io. 36 tests.
- **Deployment**: Netlify (web app, workspace build — no NPM_TOKEN required), Fly.io (signal server)
- **CI/CD**: GitHub Actions — CI workflow builds full workspace chain (bolt-core-browser → localbolt-browser → localbolt-core → localbolt-web), tests all TS packages, Rust fmt/clippy/test/build for signal server. All actions pinned by SHA.
- **Test suite**: 489 tests total — 344 localbolt-browser, 70 localbolt-core, 75 localbolt-web
- `apps/tauri` — Tauri v2 native apps (**retired** — native desktop is now bolt-ui / localbolt-app SwiftUI path)

## Key Dependencies
- **Browser layer** (workspace): @the9ines/bolt-core (bolt-core-browser), @the9ines/localbolt-browser
- **Web runtime** (4): @the9ines/bolt-core (workspace), @the9ines/localbolt-browser (workspace), @the9ines/localbolt-core (workspace), tweetnacl/tweetnacl-util
- **Web dev**: @types/node, @vitest/coverage-v8, autoprefixer, jsdom, postcss, tailwindcss, tailwindcss-animate, typescript, vite (v7), vitest
- **Signal**: Rust, bolt-rendezvous (canonical, git dep), tokio, tracing-subscriber

## UI Components (vanilla TypeScript)
- **Entry**: `main.ts` → `app.ts` (mounts header, 3-screen layout: hero with scroll arrow, full-viewport transfer card with section-level pulsating bg, SEO content below, footer)
- **State**: `state/store.ts` (lightweight pub/sub store replacing React hooks/context)
- **Components**: `device-discovery.ts`, `peer-connection.ts`, `file-upload.ts`, `transfer-progress.ts`, `connection-status.ts`, `verification-status.ts` (SDK)
- **Services**: `services/identity.ts` (local identity persistence). Session state machine, verification state bus, and transfer policy moved to `@the9ines/localbolt-core` (v3.0.71).
- **Sections**: `header.ts`, `footer.ts`, `transfer.ts`, `how-it-works.ts`, `features.ts`, `faq.ts`, `consent-modal.ts` (hero content is inlined in `app.ts`; `hero.ts` and `trust-strip.ts` have been removed; how-it-works, features, and FAQ restored as SEO content below transfer card)
- **UI utilities**: `ui/icons.ts` (inline SVG icons), `ui/toast.ts` (toast notifications), `lib/sanitize.ts` (XSS escapeHTML)

## Brand
- **Primary color**: #A4E200 (previously #14FF6A)
- **Logo**: Inline Zap icon + "LocalBolt" text brand in header (JetBrains Mono, no external SVG)
- **Fonts**: JetBrains Mono (header brand, ACTIVE label, footer links), Inter (body text)
- **Copy style**: No em dashes; commas, periods, or hyphens only. No "military-grade" marketing language; use accurate technical descriptions (e.g. "end-to-end encrypted"). Cross-network and dual signaling emphasized throughout.
- **README**: Repo root `README.md` with project description, features, dev/deploy instructions, architecture overview, and related project links

## Roadmap
- **Phase A**: DONE — Copy/SEO overhaul (encryption emphasis) [v3.0.1]
- **Phase B**: DONE — Rust WS signaling server (backend) [v3.0.2] + frontend signaling abstraction [v3.0.3, v3.0.5] + deployed to Fly.io at wss://localbolt-signal.fly.dev [v3.0.11]
- **Phase D**: DONE — Tauri v2 scaffold [v3.0.4]
- **Phase C**: DONE — AirDrop-style device discovery UI [v3.0.8, v3.0.9]
- **Phase V**: DONE — Vanilla TypeScript rewrite, React removal [v3.0.13]
- **Phase W**: DONE — Copy refresh for dual signaling/cross-network, logo, README, self-hosting FAQ, em dash removal [v3.0.22]
- **Phase X**: DONE — Hero-first layout simplification: removed how-it-works, features, FAQ, trust-strip sections; hero + transfer card only; pulsating grid centered on card [v3.0.25]
- **Phase Y**: DONE — Full-viewport transfer card: 3-screen layout (hero, card, SEO content); green neon scroll arrow; restored how-it-works, features, FAQ below the fold; section-level pulsating bg [v3.0.26, v3.0.27, v3.0.28]
- **Phase Z**: DONE — Security hardening: SAS verification, XSS sanitization, peer code validation/collision detection, relay ICE filtering, CSP meta tag, base64 fix, private IP room grouping [v3.0.29]
- **Phase SC**: DONE — OpenSSF Scorecard hardening: pinned GitHub Actions by SHA, Dependabot, CI workflow, vite 5->7 (esbuild CVE fix), minimatch override (ReDoS CVE fix) [v3.0.30]. CodeQL SAST was added in v3.0.30 but later removed in v3.0.36 (private repo cannot use code scanning without GitHub Advanced Security)
- **Phase SH**: DONE — Security headers: Netlify HTTP security headers (HSTS, X-Frame-Options, COOP, Referrer-Policy, Permissions-Policy, X-Content-Type-Options) for Observatory A+ rating; Cargo.lock committed for reproducible builds [v3.0.31]
- **Phase CG**: DONE — CGNAT/Tailscale support: added 100.64.0.0/10 (CGNAT/shared address space) to private IP detection on both signal server (Rust) and web client (TypeScript); Tailscale/WireGuard mesh peers now auto-discover as local [v3.0.32]
- **Phase TP**: DONE — Test pipeline: vitest + jsdom smoke tests (4 tests: FAQ structure + app render), CI test step before build [v3.0.53]
- **Phase Q6**: DONE — Coverage thresholds: @vitest/coverage-v8, regression-prevention thresholds enforced (45/5/31/48%) [v3.0.55]
- **Phase A3**: DONE — ADR for signaling integration model: native workspace crate (not subtree), drift control policy [v3.0.56]
- **Phase N3B**: DONE — Bolt-core parity gate: bolt-core as dev dep in localbolt-signal, 3 tests codifying server-broad vs bolt-core-strict peer code validation divergence [v3.0.57-signal-parity-gate]
- **Phase H1**: DONE — Signal server trust-boundary hardening: bolt-rendezvous-grade enforcement ported to localbolt-signal [v3.0.59-signal-hardening]
- **Phase H5-v3**: DONE — TOFU/SAS wiring + identity/pin store: SDK identity persistence (IndexedDB), TOFU peer pinning, SAS verification UX, fail-closed key mismatch, legacy peer handling, transfer gating by verification state; 22 tests [v3.0.61-h5v3-tofu-sas-pinning]
- **Phase S0**: DONE — Canonical rendezvous integration: replaced local protocol.rs/server.rs/room.rs with bolt-rendezvous crate wrapper; wire-format parity preserved; 36 tests; LAN-only compatible; Docker build updated for git dependency [v3.0.63-s0-canonical-rendezvous]
- **Phase C6**: DONE — Core drift guard added to CI; `check-core-drift.sh` detects ad-hoc orchestration reimplementation in `packages/localbolt-web/src`; workspace exemption documented (consumer-style guards not applicable — localbolt-v3 is origin workspace) [v3.0.73-c6-hardening]
- **Phase C7**: DONE — Session UX race-hardening closure. 2 targeted tests added to localbolt-core: rapid 5+ connect/reset cycle monotonicity + late verification callback rejection. Combined with prior evidence (session state machine, generation guards, A→B→C isolation, stale signal rejection). 43 core tests. No runtime changes needed. [v3.0.74-c7-closure]
- **Phase R1-4**: DONE — Security-focused reconnect integrity tests. 7 tests covering crypto-path integrity around reconnect boundary (generation guard + verification reset + transfer policy) and trust/verification state isolation between consecutive sessions. Core 43→50 tests. [v3.0.79-s-stream-r1-r1.4-security-test-lift]
- Phase E: Tauri native features (mDNS, local WS, file save)
- Phase F: Mobile polish + app store submission
- Phase G: Desktop builds + CI/CD
- Future: Nostr global signaling

## Tag History
| Tag | Hash | Description |
|-----|------|-------------|
| v3.0.0-init | 733b7c4 | Monorepo scaffold from v2 |
| v3.0.1-copy-seo-encryption | 9db4d97 | Copy/SEO encryption emphasis |
| v3.0.2-rust-signal-server | fa02d88 | Rust WS signaling server |
| v3.0.3-signaling-abstraction | 88434a3 | Frontend signaling provider (Supabase removed) |
| v3.0.4-tauri-scaffold | 3530e7a | Tauri v2 project structure |
| v3.0.5-signaling-abstraction | fe14191 | Supabase types stub |
| v3.0.6-bolt-separators | 4ead633 | Visual bolt icon separators in copy |
| v3.0.7-bolt-title | 4471a2b | Bolt emoji in page title and meta tags |
| v3.0.8-device-discovery | 5f86aa4 | AirDrop-style device discovery, peer code UI removed |
| v3.0.9-discovery-polish | eff0bb2 | Visual refinement of discovery to match Transfer card |
| v3.0.10-faq-clean | 9d8068e | Remove bolt emoji from FAQ answer, use period |
| v3.0.11-fly-deploy | c4a6753 | Deploy Rust signal server to Fly.io |
| v3.0.12-signal-ping | b2d3788 | Handle keepalive pings and log signal relays |
| v3.0.13-vanilla-ts | 7697d5b | Remove React, rewrite UI in vanilla TypeScript |
| v3.0.14-netlify-deploy | 7ab2586 | Netlify deploy config (netlify.toml + _redirects) |
| v3.0.15-og-image-green | 4114d72 | Update OG image to new brand green (#A4E200) |
| v3.0.16-layout-spacing | 5da86c5 | Increase how-it-works to transfer spacing, constrain bg to viewport |
| v3.0.17-bg-fade | 7c51418 | Smooth background fade-out instead of hard cutoff |
| v3.0.18-header-footer-redesign | c29acf0 | Port lite header and footer design to v3 |
| v3.0.19-signaling-status | 95318c0 | Reactive signaling status indicator in header |
| v3.0.20-remove-signal-toast | 16a5b70 | Remove redundant signaling error toast |
| v3.0.21-dual-signaling-icons | 5160235 | Dual signaling (LAN+cloud) and PWA icon overhaul |
| v3.0.22-copy-logo-readme | 9115b28 | Logo, copy refresh for dual signaling/cross-network, README |
| v3.0.23-revert-logo | 70c35ed | Revert logo SVG, restore zap icon + text header |
| v3.0.24-crypto-comment-fix | b5b2abd | Fix outdated backward-compatibility comment in crypto-utils |
| v3.0.25-hero-layout-pulse | 79aebdd | Hero-first layout with pulsating grid centered on transfer card |
| v3.0.26-fullscreen-card | baea528 | Full-viewport transfer card with restored SEO content below |
| v3.0.27-card-centered-bg | de36a55 | Pulsating bg anchored to card wrapper with responsive spread |
| v3.0.28-mobile-bg-fix | 36973b9 | Pulsating bg moved to section-level, fixing mobile cutoff |
| v3.0.29-security-hardening | 8034539 | Security hardening: SAS, XSS, peer validation, CSP, ICE filtering, private IP rooms |
| v3.0.30-scorecard-hardening | 234710a | OpenSSF Scorecard: pinned Actions, CodeQL SAST, Dependabot, vite 7, minimatch override |
| v3.0.31-security-headers | 1b42a4a | Security headers (Observatory A+), Cargo.lock committed |
| v3.0.32-cgnat-tailscale | 7535d55 | CGNAT/Tailscale IP range (100.64.0.0/10) added to private IP detection |
| v3.0.33-clippy-fix | 9ae4d5b | Fix clippy useless_conversion warning in signal server |
| v3.0.34-codeql-fix | bc1255c | Fix CodeQL checkout failure on private repo |
| v3.0.35-codeql-perms | c1e9a76 | Add actions: read permission to CodeQL workflow |
| v3.0.36-remove-codeql | f27d092 | Remove CodeQL workflow (private repo, no Advanced Security) |
| v3.0.37-copy-fix | a681f13 | Replace military-grade copy with accurate encryption description |
| v3.0.38-faq-sync | 1c24c0b | Sync FAQ copy: expand answers, reword network question for offline emphasis |
| v3.0.51-hello-tofu-deps | 01a0e1f | Bump bolt-core to 0.2.0, bolt-transport-web to 0.2.0 (encrypted HELLO + TOFU) |
| v3.0.52-sas-verification-deps | 17c6d3f | Bump bolt-transport-web to 0.3.0 (Phase 7B SAS verification surface) |
| v3.0.53-test-pipeline | 8cba99f | Establish test pipeline with vitest + jsdom smoke tests |
| v3.0.54-sdk-upgrade | 463e963 | Upgrade SDK: bolt-core 0.3.0, bolt-transport-web 0.6.0 |
| v3.0.55-coverage-thresholds | fa59742 | Coverage threshold enforcement (Q6 close) |
| v3.0.56-signaling-adr | 6c8b422 | ADR for signaling integration model (A3 close) |
| v3.0.57-signal-parity-gate | 59db709 | Bolt-core parity gate for signal peer code validation (native-3b) |
| v3.0.57-bolt-core-bump | 14927d7 | Bump bolt-core to 0.4.0 (A1 adoption) |
| v3.0.58-sig-3-url-hygiene | c3d058e | Remove hardcoded cloud signaling fallback (SIG-3) |
| v3.0.59-signal-hardening | ac5110c | H1: Signal server trust-boundary hardening |
| v3.0.60-h6-ci-enforcement | 3b12f73 | H6: CI enforcement audit |
| v3.0.61-h5v3-tofu-sas-pinning | 532d391 | H5-v3: TOFU/SAS wiring + identity/pin store |
| v3.0.62-h1-mainline-merge | 7571d35 | Merge H1 signal hardening into main (mainline convergence) |
| v3.0.65-dp3b-dp4-phantom-transfer | 08382f1 | DP-3b: sessionStorage peer code persistence (phantom device fix) + DP-4: remove verification gate on file upload |
| v3.0.64-ac4-coverage-enforced | a5d0237 | AC-4: CI coverage enforcement + jsdom showModal polyfill |
| v3.0.68-dp8-netlify-npmrc | b1a2cd4 | DP-8: Add .npmrc with GitHub Packages auth for Netlify deployment |
| v3.0.67-dp7-bolt-core-050 | 6bb21b3 | DP-7: Bump bolt-core to 0.5.0 (wire error code registry, unblocks Netlify deploy) |
| v3.0.66-dp6-transport-web-bump | 8f98716 | DP-6: Bump bolt-transport-web to 0.6.1 (responder send button fix) |
| v3.0.72-localbolt-core-publish | 7cb8d8d | Batch 3 P1: Publish @the9ines/localbolt-core 0.1.0 to GitHub Packages |
| v3.0.71-localbolt-core-c2 | aa9e40e | C-2: Extract @the9ines/localbolt-core package — session state, verification bus, transfer policy (100 tests total) |
| v3.0.70-session-hardening-cpre2 | cac5e4a | C-pre-1/2: Session orchestration layer, race hardening, transfer gating alignment (59 tests, 58.22% coverage) |
| v3.0.69-dp9-backpressure-fix | 48617f0 | DP-9: Bump transport-web to 0.6.2 (backpressure hang fix for bidirectional transfer) |
| v3.0.73-c6-hardening | 2a4d098 | C6: localbolt-core drift guard in CI, workspace exemption documented |
| v3.0.74-c7-closure | b867426 | C7: rapid cycling + late verification callback tests (43 core tests, no runtime changes) |
| v3.0.63-s0-canonical-rendezvous | 2963539 | S0: canonical bolt-rendezvous wrapper replaces local signal implementation |
| v3.0.75-d3-registry-migration | 92adc37 | D3: migrate localbolt-core to npmjs.org (PAT-free installs) |
| v3.0.76-d4-npmjs-cutover | ef0543e | D4: switch consumer resolution to npmjs.org |
| v3.0.77-d4-netlify-build-fix | 0746275 | D4: fix Netlify build — build localbolt-core before localbolt-web, remove base directive |
| v3.0.78-d5-registry-guards | fec153b | D5: registry/auth regression guards + CI cleanup for PAT-free installs |
| v3.0.86-csp-wasm | 98610d3 | Allow WASM compilation in CSP — add wasm-unsafe-eval and googletagmanager to script-src |
| v3.0.79-s-stream-r1-r1.4-security-test-lift | 31046ac | R1-4: security-focused reconnect integrity tests (core 43→50) |
| v3.0.80-c-stream-r1-ui-state-fix | 9f3546e | C-STREAM-R1: UI/state regression recovery (generation guards, trust UI, 122 tests) |
| v3.0.87-domain-rename | 69ec25c | Rename localbolt.site to localbolt.app |
| v3.0.89-consumer-btr1-p1 | e34e617 | CBTR-1 P1: enable BTR (Bolt Transfer Ratchet) in consumer |
| v3.0.88-recon-xfer1-phase-a | a7e311b | RECON-XFER-1 Phase A: fix transfer reconnect recovery after mid-transfer disconnect |
