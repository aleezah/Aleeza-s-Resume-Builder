#!/bin/bash
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Job Application Tool..."
echo ""

# Start server
npm run dev &
SERVER_PID=$!

# Wait then open browser
sleep 4
open http://localhost:5173

echo "App running at http://localhost:5173"
echo "Press Ctrl+C to stop."

wait $SERVER_PID
