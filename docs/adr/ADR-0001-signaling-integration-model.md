# ADR-0001: Signaling Server Integration Model

**Status:** Accepted
**Date:** 2026-02-24
**Deciders:** Bolt Ecosystem maintainers

## Context

The Bolt Ecosystem has three product repositories that integrate a WebSocket signaling server for peer discovery and WebRTC handshake relay:

| Repo | Integration Model | Source |
|------|-------------------|--------|
| localbolt | `signal/` git subtree from bolt-rendezvous | Canonical upstream |
| localbolt-app | `signal/` git subtree from bolt-rendezvous | Canonical upstream |
| localbolt-v3 | `packages/localbolt-signal` native Rust crate | Co-versioned workspace member |

The signaling server in all three repos implements the same wire protocol: JSON-over-WebSocket with `register`, `signal`, `discover`, and `ping/pong` message types. IP-based room grouping with private IP detection (including CGNAT/Tailscale 100.64.0.0/10) is consistent across all implementations.

`bolt-rendezvous` is the canonical upstream repository for the signaling server. localbolt and localbolt-app pull from it via `git subtree pull --prefix=signal bolt-rendezvous main --squash`. Both subtree copies were confirmed aligned to bolt-rendezvous commit `4ea8709` during the ecosystem audit (Phase 8B.2).

localbolt-v3 was built from scratch as an npm workspace monorepo with `packages/localbolt-signal` as a native Rust crate member, not a subtree.

## Decision

localbolt-v3 retains `packages/localbolt-signal` as a **native workspace crate**, not a git subtree from bolt-rendezvous.

**2026-05-16 deployment amendment:** production cloud signaling is now the
canonical `bolt-rendezvous` Fly.io app at `wss://bolt-rendezvous.fly.dev`.
`packages/localbolt-signal` remains a local compatibility wrapper covered by CI,
not the production deployment authority.

### Rationale

1. **Workspace co-versioning.** localbolt-v3 uses npm workspaces with `packages/` layout. The signal server is a first-class workspace member versioned alongside localbolt-web. Subtree injection would break this layout and create an orphaned directory with no workspace root awareness.

2. **Fly.io deployment ownership.** Originally, the production signal server was owned by localbolt-v3. That has been superseded by the 2026-05-16 amendment: production cloud signaling is the canonical `bolt-rendezvous` Fly.io app. The local v3 signal crate remains useful for compatibility testing, not production deployment ownership.

3. **Rust crate layout divergence.** `packages/localbolt-signal` is structured as a standalone Rust binary crate with its own `Cargo.toml`, `Cargo.lock`, and CI integration (the localbolt-v3 CI workflow builds and tests both the Rust signal server and the TypeScript web app). bolt-rendezvous has a different crate layout and CI pipeline. Subtree merging between divergent Rust project structures creates non-trivial merge conflicts in `Cargo.lock` and build configuration.

4. **Feature scope.** localbolt-v3's signal server includes deployment-specific features (keepalive ping handling, peer code collision detection, structured logging for Fly.io) that are product-specific, not protocol-canonical. These belong in the product repo, not upstream.

## Consequences

### Benefits

- Clean workspace layout with single `Cargo.lock` and unified CI.
- Deployment pipeline is self-contained (no cross-repo coordination for Fly.io deploys).
- Product-specific features (collision detection, structured logging) stay local.
- No subtree merge conflicts in Rust build artifacts.

### Costs

- Wire protocol changes in bolt-rendezvous must be manually propagated to localbolt-v3.
- Two sources of signaling server code exist (bolt-rendezvous canonical, localbolt-v3 native).
- Risk of silent protocol drift if upstream changes are not tracked.

## Drift Control Policy

1. **Wire protocol changes.** If bolt-rendezvous changes the signaling wire format (message types, field names, room grouping logic, or IP classification), localbolt-v3 MUST update `packages/localbolt-signal` to match within the same release cycle. Protocol conformance is verified by integration testing between peers on different server implementations.

2. **Deployment authority.** The Fly.io deployment at `wss://bolt-rendezvous.fly.dev` is owned by `bolt-rendezvous`. localbolt-v3 must treat it as the production cloud signaling endpoint and keep `packages/localbolt-signal` compatible through CI evidence.

3. **Subtree repos.** localbolt and localbolt-app MUST continue pulling bolt-rendezvous as canonical via `git subtree pull`. Both are currently aligned to bolt-rendezvous `4ea8709`. Direct modification of `signal/` in subtree repos is prohibited by the ecosystem repository-boundary policy.

4. **Audit cadence.** On any bolt-rendezvous release that touches wire protocol or IP classification logic, compare against `packages/localbolt-signal` and file a tracking issue if drift is detected.
