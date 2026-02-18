# LocalBolt v3 — Project State

## Current Version
- **Tag**: v3.0.6-bolt-separators
- **Branch**: main
- **HEAD**: 4ead633

## Architecture
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Router/Query
- **Signaling**: Custom Rust WebSocket server (IP-based room grouping, replaced Supabase)
- **Encryption**: TweetNaCl NaCl box (Curve25519 + XSalsa20-Poly1305)
- **Transfer**: WebRTC data channel, 16KB chunks, reliable + ordered
- **Discovery**: WS server groups same-IP peers (web), mDNS planned for Tauri offline mode
- **Native**: Tauri v2 (macOS, iOS, Windows, Linux, Android)

## Packages
- `packages/localbolt-web` — Production web app (React 18, fully functional)
- `packages/localbolt-signal` — Rust WS signaling server (implemented, IP-based rooms, Dockerized)
- `apps/tauri` — Tauri v2 native apps (scaffolded, config pointing to localbolt-web)

## Key Dependencies
- **Web**: React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Router/Query, TweetNaCl, lucide-react
- **Signal**: Rust, tokio, warp, dashmap, serde
- **Tauri**: @tauri-apps/cli v2, tauri (Rust crate)

## Roadmap
- **Phase A**: DONE — Copy/SEO overhaul (encryption emphasis) [v3.0.1]
- **Phase B**: DONE — Rust WS signaling server (backend) [v3.0.2] + frontend signaling abstraction [v3.0.3, v3.0.5]
- **Phase D**: DONE — Tauri v2 scaffold [v3.0.4]
- **Phase C**: NEXT — AirDrop-style device discovery UI
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
