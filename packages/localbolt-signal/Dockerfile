FROM rust:1.85-slim AS builder
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY Cargo.toml ./
COPY src/ src/
# ── Dev-dependency stripping (S0 build-context workaround) ──────────────
# WHY:  Cargo resolves ALL dependencies (including dev-deps) during lockfile
#       generation. The dev-dep `bolt-core = { path = "..." }` references a
#       sibling repo path that does not exist inside the Docker build context.
#       Dev-deps are NOT needed for `cargo build --release` (only for tests).
# WHAT: Strips the entire [dev-dependencies] section from Cargo.toml before
#       building. The awk script skips lines from [dev-dependencies] until the
#       next [section] header.
# USED BY: Docker builds (local, CI, Fly.io remote builders).
# IF DEV-DEPS CHANGE: No action needed — the awk pattern strips the entire
#       section regardless of content. Only breaks if a new non-dev section is
#       added without a [header] separator.
RUN awk '/^\[dev-dependencies\]/{skip=1;next} /^\[/{skip=0} !skip' Cargo.toml > Cargo.toml.tmp && mv Cargo.toml.tmp Cargo.toml
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/localbolt-signal /usr/local/bin/
EXPOSE 3001
CMD ["localbolt-signal"]
