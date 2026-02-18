# LocalBolt v3 Changelog

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
