#!/usr/bin/env bash
set -euo pipefail
cd /home/ichabod/apps/holes-and-stars
mkdir -p tests/artifacts
docker run --rm --memory=512m --cpus=1 --network ichabod-proxy \
  -e STAGE="${1:?stage required}" -e TEST_URL="${2:-http://holes-and-stars-preview:3000}" \
  -v "$PWD:/repo" -w /tmp/check mcr.microsoft.com/playwright:v1.55.0-noble \
  bash -lc 'npm install --no-audit --no-fund playwright-core@1.55.0 >&2 && NODE_PATH=/tmp/check/node_modules node /repo/tests/ui.cjs'
