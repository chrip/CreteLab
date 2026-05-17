#!/bin/bash
# Rebuild and serve locally for testing.
# Usage: ./scripts/start.sh

set -e
cd "$(dirname "$0")/.."

echo "Building..."
node scripts/render.js

echo ""
echo "Serving at http://localhost:8888"
echo "  /de/        → German index"
echo "  /en/        → English index"
echo "  /de/uhpc/   → German UHPC"
echo "  /en/fine-tune/  → English Fine-Tune"
echo ""
echo "Press Ctrl+C to stop."
exec python3 -m http.server 8888 --directory build
