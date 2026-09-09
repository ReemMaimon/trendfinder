#!/usr/bin/env bash
# Deploy / update TrendFinder on the VPS. Run from the project root:
#   bash scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env is missing. Copy .env.example to .env and fill it in first."
  exit 1
fi

echo "==> Pull latest code"
git pull --ff-only

echo "==> Install dependencies"
npm ci

echo "==> Apply database migrations"
npm run prisma:deploy

echo "==> Seed settings singleton (idempotent)"
npm run db:seed

echo "==> Build"
npm run build

echo "==> (Re)start PM2 processes"
if pm2 describe trendfinder-web > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs
else
  mkdir -p logs
  pm2 start ecosystem.config.cjs
  pm2 save
fi

pm2 status
echo
echo "Done. Site: \$SITE_URL   Admin: \$SITE_URL/admin"
