#!/bin/bash
# run-tests.sh — Runs the test suite, suppressing JSDOM CSS warnings.
# Usage: npm test  (or npm run test:watch)

WATCH=""
for arg in "$@"; do
  case "$arg" in
    --watch) WATCH="--watch" ;;
  esac
done

exec node --test ${WATCH} -- tests/**/*.test.js 2>&1 | grep -vE "Could not load link|Can't fetch.*css|Can('t|'')t fetch.*css|Can not load"
