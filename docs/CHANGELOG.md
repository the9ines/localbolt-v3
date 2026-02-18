# LocalBolt v3 Changelog

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
