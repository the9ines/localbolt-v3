#!/usr/bin/env bash
set -euo pipefail

# C6 — Prevents reintroduction of ad-hoc orchestration patterns that belong
# in @the9ines/localbolt-core.
#
# Usage:
#   bash scripts/check-core-drift.sh                          (default: packages/localbolt-web/src)
#   bash scripts/check-core-drift.sh packages/localbolt-web/src  (explicit)
#
# Note: localbolt-v3 is the origin workspace for @the9ines/localbolt-core.
# Consumer-style guards (version-pin, single-install) are NOT applicable here
# because localbolt-core is resolved via npm workspace, not registry install.
# Only the drift check applies — it detects ad-hoc reimplementation in the
# web consumer that should live in localbolt-core.

SRC_DIR="${1:-packages/localbolt-web/src}"
EXIT=0

echo "--- Ad-hoc orchestration drift check ($SRC_DIR) ---"

# 1) Check for direct store.setState calls that reset isConnected to false
#    (should use resetSession() from localbolt-core instead)
#    Excludes test files.
if grep -rn 'isConnected: false' "$SRC_DIR" --include='*.ts' --include='*.tsx' \
   | grep -v '__tests__' | grep -v '\.test\.' | grep 'store\.setState'; then
  echo "FAIL: ad-hoc store.setState({ isConnected: false }) found outside tests"
  echo "      Use resetSession() from @the9ines/localbolt-core instead"
  EXIT=1
else
  echo "PASS: no ad-hoc isConnected reset patterns"
fi

# 2) Check for inline session phase definitions (should come from localbolt-core)
if grep -rn "type SessionPhase" "$SRC_DIR" --include='*.ts' --include='*.tsx' \
   | grep -v '__tests__' | grep -v '\.test\.' | grep -v 'node_modules'; then
  echo "FAIL: local SessionPhase type definition found"
  echo "      Import from @the9ines/localbolt-core instead"
  EXIT=1
else
  echo "PASS: no local session phase definitions"
fi

# 3) Check for inline transfer policy reimplementation
if grep -rn "function isTransferAllowed\|const isTransferAllowed" "$SRC_DIR" --include='*.ts' --include='*.tsx' \
   | grep -v '__tests__' | grep -v '\.test\.' | grep -v 'node_modules'; then
  echo "FAIL: local isTransferAllowed implementation found"
  echo "      Import from @the9ines/localbolt-core instead"
  EXIT=1
else
  echo "PASS: no local transfer policy reimplementation"
fi

# 4) Check for inline generation counter management
if grep -rn "let generation" "$SRC_DIR" --include='*.ts' --include='*.tsx' \
   | grep -v '__tests__' | grep -v '\.test\.' | grep -v 'node_modules'; then
  echo "FAIL: local generation counter found"
  echo "      Use getGeneration/isCurrentGeneration from @the9ines/localbolt-core"
  EXIT=1
else
  echo "PASS: no local generation counter"
fi

if [ "$EXIT" -eq 0 ]; then
  echo "--- All orchestration drift checks PASSED ---"
fi

exit "$EXIT"
