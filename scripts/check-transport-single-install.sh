#!/usr/bin/env bash
set -euo pipefail

# Phase 4H — Ensures exactly one instance of @the9ines/bolt-transport-web is installed
# and its version matches .transport-web-version.
# For localbolt-v3: run from workspace root. Walks full JSON tree to find nested instances.

VERSION_FILE=".transport-web-version"
PKG="@the9ines/bolt-transport-web"

if [ ! -f "$VERSION_FILE" ]; then
  echo "FAIL: $VERSION_FILE not found"
  exit 1
fi

EXPECTED=$(tr -d '[:space:]' < "$VERSION_FILE")

JSON=$(npm ls "$PKG" --json 2>/dev/null || true)

# Count resolved instances at any depth in the dependency tree
VERSIONS=$(node -e "
  const data = JSON.parse(process.argv[1]);
  const versions = [];
  function walk(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.dependencies) {
      for (const [name, dep] of Object.entries(obj.dependencies)) {
        if (name === '$PKG' && dep.version) versions.push(dep.version);
        walk(dep);
      }
    }
  }
  walk(data);
  console.log(JSON.stringify(versions));
" "$JSON")

COUNT=$(node -e "console.log(JSON.parse(process.argv[1]).length)" "$VERSIONS")
INSTALLED=$(node -e "const v = JSON.parse(process.argv[1]); if (v.length > 0) console.log(v[0]); else console.log('NONE')" "$VERSIONS")

EXIT=0

if [ "$COUNT" -eq 0 ]; then
  echo "FAIL: $PKG not found in node_modules"
  EXIT=1
elif [ "$COUNT" -gt 1 ]; then
  echo "FAIL: $COUNT instances of $PKG found (expected 1)"
  echo "      Versions: $VERSIONS"
  EXIT=1
else
  echo "PASS: single instance of $PKG installed"
fi

if [ "$INSTALLED" != "$EXPECTED" ]; then
  echo "FAIL: installed version \"$INSTALLED\" != expected \"$EXPECTED\" (from $VERSION_FILE)"
  EXIT=1
else
  echo "PASS: version $INSTALLED matches $VERSION_FILE"
fi

exit "$EXIT"
