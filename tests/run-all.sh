#!/bin/sh
# Runs the whole portable QA suite sequentially (software-GL Chromium via Playwright). Needs: node 22, playwright, .qa-cache/three (npm pack three@0.160.0), server/ deps (cd server && npm i).
# Usage: sh tests/run-all.sh   -> prints PASS/FAIL per test; exit code = number of failures. Evidence lands in tests/out/.
cd "$(dirname "$0")/.." || exit 1
[ -f .qa-cache/three/package/build/three.module.js ] || { mkdir -p .qa-cache/three && (cd .qa-cache/three && npm pack three@0.160.0 >/dev/null && tar xzf three-0.160.0.tgz); }
fail=0
run() { name="$1"; shift; if timeout 1500 "$@" > "tests/out/$name.log" 2>&1; then echo "PASS  $name"; else echo "FAIL  $name  (see tests/out/$name.log)"; fail=$((fail+1)); fi; }
mkdir -p tests/out
run static-od node tests/static.mjs od --json
run selftest node tests/t-selftest.cjs
run salt node tests/t-salt.cjs
run homeportal node tests/t-homeportal.cjs
run homebase node tests/t-homebase.cjs
run leak node tests/t-leak.cjs nostalgia-overdose 3
run route-od node tests/t-route.cjs nostalgia-overdose
run net2 node tests/t-net2.cjs
run arena-net2 node tests/t-arena-net2.cjs
run match node tests/t-match.cjs
echo "failures: $fail"; exit $fail
