# LocalBolt v3 Changelog

## Current Web Line

- LocalBolt v3 is the hosted browser product at `localbolt.app`.
- The active code lives under `packages/*`.
- Native/mobile shells live in `localbolt-app`; v3 remains web-only.
- The browser packages expose the web app, browser transport, and shared
  app-layer orchestration surfaces.

## EA Trust Gate

- Product-facing verified-device behavior is locked until EA1 completes outside
  cryptographer/formal-methods review, wire-freeze, spec update, and
  implementation authorization.
- The web product may describe encrypted transfers and user-approved sessions.
  It must not claim MITM-proof verified pairing.

## Repository Cleanup

- Removed the old native scaffold from the active tree.
- Kept v3 focused on hosted web delivery and browser packages.
