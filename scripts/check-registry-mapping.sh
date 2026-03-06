#!/usr/bin/env bash
set -euo pipefail

# D5 — Ensures @the9ines scope resolves from registry.npmjs.org (PAT-free path).
# Prevents regression to npm.pkg.github.com which requires PAT for all installs.

NPMRC_FILES=(".npmrc" "packages/localbolt-web/.npmrc")
FAIL=0

for f in "${NPMRC_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f not found"
    FAIL=1
    continue
  fi

  # Must contain the npmjs.org registry mapping
  if grep -q '@the9ines:registry=https://registry.npmjs.org' "$f"; then
    echo "PASS: $f maps @the9ines to registry.npmjs.org"
  else
    echo "FAIL: $f does not map @the9ines to registry.npmjs.org"
    echo "      Expected: @the9ines:registry=https://registry.npmjs.org"
    FAIL=1
  fi

  # Must NOT contain GitHub Packages registry
  if grep -q 'npm.pkg.github.com' "$f"; then
    echo "FAIL: $f still references npm.pkg.github.com (PAT-required)"
    FAIL=1
  fi

  # Must NOT contain _authToken references (PAT dependency)
  if grep -q '_authToken' "$f"; then
    echo "FAIL: $f contains _authToken reference (PAT dependency)"
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo "Registry mapping guard failed. @the9ines packages must resolve from"
  echo "registry.npmjs.org without PAT. See D-STREAM-1 D4/D5 governance."
  exit 1
fi
