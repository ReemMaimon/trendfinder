# TrendFinder — Hostinger VPS setup (start to finish)

A single clean run-through. Every command is copy-paste. Do the steps in order.

**You need:** the VPS IP + root password (Hostinger → VPS), your GitHub repo URL
(public), your Supabase `DATABASE_URL`, your OpenAI API key, and your domain
(`trendfinder.online`).

---

## 0. Connect

From your PC (PowerShell):
```bash
ssh root@YOUR_VPS_IP
```
Type `yes`, paste the root password (nothing shows as you type — normal).

---

## 1. Base system (once)

```bash
apt update && apt -y upgrade
```
> If it asks about a modified `sshd_config`, choose **"keep the local version currently installed"**.

```bash
timedatectl set-timezone Asia/Jerusalem
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt -y install nodejs build-essential nginx git ufw certbot python3-certbot-nginx
npm i -g pm2
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

Check: `node -v` (v20.x), `nginx -v`, `pm2 -v`.

---

## 2. Get the code

```bash
git clone YOUR_GITHUB_REPO_URL /var/www/trendfinder
cd /var/www/trendfinder
```
(repo must be **public** — GitHub repo → Settings → Danger Zone → Change visibility)

---

## 3. Configure `.env`

```bash
cp .env.example .env
```

Now set the values with this helper (edit the 3 quoted values first):
```bash
cd /var/www/trendfinder
cat > /tmp/setenv.cjs <<'EOF'
const fs=require('fs'), bcrypt=require('bcryptjs');
const [,, KEY, DBURL, ADMINPW] = process.argv;
const pairs = {
  APP_MODE: 'TEST',
  SITE_URL: 'https://trendfinder.online',
  TIMEZONE: 'Asia/Jerusalem',
  NODE_ENV: 'production',
  DATABASE_URL: '"' + DBURL + '"',
  OPENAI_API_KEY: KEY,
  OPENAI_MODEL: 'gpt-4.1',
  OPENAI_MODEL_LIGHT: 'gpt-4.1-mini',
  AI_PROVIDER: 'openai',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD_HASH: bcrypt.hashSync(ADMINPW, 10).replace(/\$/g, '\\$'),
  SESSION_SECRET: require('crypto').randomBytes(36).toString('hex'),
  CRON_SECRET: require('crypto').randomBytes(24).toString('hex'),
  ENABLE_INPROCESS_CRON: 'true',
  CURRENCY_PROVIDER: 'erapi',
  CURRENCY_BASE: 'USD',
  CURRENCY_DISPLAY: 'ILS',
  CURRENCY_FIXED_USD_ILS: '3.7',
  LOG_LEVEL: 'info',
};
let e = fs.readFileSync('.env', 'utf8');
for (const [k, v] of Object.entries(pairs)) {
  const re = new RegExp('^' + k + '=.*$', 'm');
  e = re.test(e) ? e.replace(re, k + '=' + v) : e.trimEnd() + '\n' + k + '=' + v + '\n';
}
fs.writeFileSync('.env', e);
console.log('.env written. admin password:', ADMINPW);
console.log('CRON_SECRET:', e.match(/^CRON_SECRET=(.*)$/m)[1]);
EOF

node /tmp/setenv.cjs \
  'PASTE_OPENAI_KEY' \
  'PASTE_SUPABASE_DATABASE_URL' \
  'CHOOSE_AN_ADMIN_PASSWORD'

rm /tmp/setenv.cjs
```

**Write down the `CRON_SECRET` and admin password it prints.**

---

## 4. Build + start

```bash
cd /var/www/trendfinder
npm ci
npm run prisma:deploy
npm run db:seed
npm run build
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup    # then run the command it prints back
```

Check: `pm2 status` → `trendfinder-web` and `trendfinder-worker` both **online**.
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```
Must be `200`. If not: `pm2 logs trendfinder-web --lines 30 --nostream`.

---

## 5. DNS

At your domain registrar (Hostinger → Domains → `trendfinder.online` → DNS):

| Type | Name | Value |
|------|------|-------|
| A | `@` | YOUR_VPS_IP |
| A | `www` | YOUR_VPS_IP |

Wait ~15 min, then verify (all three must match):
```bash
curl -s ifconfig.me; echo; dig +short trendfinder.online; dig +short www.trendfinder.online
```

---

## 6. nginx

```bash
cp /var/www/trendfinder/deploy/nginx.conf.example /etc/nginx/sites-available/trendfinder
sed -i 's/your-domain\.com/trendfinder.online/g' /etc/nginx/sites-available/trendfinder
ln -sf /etc/nginx/sites-available/trendfinder /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```
`nginx -t` must say **test is successful**.

Now `http://trendfinder.online` should show the site.

---

## 7. HTTPS

Only after step 5 shows matching IPs and step 6 works:
```bash
certbot --nginx -d trendfinder.online -d www.trendfinder.online
```
Enter your email, agree, and choose **2 (redirect HTTP→HTTPS)** when asked.

Now `https://trendfinder.online` works. 🎉

---

## 8. First products

```bash
cd /var/www/trendfinder && npm run generate:now -- --force
```
(The worker also does this automatically every day at 00:00 Asia/Jerusalem.)

---

## Everyday operations

| Task | Command |
|------|---------|
| Deploy code changes | `cd /var/www/trendfinder && git pull && bash scripts/deploy.sh` |
| Restart after `.env` edit | `pm2 restart all` |
| See logs | `pm2 logs` |
| Generate + publish now | `cd /var/www/trendfinder && npm run generate:now -- --force` |
| Change admin password | re-run the `/tmp/setpw.cjs` snippet from the README |
| Check status | `pm2 status` |

## `.env` rules (these bite people)

- **No spaces** around `=`  →  `KEY=value` not `KEY = value`
- **`ADMIN_PASSWORD_HASH`**: every `$` must be written as `\$`
- **After ANY change**: `pm2 restart all`
- Never commit `.env` (it's gitignored — keep it that way)

## Do NOT switch to PRODUCTION mode

until you have an approved AliExpress affiliate account and `ALIEXPRESS_AFFILIATE_ID`
in `.env`. PRODUCTION without it = the site publishes nothing (by design — it
won't emit fake affiliate links).
