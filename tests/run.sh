#!/bin/bash
# Runs every test. The two-phone tests use a local Firebase database emulator;
# nothing here touches the real database.
#
# Needs: Node with Playwright, Java, and the Firebase CLI (`npm install firebase-tools`).
# Point FIREBASE_BIN at the CLI if it is not on your PATH.
# Pass the names of two-phone tests (rooms, play, wires, ...) to run only those.
set -e
cd "$(dirname "$0")/.."
FIREBASE_BIN="${FIREBASE_BIN:-firebase}"
ONLY="${*:-rooms play wires map spot draw story lighthouse}"

node tools/stamp.js --check
for unit in tests/*.unit.test.js; do node "$unit"; done
node tests/offline.test.js

STEPS=""
for name in $ONLY; do STEPS="$STEPS${STEPS:+ && }node tests/$name.test.js"; done
CI=true "$FIREBASE_BIN" emulators:exec \
  --config tests/firebase.json --only database --project demo-split-clues \
  "$STEPS"
