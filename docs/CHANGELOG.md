# LocalBolt v3 Changelog

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
