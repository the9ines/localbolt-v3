# LocalBolt v3 — Project State

## Current Version
- **Tag**: v3.0.22-copy-logo-readme
- **Branch**: main
- **HEAD**: 9115b28

## Architecture
- **Frontend**: Vanilla TypeScript + Vite + Tailwind CSS (no React, no framework)
- **Signaling**: Dual signaling — `DualSignaling` class connects to both a local WS server (LAN) and a cloud WS server (internet) simultaneously; graceful degradation if either fails. Custom Rust WebSocket server backend (IP-based room grouping, replaced Supabase)
- **Encryption**: TweetNaCl NaCl box (Curve25519 + XSalsa20-Poly1305)
- **Transfer**: WebRTC data channel, 16KB chunks, reliable + ordered
- **Discovery**: AirDrop-style UI — WS server broadcasts same-IP peers; client shows device discovery popup with clean device names (iPhone, Mac, Windows PC, Android, etc.) and one-tap connect; dual signaling merges peer lists from local + cloud servers; works across different networks (not just same LAN); mDNS planned for Tauri offline mode
- **Connection Flow**: Request → Accept/Decline → WebRTC handshake (approval-based, not auto-connect)
- **Logo**: Custom SVG wordmark (`public/logo.svg`) displayed in header via `<img>` tag
- **Native**: Tauri v2 (macOS, iOS, Windows, Linux, Android)

## Packages
- `packages/localbolt-web` — Production web app (vanilla TypeScript, fully functional)
- `packages/localbolt-signal` — Rust WS signaling server (implemented, IP-based rooms, keepalive ping support, deployed to Fly.io at wss://localbolt-signal.fly.dev)
- **Deployment**: Netlify (web app), Fly.io (signal server)
- `apps/tauri` — Tauri v2 native apps (scaffolded, config pointing to localbolt-web)

## Key Dependencies
- **Web runtime** (2): tweetnacl, tweetnacl-util
- **Web dev** (7): @types/node, autoprefixer, postcss, tailwindcss, tailwindcss-animate, typescript, vite
- **Signal**: Rust, tokio, tokio-tungstenite, dashmap, serde, futures-util, tracing
- **Tauri**: @tauri-apps/cli v2, tauri (Rust crate)

## UI Components (vanilla TypeScript)
- **Entry**: `main.ts` → `app.ts` (mounts all sections and initializes signaling)
- **State**: `state/store.ts` (lightweight pub/sub store replacing React hooks/context)
- **Components**: `device-discovery.ts`, `peer-connection.ts`, `file-upload.ts`, `transfer-progress.ts`, `connection-status.ts`
- **Sections**: `header.ts`, `hero.ts`, `features.ts`, `how-it-works.ts`, `faq.ts`, `footer.ts`, `transfer.ts`, `trust-strip.ts`, `consent-modal.ts`
- **UI utilities**: `ui/icons.ts` (inline SVG icons), `ui/toast.ts` (toast notifications)

## Brand
- **Primary color**: #A4E200 (previously #14FF6A)
- **Logo**: Custom SVG wordmark (`logo.svg`) — brand green (#B8CD1A) on transparent; replaces previous Zap icon + text
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
