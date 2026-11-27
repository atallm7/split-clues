#!/bin/bash
# Runs the two-phone tests against a local Firebase database emulator.
# Nothing here touches the real database.
#
# Needs: Node with Playwright, Java, and the Firebase CLI (`npm install firebase-tools`).
# Point FIREBASE_BIN at the CLI if it is not on your PATH.
set -e
cd "$(dirname "$0")/.."
FIREBASE_BIN="${FIREBASE_BIN:-firebase}"
node tools/stamp.js --check
node tests/offline.test.js
CI=true "$FIREBASE_BIN" emulators:exec \
  --config tests/firebase.json --only database --project demo-split-clues \
  "node tests/two-phones.test.js $*"
