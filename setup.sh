#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "--with-local-whisper" ]; then
  node scripts/setup.mjs --with-local-whisper
else
  node scripts/setup.mjs
fi
