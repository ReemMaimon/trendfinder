#!/usr/bin/env bash
# One-time setup for a fresh Hostinger VPS (Ubuntu 22.04/24.04).
# Run as a sudo-capable user:  bash scripts/server-setup.sh
set -euo pipefail

echo "==> System update"
sudo apt update && sudo apt -y upgrade

echo "==> Timezone -> Asia/Jerusalem"
sudo timedatectl set-timezone Asia/Jerusalem

echo "==> Node.js 20 LTS + build tools + nginx"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs build-essential nginx git ufw

echo "==> PM2 (process manager)"
sudo npm i -g pm2

echo "==> Firewall (allow SSH + HTTP + HTTPS)"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo
echo "Done. Versions:"
node -v; npm -v; nginx -v
echo
echo "Next: clone your repo into /var/www/trendfinder and run scripts/deploy.sh"
