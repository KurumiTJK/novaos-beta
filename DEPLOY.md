# NovaOS Deployment Guide

## What You'll Have When Done

```
Your Phone → yourdomain.com → Cloudflare → Lightsail Server → Your App
```

---

## Step 1: Create External Services (Free Tiers)

### 1a. Upstash Redis
1. Go to https://upstash.com
2. Create account
3. Create a new Redis database
4. Copy the `REDIS_URL` (starts with `rediss://`)

### 1b. Supabase
1. Go to https://supabase.com
2. Create account
3. Create a new project
4. Go to Settings → API
5. Copy `Project URL` → this is your `SUPABASE_URL`
6. Copy `service_role` key → this is your `SUPABASE_SERVICE_KEY`

---

## Step 2: Create Lightsail Server

1. Go to https://lightsail.aws.amazon.com
2. Create instance:
   - **OS**: Ubuntu 22.04 LTS
   - **Plan**: $20/month (4GB RAM)
   - **Region**: Pick one close to you
3. Wait for it to start
4. Note the **Public IP address**

---

## Step 3: Set Up the Server

SSH into your server:
```bash
ssh -i YOUR_KEY.pem ubuntu@YOUR_SERVER_IP
```

Run these commands:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Log out and back in (for docker group)
exit
```

SSH back in:
```bash
ssh -i YOUR_KEY.pem ubuntu@YOUR_SERVER_IP

# Verify docker works
docker --version
```

---

## Step 4: Upload Your Code

From your local machine (where your code is):
```bash
# Create project folder on server
ssh -i YOUR_KEY.pem ubuntu@YOUR_SERVER_IP "mkdir -p /home/ubuntu/novaos"

# Copy your code
scp -i YOUR_KEY.pem -r ./novaos-backend ubuntu@YOUR_SERVER_IP:/home/ubuntu/novaos/
scp -i YOUR_KEY.pem -r ./novaos-frontend ubuntu@YOUR_SERVER_IP:/home/ubuntu/novaos/
scp -i YOUR_KEY.pem ./docker-compose.yml ubuntu@YOUR_SERVER_IP:/home/ubuntu/novaos/
scp -i YOUR_KEY.pem ./.env.production ubuntu@YOUR_SERVER_IP:/home/ubuntu/novaos/
```

---

## Step 5: Create .env.production

On your local machine, create `.env.production`:
```bash
# Copy the template
cp .env.production.example .env.production

# Edit it with your values
nano .env.production
```

Fill in:
- `JWT_SECRET` - run `openssl rand -base64 32` to generate
- `OPENAI_API_KEY` - from OpenAI
- `REDIS_URL` - from Upstash (Step 1a)
- `SUPABASE_URL` - from Supabase (Step 1b)
- `SUPABASE_SERVICE_KEY` - from Supabase (Step 1b)
- `CORS_ORIGINS` - your domain (e.g., `https://nova.example.com`)

---

## Step 6: Deploy

SSH into server:
```bash
ssh -i YOUR_KEY.pem ubuntu@YOUR_SERVER_IP
cd /home/ubuntu/novaos

# Build and start
docker compose up -d --build

# Check it's running
docker compose ps

# Check logs
docker compose logs -f
```

Test it works:
```bash
curl http://localhost/health
# Should return: OK

curl http://localhost/api/v1/health
# Should return JSON
```

---

## Step 7: Point Your Domain

### Option A: Cloudflare (Recommended)
1. Add your domain to Cloudflare
2. Update nameservers at your registrar
3. Add DNS record:
   - Type: `A`
   - Name: `@` (or subdomain like `nova`)
   - Content: Your Lightsail IP
   - Proxy: ON (orange cloud)
4. SSL/TLS → Set to "Full"
5. Enable "Always Use HTTPS"

### Option B: Direct DNS (No Cloudflare)
1. At your domain registrar, add A record pointing to Lightsail IP
2. You'll need to set up SSL yourself (more complex)

---

## Step 8: Open Firewall

In Lightsail console:
1. Go to your instance → Networking
2. Add rule: HTTP (port 80) from anywhere
3. Add rule: HTTPS (port 443) from anywhere

---

## You're Live! 🎉

Visit `https://yourdomain.com` on your phone.

---

## Common Commands

```bash
# View logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Rebuild after code changes
docker compose up -d --build

# Check what's running
docker compose ps
```

---

## Updating Your App

```bash
# On your local machine - push changes to server
scp -i YOUR_KEY.pem -r ./novaos-backend ubuntu@YOUR_SERVER_IP:/home/ubuntu/novaos/
scp -i YOUR_KEY.pem -r ./novaos-frontend ubuntu@YOUR_SERVER_IP:/home/ubuntu/novaos/

# On server - rebuild
ssh -i YOUR_KEY.pem ubuntu@YOUR_SERVER_IP
cd /home/ubuntu/novaos
docker compose up -d --build
```

---

## Troubleshooting

**App not loading?**
```bash
docker compose logs backend
```

**Can't connect?**
- Check Lightsail firewall allows port 80/443
- Check Cloudflare DNS is pointing to right IP

**Backend errors?**
- Check `.env.production` has all required values
- Check Redis/Supabase credentials are correct
