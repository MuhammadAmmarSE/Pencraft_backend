#!/bin/bash
# deploy.sh
# Run from EC2: bash /var/www/copyai/deploy/scripts/deploy.sh
# Pulls latest code, rebuilds, and restarts both services with zero downtime

set -e  # Exit immediately on any error

APP_DIR="/var/www/copyai"
LOG_DIR="/var/log/copyai"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CopyAI Deploy — $TIMESTAMP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── Step 1: Pull latest code ──────────────────────────────────────────────
echo "→ Pulling latest code..."
cd "$APP_DIR"
git pull origin main
echo "✓ Code updated"

# ─── Step 2: Backend build ─────────────────────────────────────────────────
echo ""
echo "→ Building backend..."
cd "$APP_DIR/backend"
npm install --production=false  # Install all deps (including devDeps for build)
npm run build                   # Compile TypeScript → dist/
echo "✓ Backend built"

# ─── Step 3: Frontend build ────────────────────────────────────────────────
echo ""
echo "→ Building frontend..."
cd "$APP_DIR/frontend"
npm install
npm run build                   # Next.js production build
echo "✓ Frontend built"

# ─── Step 4: Restart services with PM2 (zero downtime) ────────────────────
echo ""
echo "→ Reloading services..."
cd "$APP_DIR"

# pm2 reload does a rolling restart — no downtime
pm2 reload ecosystem.config.js --env production

echo "✓ Services reloaded"

# ─── Step 5: Health check ──────────────────────────────────────────────────
echo ""
echo "→ Running health check..."
sleep 3  # Give processes a moment to stabilize

API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/health 2>/dev/null || echo "000")
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")

if [ "$API_STATUS" = "200" ]; then
  echo "✓ API is healthy (HTTP $API_STATUS)"
else
  echo "⚠ API returned HTTP $API_STATUS — check logs: pm2 logs copyai-api"
fi

if [ "$WEB_STATUS" = "200" ]; then
  echo "✓ Frontend is healthy (HTTP $WEB_STATUS)"
else
  echo "⚠ Frontend returned HTTP $WEB_STATUS — check logs: pm2 logs copyai-web"
fi

# ─── Step 6: Save PM2 state ────────────────────────────────────────────────
pm2 save
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploy complete ✓"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
