# LocalBolt v3

**[localbolt.app](https://localbolt.app)** - the live website.

Source code for the LocalBolt website and cloud signaling server. Encrypted peer-to-peer file transfer. Files go directly between devices, never stored on any server.

## What's Here

```
packages/
  bolt-core-browser/   # Browser crypto primitives (@the9ines/bolt-core)
  localbolt-browser/   # Browser transport, signaling, UI, state (@the9ines/localbolt-browser)
  localbolt-core/      # Session orchestration, verification state (@the9ines/localbolt-core)
  localbolt-web/       # Website frontend (Vanilla TypeScript, Tailwind, Vite)
  localbolt-signal/    # Rust signaling server (Tokio + Tungstenite WebSocket)
```

## Features

- **NaCl/Curve25519 encryption** - same crypto as Signal and WireGuard
- **WebRTC P2P transfer** - files never touch a server
- **Dual signaling** - discovers devices on the same LAN and across the internet
- **Auto-discovery** - devices appear automatically, tap to connect
- **No accounts** - no sign-up, no cloud storage, no data collection
- **No file size limits** - limited only by device storage
- **Cross-platform** - any modern browser on any OS
- **Open source** - self-host your own instance

## Development

**Web frontend:**

```bash
npm install
npm run dev
```

**Signal server:**

```bash
cd packages/localbolt-signal
cargo run --release
```

## Build

The workspace builds in dependency order:

```bash
npm run build
# bolt-core-browser → localbolt-browser → localbolt-core → localbolt-web
```

## Deployment

- **Website**: Deployed to Netlify (static build)
- **Signal server**: Deployed to Fly.io (`wss://localbolt-signal.fly.dev`)

## Architecture

Two transfer paths:

- **Browser → App** (forward path): connects to the native desktop app's daemon via WebTransport (HTTPS origins) or WebSocket direct (localhost/HTTP origins). Encrypted, daemon-mediated, peer-to-peer.
- **Browser ↔ Browser** (compatibility path): WebRTC data channels for browser-only file sharing without a native app.

The website connects to both the cloud signal server and any local signal server via `DualSignaling`. This means users of the website can discover:

- Devices running the native desktop app (via cloud or local signaling) — forward path
- Other users on localbolt.app (via cloud signaling) — browser↔browser
- Devices running the self-hosted version on the same LAN (via local signaling)

## Ecosystem

LocalBolt v3 is part of the [Bolt Protocol](https://github.com/the9ines/bolt-protocol) ecosystem. See [PRD.md](PRD.md) and [ROADMAP.md](ROADMAP.md) in this repo for product requirements and roadmap.

| Relationship | Repository |
|-------------|-----------|
| Ecosystem governance (mirror) | [bolt-ecosystem](https://github.com/the9ines/bolt-ecosystem) |
| Protocol spec | [bolt-protocol](https://github.com/the9ines/bolt-protocol) |
| SDK (Rust) | [bolt-core-sdk](https://github.com/the9ines/bolt-core-sdk) |
| Hosted rendezvous | [bolt-rendezvous](https://github.com/the9ines/bolt-rendezvous) (endpoint only) |
| Lite self-hosted | [localbolt](https://github.com/the9ines/localbolt) |
| Native app | [localbolt-app](https://github.com/the9ines/localbolt-app) |

This repo does **not** bundle the rendezvous server or daemon. It connects to a hosted endpoint only.

This is an **open-source** project.

## Related

- **[localbolt.app](https://localbolt.app)** — use it now
- **[LocalBolt (self-hosted)](https://github.com/the9ines/localbolt)** — download and run on your own network
- **[LocalBolt App](https://github.com/the9ines/localbolt-app)** — native desktop app

## License

MIT — built by [the9ines](https://the9ines.com)
