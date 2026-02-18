# LocalBolt v3 — Project State

## Current Version
- **Tag**: v3.0.0
- **Branch**: main

## Architecture
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Router/Query
- **Signaling**: Supabase (migrating to custom Rust WS server)
- **Encryption**: TweetNaCl NaCl box (Curve25519 + XSalsa20-Poly1305)
- **Transfer**: WebRTC data channel, 16KB chunks, reliable + ordered

## Packages
- `packages/localbolt-web` — Production web app (migrated from v2)
- `packages/localbolt-signal` — Rust WS signaling server (placeholder)
- `apps/tauri` — Tauri v2 native apps (placeholder)

## Roadmap
- Phase A: Copy/SEO overhaul (encryption emphasis)
- Phase B: Rust WS signaling server (replace Supabase)
- Phase C: AirDrop-style device discovery UI
- Phase D: Tauri v2 scaffold
- Phase E: Tauri native features (mDNS, local WS, file save)
- Phase F: Mobile polish + app store submission
- Phase G: Desktop builds + CI/CD
- Future: Nostr global signaling
