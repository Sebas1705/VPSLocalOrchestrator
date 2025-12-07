# 🚀 Complete Installation

Step-by-step guide to install and configure VPS Local Orchestrator API.

## 📋 Prerequisites

- **Node.js** 18+ (recommended 24.11.1)
- **npm** 9+
- **Git**
- Terminal/shell access
- Optional: **openssl** to generate tokens

Verify versions:
```bash
node --version   # v24.11.1+
npm --version    # 9+
git --version    # 2.30+
```

## 🔧 Installation Step by Step

### Step 1: Clone Repository

```bash
# Clone
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git

# Enter directory
cd VPSLocalOrchestrator
```

### Step 2: Install Dependencies

```bash
# Enter API directory
cd api

# Install dependencies
npm install
```

This will install:
- Express.js 5.2.1
- TypeScript 5.9.3
- tsx (TypeScript executor)
- dotenv (variable management)
- and more...

### Step 3: Configure Environment Variables

```bash
# Copy template
cp .env.example .env

# Edit with your favorite editor
nano .env   # or vi, vim, code, etc.
```

#### Generate Secure Token

```bash
# Generate random 64-character token
openssl rand -hex 32
```

Result: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2`

#### Edit `.env`

```bash
nano api/.env
```

Minimum content:
```bash
# Required: Token for privileged endpoints
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# Required: Listening port
PORT=3000

# Optional: Log level (debug, info, warn, error)
LOG_LEVEL=info

# Optional: Others
SUDO_PASSWORD=your-password
ENABLE_PRIVILEGED_ENDPOINTS=true
```

Save and close (Ctrl+X if using nano).

### Step 4: Verify Configuration

```bash
# Verify .env was created
cat api/.env | head -5
```

You should see something like:
```
API_TOKEN=a1b2c3d4...
PORT=3000
LOG_LEVEL=info
```

### Step 5: Compile TypeScript (Optional for Development)

```bash
# One-time compilation
npm run build

# Or run with tsx (hot reload in development)
npm run dev
```

### Step 6: Test the Installation

#### Start API in Development Mode

```bash
# Run from api/ directory
npm run dev
```

Expected output:
```
🚀 API running on http://127.0.0.1:3000
```

#### Test Health Endpoint (New Terminal)

```bash
# Check if API is responding
curl http://127.0.0.1:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-07T10:30:45.123Z",
  "uptime": 5.234
}
```

#### Test Simple Command

```bash
# Execute simple public command
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "whoami"}'
```

Expected response:
```json
{
  "success": true,
  "result": {
    "stdout": "username",
    "stderr": "",
    "exitCode": 0,
    "duration": 42
  }
}
```

#### Test Privileged Command

```bash
# Execute command with token
curl -X POST http://127.0.0.1:3000/api/privileged/execute \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"command": "systemctl status ssh"}'
```

Replace `YOUR_TOKEN_HERE` with your API_TOKEN from `.env`.

Expected response:
```json
{
  "success": true,
  "result": {
    "stdout": "● ssh.service - OpenBSD Secure Shell server\n...",
    "stderr": "",
    "exitCode": 0,
    "duration": 125
  }
}
```

## 🐳 Production Deployment

### Option 1: Direct Execution

```bash
# Build TypeScript
npm run build

# Run compiled version
npm start
```

### Option 2: Using systemd

Create `/etc/systemd/system/vps-orchestrator.service`:

```ini
[Unit]
Description=VPS Local Orchestrator API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/user/VPSLocalOrchestrator/api
EnvironmentFile=/home/user/VPSLocalOrchestrator/api/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:

```bash
# Enable service
sudo systemctl enable vps-orchestrator

# Start service
sudo systemctl start vps-orchestrator

# Check status
sudo systemctl status vps-orchestrator

# View logs
sudo journalctl -u vps-orchestrator -f
```

### Option 3: Using PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start "npm start" --name "vps-orchestrator"

# Save configuration
pm2 save

# Restart on reboot
pm2 startup
```

### Option 4: Using Docker

Create `Dockerfile`:

```dockerfile
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]
```

Build and run:

```bash
# Build image
docker build -t vps-orchestrator .

# Run container
docker run -d \
  --name vps-orchestrator \
  -p 3000:3000 \
  --env-file .env \
  vps-orchestrator
```

## 📊 Verify Status

After installing, run:

```bash
# Verify compilation
npm run check

# List configuration files
ls -la api/.env*

# See node processes
ps aux | grep node

# Check port
lsof -i :3000
```

## 🎯 Next Steps

1. **Verify it works**: Follow tests above ✅
2. **Read documentation**: See [`docs/README.md`](../README.md)
3. **Configure completely**: [`docs/guides/CONFIGURATION.md`](../guides/CONFIGURATION.md)
4. **Learn endpoints**: [`docs/api/ENDPOINTS.md`](../api/ENDPOINTS.md)
5. **Integrate with n8n**: [`docs/examples/N8N.md`](../examples/N8N.md)

## ✅ Installation Checklist

- [ ] Node.js 18+ installed
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` created with `API_TOKEN`
- [ ] Token generated with `openssl rand -hex 32`
- [ ] API running (`npm run dev`)
- [ ] Health check works (`curl /health`)
- [ ] Simple command executes (`curl /api/command/execute`)
- [ ] Privileged token works
- [ ] `.env` is in `.gitignore`
- [ ] Documentation read

---

Installation completed! 🎉 Now check [`docs/examples/CURL.md`](../examples/CURL.md) for practical examples.
