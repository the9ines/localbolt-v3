# LocalBolt v3 — Project State

## Current Version
- **Tag**: v3.0.33-clippy-fix
- **Branch**: main
- **HEAD**: 9ae4d5b

## Architecture
- **Frontend**: Vanilla TypeScript + Vite + Tailwind CSS (no React, no framework)
- **Signaling**: Dual signaling — `DualSignaling` class connects to both a local WS server (LAN) and a cloud WS server (internet) simultaneously; graceful degradation if either fails. Custom Rust WebSocket server backend (IP-based room grouping, replaced Supabase)
- **Encryption**: TweetNaCl NaCl box (Curve25519 + XSalsa20-Poly1305); base64 via tweetnacl-util (encodeBase64/decodeBase64)
- **Transfer**: WebRTC data channel, 16KB chunks, reliable + ordered; relay ICE candidates blocked (same-network policy)
- **Discovery**: AirDrop-style UI — WS server broadcasts same-IP peers (all private/loopback IPs share "local" room); CGNAT/Tailscale/WireGuard IPs (100.64.0.0/10) also treated as private/local; client shows device discovery popup with clean device names (iPhone, Mac, Windows PC, Android, etc.) and one-tap connect; dual signaling merges peer lists from local + cloud servers; works across different networks (not just same LAN); mDNS planned for Tauri offline mode
- **Connection Flow**: Request → Accept/Decline → WebRTC handshake (approval-based, not auto-connect); SAS verification code available for key confirmation
- **Security**: CSP meta tag (script/style/connect/img/frame-ancestors); XSS sanitization on all innerHTML user data; peer code validation (alphanumeric, max 16 chars) and collision rejection on signal server; Netlify security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, HSTS preload) for Observatory A+ rating
- **Logo**: Inline Zap icon + "LocalBolt" text in header (JetBrains Mono, no external SVG file)
- **Native**: Tauri v2 (macOS, iOS, Windows, Linux, Android)

## Packages
- `packages/localbolt-web` — Production web app (vanilla TypeScript, fully functional)
- `packages/localbolt-signal` — Rust WS signaling server (implemented, IP-based rooms with private IP grouping, peer code validation/collision detection, keepalive ping support, deployed to Fly.io at wss://localbolt-signal.fly.dev)
- **Deployment**: Netlify (web app), Fly.io (signal server)
- **CI/CD**: GitHub Actions — CI workflow (Rust fmt/clippy/test/build + TS build), CodeQL SAST (javascript-typescript, weekly + push/PR), Dependabot (npm/cargo/github-actions weekly); all actions pinned by SHA
- `apps/tauri` — Tauri v2 native apps (scaffolded, config pointing to localbolt-web)

## Key Dependencies
- **Web runtime** (2): tweetnacl, tweetnacl-util
- **Web dev** (7): @types/node, autoprefixer, postcss, tailwindcss, tailwindcss-animate, typescript, vite (v7)
- **Signal**: Rust, tokio, tokio-tungstenite, dashmap, serde, futures-util, tracing
- **Tauri**: @tauri-apps/cli v2, tauri (Rust crate)

## UI Components (vanilla TypeScript)
- **Entry**: `main.ts` → `app.ts` (mounts header, 3-screen layout: hero with scroll arrow, full-viewport transfer card with section-level pulsating bg, SEO content below, footer)
- **State**: `state/store.ts` (lightweight pub/sub store replacing React hooks/context)
- **Components**: `device-discovery.ts`, `peer-connection.ts`, `file-upload.ts`, `transfer-progress.ts`, `connection-status.ts`
- **Sections**: `header.ts`, `footer.ts`, `transfer.ts`, `how-it-works.ts`, `features.ts`, `faq.ts`, `consent-modal.ts` (hero content is inlined in `app.ts`; `hero.ts` and `trust-strip.ts` have been removed; how-it-works, features, and FAQ restored as SEO content below transfer card)
- **UI utilities**: `ui/icons.ts` (inline SVG icons), `ui/toast.ts` (toast notifications), `lib/sanitize.ts` (XSS escapeHTML)

## Brand
- **Primary color**: #A4E200 (previously #14FF6A)
- **Logo**: Inline Zap icon + "LocalBolt" text brand in header (JetBrains Mono, no external SVG)
- **Fonts**: JetBrains Mono (header brand, ACTIVE label, footer links), Inter (body text)
- **Copy style**: No em dashes; commas, periods, or hyphens only. Cross-network and dual signaling emphasized throughout.
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
- **Phase SC**: DONE — OpenSSF Scorecard hardening: pinned GitHub Actions by SHA, CodeQL SAST, Dependabot, CI workflow, vite 5->7 (esbuild CVE fix), minimatch override (ReDoS CVE fix) [v3.0.30]
- **Phase SH**: DONE — Security headers: Netlify HTTP security headers (HSTS, X-Frame-Options, COOP, Referrer-Policy, Permissions-Policy, X-Content-Type-Options) for Observatory A+ rating; Cargo.lock committed for reproducible builds [v3.0.31]
- **Phase CG**: DONE — CGNAT/Tailscale support: added 100.64.0.0/10 (CGNAT/shared address space) to private IP detection on both signal server (Rust) and web client (TypeScript); Tailscale/WireGuard mesh peers now auto-discover as local [v3.0.32]
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
