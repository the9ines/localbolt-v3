# @the9ines/localbolt-core

Shared app-layer orchestration for the LocalBolt product family.

## Ownership boundary

This package owns:

- **Session state machine** — phase transitions (idle, requesting, incoming_request, connecting, connected, disconnecting) with guarded transitions that reject invalid paths.
- **Generation guard** — monotonic counter incremented on every reset, used by shells to detect and discard stale async callbacks from previous sessions.
- **Verification state bus** — lightweight pub/sub for TOFU verification state (legacy, unverified, verified, mismatch) that sits alongside the SDK store.
- **Transfer gating policy** — pure function encoding which verification states allow file transfer (`verified` and `legacy` allowed; `unverified` and `mismatch` blocked).

## What this package does NOT own

- WebRTC service instantiation, signaling, identity persistence, UI — those belong to shell packages (`@localbolt/web`, Tauri app, etc.).
- Protocol, wire format, cryptographic primitives — those belong to `@the9ines/bolt-core` and `@the9ines/bolt-transport-web`.
- This package orchestrates on top of the SDK. It does not fork or duplicate SDK logic.

## Dependencies

- `@the9ines/bolt-transport-web` — for the shared `store` singleton and `VerificationInfo` type.

## Build

```
npm run build -w packages/localbolt-core
```

Emits to `dist/` via `tsc`.

## Test

```
npm test -w packages/localbolt-core -- --run
```
