#!/bin/bash

if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

echo "Starting Obsidian Tunnel server..."
npm start &
SERVER_PID=$!

echo "Starting Cloudflare tunnel..."
cloudflared tunnel run obsidianme &
TUNNEL_PID=$!

echo ""
echo "Server PID: $SERVER_PID"
echo "Tunnel PID: $TUNNEL_PID"
echo ""
echo "Local:  http://localhost:${PORT:-3334}"
echo "Remote: https://${CLOUDFLARE_HOSTNAME}"
echo ""
echo "Press Ctrl+C to stop both services"

wait
