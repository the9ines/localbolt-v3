FROM rust:1.85-slim AS builder
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY Cargo.toml ./
COPY src/ src/
# Strip dev-dependencies — path deps are unavailable in Docker build context
# and are not needed for the release binary build.
RUN awk '/^\[dev-dependencies\]/{skip=1;next} /^\[/{skip=0} !skip' Cargo.toml > Cargo.toml.tmp && mv Cargo.toml.tmp Cargo.toml
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/localbolt-signal /usr/local/bin/
EXPOSE 3001
CMD ["localbolt-signal"]
