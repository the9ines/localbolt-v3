# LocalBolt v3

**[localbolt.site](https://localbolt.site)** - the live website.

Source code for the LocalBolt website and cloud signaling server. Encrypted peer-to-peer file transfer. Files go directly between devices, never stored on any server.

## What's Here

```
packages/
  localbolt-web/     # Website frontend (Vanilla TypeScript, Tailwind, Vite)
  localbolt-signal/  # Rust signaling server (Tokio + Tungstenite WebSocket)
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
cd packages/localbolt-web
npm install
npm run dev
```

**Signal server:**

```bash
cd packages/localbolt-signal
cargo run --release
```

## Deployment

- **Website**: Deployed to Netlify (static build)
- **Signal server**: Deployed to Fly.io (`wss://localbolt-signal.fly.dev`)

## Architecture

The website connects to both the cloud signal server and any local signal server via `DualSignaling`. This means users of the website can discover:

- Other users on localbolt.site (via cloud signaling)
- Devices running the self-hosted version on the same LAN (via local signaling)
- Devices running the native desktop app (via either)

## Related

- **[localbolt.site](https://localbolt.site)** - use it now
- **[LocalBolt (self-hosted)](https://github.com/the9ines/localbolt)** - download and run on your own network
- **[LocalBolt App](https://github.com/the9ines/localbolt-app)** - native desktop app with embedded signal server

## License

MIT - built by [the9ines](https://the9ines.com)
