# CopyAI — EC2 Production Deployment Guide

Complete setup from a fresh EC2 instance to a running production app.
Covers: server setup, MySQL, Node.js, Nginx, SSL, PM2, environment, and cron monitoring.

---

## EC2 Instance Requirements

- **Instance type**: t3.small (recommended) or t3.micro (tight but workable)
- **OS**: Ubuntu 22.04 LTS
- **Storage**: 20GB gp3 SSD minimum
- **Security Group inbound rules**:

| Port | Protocol | Source      | Purpose                    |
|------|----------|-------------|----------------------------|
| 22   | TCP      | Your IP     | SSH access                 |
| 80   | TCP      | 0.0.0.0/0   | HTTP (redirects to HTTPS)  |
| 443  | TCP      | 0.0.0.0/0   | HTTPS — app traffic        |

**Do NOT open ports 3000 or 3001 to the internet.**
Nginx proxies all traffic internally.

---

## Part 1 — Initial Server Setup

SSH into your EC2 instance:

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 1.1 Update system packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip build-essential
```

### 1.2 Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # Should print v20.x.x
npm --version    # Should print 10.x.x
```

### 1.3 Install PM2 globally

```bash
sudo npm install -g pm2
pm2 --version
```

### 1.4 Install MySQL 8

```bash
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql

# Secure MySQL installation
sudo mysql_secure_installation
# Set root password, remove anonymous users, disallow remote root login
```

### 1.5 Create the database and user

```bash
sudo mysql -u root -p
```

Inside MySQL shell:

```sql
CREATE DATABASE shopify_ai_copywriter
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'copyai'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON shopify_ai_copywriter.* TO 'copyai'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 1.6 Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
nginx -v
```

### 1.7 Install Certbot for SSL

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## Part 2 — Deploy Application Code

### 2.1 Create app directory

```bash
sudo mkdir -p /var/www/copyai
sudo chown ubuntu:ubuntu /var/www/copyai
mkdir -p /var/log/copyai
```

### 2.2 Clone your repository

```bash
cd /var/www/copyai
git clone https://github.com/YOUR_USERNAME/shopify-ai-copywriter.git .
# Or use git init + git remote add + git pull if not on GitHub yet
```

### 2.3 Set up backend environment

```bash
cd /var/www/copyai/backend
cp .env.example .env
nano .env
```

Fill in every value:

```env
NODE_ENV=production
PORT=3001
APP_URL=https://your-domain.com

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=copyai
DB_PASSWORD=STRONG_PASSWORD_HERE
DB_NAME=shopify_ai_copywriter

SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_SCOPES=read_products,write_products
SHOPIFY_HOST_NAME=your-domain.com

ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

JWT_SECRET=generate_64_char_random_string_here
JWT_EXPIRES_IN=7d

THROTTLE_TTL=60
THROTTLE_LIMIT=30

FREE_PLAN_REWRITES=5
STARTER_PLAN_REWRITES=100
GROWTH_PLAN_REWRITES=500
PRO_PLAN_REWRITES=99999

# Admin key for manual cron triggers
ADMIN_SECRET_KEY=generate_another_random_string_here
```

Generate secure random strings:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.4 Set up frontend environment

```bash
cd /var/www/copyai/frontend
cp .env.example .env.local
nano .env.local
```

```env
NEXT_PUBLIC_API_URL=https://your-domain.com/api/v1
NEXT_PUBLIC_SHOPIFY_API_KEY=your_shopify_api_key
```

### 2.5 Install dependencies and build

```bash
# Backend
cd /var/www/copyai/backend
npm install
npm run build

# Frontend
cd /var/www/copyai/frontend
npm install
npm run build
```

---

## Part 3 — Nginx Configuration

### 3.1 Copy Nginx config

```bash
sudo cp /var/www/copyai/deploy/nginx/copyai.conf /etc/nginx/sites-available/copyai
```

### 3.2 Edit domain name

```bash
sudo nano /etc/nginx/sites-available/copyai
# Replace all occurrences of "your-domain.com" with your actual domain
```

### 3.3 Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/copyai /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default  # Remove default site
sudo nginx -t                                 # Test config — must say "ok"
sudo systemctl reload nginx
```

### 3.4 Point your domain to EC2

In your domain registrar (GoDaddy or WebHostingPad):

```
A record: @ → your-ec2-public-ip
A record: www → your-ec2-public-ip
```

Wait 2-5 minutes for DNS to propagate, then verify:

```bash
curl -I http://your-domain.com
# Should return 301 redirect (we haven't set SSL yet)
```

### 3.5 Issue SSL certificate

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
# Follow prompts — choose redirect HTTP to HTTPS (option 2)
```

Certbot auto-renews via a system timer. Verify:

```bash
sudo certbot renew --dry-run
```

---

## Part 4 — Start Application with PM2

### 4.1 Copy ecosystem config

```bash
cp /var/www/copyai/deploy/ecosystem.config.js /var/www/copyai/ecosystem.config.js
```

### 4.2 Start both services

```bash
cd /var/www/copyai
pm2 start ecosystem.config.js --env production
pm2 status
```

You should see both `copyai-api` and `copyai-web` with status `online`.

### 4.3 Save PM2 state and enable startup

```bash
pm2 save
pm2 startup
# PM2 will print a command — copy and run it
# It looks like: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Run the printed command — this makes PM2 restart on server reboot automatically.

### 4.4 Verify everything is running

```bash
# Check API health
curl https://your-domain.com/api/v1/health
# Should return: {"status":"ok","db":"connected",...}

