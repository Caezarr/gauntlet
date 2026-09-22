#!/usr/bin/env bash
# CLI contract smoke — help/argv only, never launches Claude.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[gauntlet-smoke] help"
npx tsx src/index.ts --help >/dev/null
for cmd in design build review security bugfinder status; do
  echo "[gauntlet-smoke] $cmd --help"
  npx tsx src/index.ts "$cmd" --help >/dev/null
done

echo "[gauntlet-smoke] review without --project should fail"
if npx tsx src/index.ts review >/dev/null 2>&1; then
  echo "expected non-zero exit" >&2
  exit 1
fi

echo "[gauntlet-smoke] ok"
