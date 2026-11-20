#!/bin/bash
set -m

PORT="${PORT:-3001}"
CLOUDFLARE_URL_FILE="/tmp/cloudflare_url.txt"
LHR_URL_FILE="/tmp/lhr_url.txt"
rm -f "$CLOUDFLARE_URL_FILE" "$LHR_URL_FILE"

echo "[Supervisor] Starting resilient dual-tunnel setup on port $PORT (Cloudflare HTTP/2 + localhost.run failover)..."

# 1. Start Cloudflare Tunnel with default high-stability QUIC protocol
run_cloudflared() {
  while true; do
    echo "[Cloudflare] Launching tunnel for port $PORT..."
    cloudflared tunnel --url "http://127.0.0.1:$PORT" 2>&1 | while read -r line; do
      echo "$line"
      if echo "$line" | grep -q "trycloudflare.com"; then
        url=$(echo "$line" | grep -o "https://[a-zA-Z0-9.-]*\.trycloudflare\.com" | head -n 1)
        if [ -n "$url" ]; then
          echo "$url" > "$CLOUDFLARE_URL_FILE"
          echo "[Cloudflare] URL Registered: $url"
        fi
      fi
    done
    echo "[Cloudflare] Tunnel exited, restarting in 2 seconds..."
    sleep 2
  done
}

# 2. Start localhost.run SSH tunnel with TCP keepalive
run_lhr() {
  while true; do
    echo "[LocalhostRun] Launching SSH tunnel for port $PORT..."
    ssh -o StrictHostKeyChecking=no \
        -o ServerAliveInterval=10 \
        -o ServerAliveCountMax=3 \
        -o ExitOnForwardFailure=yes \
        -R 80:127.0.0.1:$PORT \
        nokey@localhost.run 2>&1 | while read -r line; do
      echo "$line"
      if echo "$line" | grep -q "lhr.life"; then
        url=$(echo "$line" | grep -o "https://[a-zA-Z0-9.-]*\.lhr\.life" | head -n 1)
        if [ -n "$url" ]; then
          echo "$url" > "$LHR_URL_FILE"
          echo "[LocalhostRun] URL Registered: $url"
        fi
      fi
    done
    echo "[LocalhostRun] SSH tunnel exited, restarting in 3 seconds..."
    sleep 3
  done
}

run_cloudflared &
PID_CF=$!

run_lhr &
PID_LHR=$!

# 3. Heartbeat keepalive daemon (pings /api/health every 12s to prevent edge timeouts)
while true; do
  sleep 12
  if [ -f "$CLOUDFLARE_URL_FILE" ]; then
    cf_url=$(cat "$CLOUDFLARE_URL_FILE")
    if [ -n "$cf_url" ]; then
      curl -s -o /dev/null -m 5 "$cf_url/api/health" || true
    fi
  fi
done