# Check frontend
curl -I https://your-domain.com
# Should return: HTTP/2 200

# Check PM2 logs
pm2 logs copyai-api --lines 50
pm2 logs copyai-web --lines 50
```

---

## Part 5 — Cron Job Verification

The NestJS scheduler runs inside the app process (managed by PM2).
No separate crontab needed — it starts automatically with the app.

### 5.1 Verify crons are registered

```bash
pm2 logs copyai-api --lines 100 | grep -i "cron\|scheduler\|reset"
```

On startup you should see logs like:
```
Scheduler Module initialized
Monthly usage reset job registered — runs at 0 0 1 * * (UTC)
Daily billing cycle check registered — runs at 0 2 * * * (UTC)
Weekly health check registered — runs at 0 3 * * 0 (UTC)
```

### 5.2 Manual trigger — test the reset without waiting

```bash
curl -X POST https://your-domain.com/api/v1/admin/scheduler/reset \
  -H "x-admin-key: YOUR_ADMIN_SECRET_KEY" \
  -H "Content-Type: application/json"
# Returns: {"success":true,"message":"X shop(s) reset successfully"}
```

Test against a single shop:

```bash
curl -X POST "https://your-domain.com/api/v1/admin/scheduler/reset?shop=store.myshopify.com" \
  -H "x-admin-key: YOUR_ADMIN_SECRET_KEY"
```

Run the subscription health check:

```bash
curl -X POST https://your-domain.com/api/v1/admin/scheduler/health-check \
  -H "x-admin-key: YOUR_ADMIN_SECRET_KEY"
```

### 5.3 Cron schedule reference

| Job | Schedule | What it does |
|-----|----------|-------------|
| monthly-usage-reset | 1st of month, midnight UTC | Resets `monthlyRewrites` for all active shops. Verifies paid subscriptions are still active before resetting. Auto-downgrades if subscription is cancelled/expired. |
| daily-cycle-check | Daily 2am UTC | Finds shops whose billing cycle started on today's date (e.g. upgraded on the 15th → resets on the 15th each month). |
| weekly-subscription-health-check | Every Sunday 3am UTC | Audits all paid subscriptions against Shopify live status. Catches any billing drift that webhooks may have missed. Auto-downgrades stale subscriptions. |

---

## Part 6 — Ongoing Operations

### Deploy updates

```bash
bash /var/www/copyai/deploy/scripts/deploy.sh
```

The script: pulls latest code → builds backend → builds frontend → pm2 reload (zero downtime) → health check.

### View live logs

```bash
pm2 logs                      # All processes
pm2 logs copyai-api           # API only
pm2 logs copyai-web           # Frontend only
pm2 logs copyai-api --lines 200 --nostream  # Last 200 lines, no tail
```

### Monitor process health

```bash
pm2 monit                     # Live dashboard in terminal
pm2 status                    # Current status of all processes
```

### Restart / reload

```bash
pm2 reload copyai-api         # Zero-downtime reload (cluster mode)
pm2 restart copyai-web        # Hard restart (brief downtime)
pm2 restart all               # Restart everything
```

### MySQL operations

```bash
# Connect to DB
mysql -u copyai -p shopify_ai_copywriter

# Quick stats
SELECT plan, COUNT(*) as shops, SUM(monthly_rewrites) as total_rewrites
FROM shops
WHERE status = 'active'
GROUP BY plan;

# Check recent jobs
SELECT shop_id, product_title, status, created_at
FROM rewrite_jobs
ORDER BY created_at DESC
LIMIT 20;
```

### View Nginx logs

```bash
sudo tail -f /var/log/nginx/copyai.access.log
sudo tail -f /var/log/nginx/copyai.error.log
```

### Disk space check

```bash
df -h                         # Overall disk usage
du -sh /var/log/copyai/*      # App log sizes
pm2 flush                     # Clear PM2 logs if they grow large
```

---

## Part 7 — Register Shopify Webhooks

In your Shopify Partner Dashboard → App → Webhooks, register:

| Event | URL |
|-------|-----|
| App uninstalled | `https://your-domain.com/api/v1/auth/webhooks/uninstall` |
| App subscription updated | `https://your-domain.com/api/v1/billing/webhooks/subscription-update` |

Both endpoints verify HMAC signatures using `SHOPIFY_API_SECRET`.

---

## Part 8 — Final Checklist Before Going Live

```
[ ] EC2 security group: only ports 22, 80, 443 open
[ ] .env files filled in — no placeholder values remaining
[ ] NODE_ENV=production in backend .env
[ ] SSL certificate issued and auto-renewal tested
[ ] PM2 startup command run — survives server reboot
[ ] Health endpoint returns {"status":"ok","db":"connected"}
[ ] Manual cron trigger tested
[ ] Both Shopify webhooks registered
[ ] Shopify Partner Dashboard: App URL and Redirect URL set to your domain
[ ] Test install flow on a Shopify development store
[ ] Test billing flow end-to-end (test mode — no real charges)
[ ] pm2 save run after confirming everything is stable
```

---

## Quick Reference

```bash
# Health check
curl https://your-domain.com/api/v1/health

# Deploy
bash /var/www/copyai/deploy/scripts/deploy.sh

# Logs
pm2 logs copyai-api --lines 100

# Manual usage reset (all shops)
curl -X POST https://your-domain.com/api/v1/admin/scheduler/reset \
  -H "x-admin-key: YOUR_ADMIN_SECRET_KEY"

# Restart everything
pm2 restart all && pm2 save

# Renew SSL
sudo certbot renew
```
