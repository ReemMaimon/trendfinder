# Deploying TrendFinder on a Hostinger VPS

Target: Hostinger **VPS** (KVM), Ubuntu 22.04+, with root/sudo. This is the
setup the app is designed for: a persistent Node process, real cron, and
PostgreSQL.

> Shared "Web Hosting" plans cannot run a long-lived Node server or the
> node-cron worker reliably. If you must use one with the Node.js selector,
> run the Next.js app via the selector, set `ENABLE_INPROCESS_CRON=false`, and
> drive generation from hPanel → Cron Jobs hitting `POST /api/cron/generate`
> (see `deploy/crontab.example`). Use MySQL instead of PostgreSQL by changing
> the Prisma `datasource` provider.

---

## 1. Provision

```bash
sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone Asia/Jerusalem

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs build-essential nginx

# PostgreSQL
sudo apt -y install postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER trendfinder WITH PASSWORD 'STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE trendfinder OWNER trendfinder;"

# PM2
sudo npm i -g pm2
```

## 2. Get the code

```bash
sudo mkdir -p /var/www && sudo chown $USER /var/www
cd /var/www
git clone <your-repo-url> trendfinder && cd trendfinder
npm ci
```

## 3. Configure

```bash
cp .env.example .env
nano .env
```

Minimum for a first (TEST-mode) deploy:

```
APP_MODE=TEST
SITE_URL=https://your-domain.com
TIMEZONE=Asia/Jerusalem
NODE_ENV=production
DATABASE_URL=postgresql://trendfinder:STRONG_PASSWORD@localhost:5432/trendfinder?schema=public
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<npx tsx scripts/hash-password.ts 'your-password'>
SESSION_SECRET=<openssl rand -base64 48>
CRON_SECRET=<openssl rand -base64 24>
ENABLE_INPROCESS_CRON=true
```

Affiliate vars stay blank until your AliExpress affiliate account is approved.

## 4. Build & migrate

```bash
npm run prisma:deploy
npm run db:seed
npm run build
```

## 5. Start with PM2

```bash
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup            # run the command it prints
pm2 logs               # verify web + worker are healthy
```

`trendfinder-worker` runs the daily job at 00:00 Asia/Jerusalem and also does a
catch-up check on boot (in case the VPS was down at midnight).

## 6. nginx + TLS

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/trendfinder
sudo nano /etc/nginx/sites-available/trendfinder   # set server_name
sudo ln -s /etc/nginx/sites-available/trendfinder /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 7. (Optional) HTTP cron backup

Even with the worker running, a system cron backup is cheap insurance
(generation is idempotent):

```bash
crontab -e
```

```
CRON_TZ=Asia/Jerusalem
5 0 * * * curl -fsS -m 300 -X POST https://your-domain.com/api/cron/generate -H "x-cron-secret: YOUR_CRON_SECRET" >> /var/www/trendfinder/logs/cron.log 2>&1
```

## 8. First run

```bash
# generate today's set immediately instead of waiting for 00:00
curl -X POST https://your-domain.com/api/cron/generate -H "x-cron-secret: YOUR_CRON_SECRET"
```

Then open `https://your-domain.com` and `https://your-domain.com/admin`.

## 9. Updates

```bash
cd /var/www/trendfinder
git pull
npm ci
npm run prisma:deploy
npm run build
pm2 reload ecosystem.config.cjs
```

## 10. Going to PRODUCTION (affiliate)

1. Add `ALIEXPRESS_AFFILIATE_ID` (+ key/secret if `strategy=portals`) to `.env`.
2. `pm2 reload ecosystem.config.cjs`.
3. Admin → Dashboard → **מעבר ל-PRODUCTION** (blocked if config is incomplete).
4. Re-generate or re-publish the day's set. New sets now publish with affiliate
   links; the switch is invisible to users.

## Backups

```bash
# nightly DB dump
0 3 * * * pg_dump -U trendfinder trendfinder | gzip > /var/backups/trendfinder-$(date +\%F).sql.gz
```
