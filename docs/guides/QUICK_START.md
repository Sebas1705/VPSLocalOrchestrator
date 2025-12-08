# 🚀 Quick Start Guide

Get the VPS Local Orchestrator API up and running in under 5 minutes.

---

## ⚡ Prerequisites

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Linux**: Ubuntu 20.04+ / Debian 10+ / CentOS 8+
- **Permissions**: sudo access (for privileged operations)

---

## 📦 Installation

### 1. Clone Repository

```bash
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
# Copy example configuration
cp .env.example .env

# Generate secure API token
TOKEN=$(openssl rand -hex 32)
echo "API_TOKEN=$TOKEN" >> .env

# Edit other variables as needed
nano .env
```

**Minimum required configuration:**
```bash
API_TOKEN=<your-generated-token>
PORT=3000
LOG_LEVEL=info
```

### 4. Build Project

```bash
npm run build
```

### 5. Start Server

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
cd dist
node index.js
```

---

## ✅ Verify Installation

### Health Check

```bash
curl http://127.0.0.1:3000/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-08T10:00:00.000Z"
}
```

### API Info

```bash
curl http://127.0.0.1:3000/
```

**Expected response:**
```json
{
  "name": "VPS Local Orchestrator API",
  "version": "4.0.0",
  "description": "API for VPS management and orchestration",
  "endpoints": {
    "health": "GET /health",
    "resources": "GET /api/resources",
    "commands": "POST /api/command/execute (requires auth)",
    "documentation": "/docs"
  }
}
```

  More usage samples: see [Endpoint usage examples](/docs/examples/ENDPOINT_EXAMPLES.md).

---

## 🧪 Test First Request

### Public Endpoint (No Auth)

```bash
curl http://127.0.0.1:3000/api/resources
```

**Response:**
```json
{
  "cpu": {
    "model": "Intel(R) Xeon(R) CPU",
    "cores": 4,
    "usage": 12.5
  },
  "memory": {
    "total": 8192,
    "used": 4096,
    "free": 4096,
    "percentage": 50
  },
  "disk": {
    "total": 100000,
    "used": 50000,
    "free": 50000,
    "percentage": 50
  },
  "uptime": 86400
}
```

### Protected Endpoint (With Auth)

```bash
# Replace YOUR_TOKEN with your actual token from .env
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "echo Hello World"}'
```

**Response:**
```json
{
  "success": true,
  "result": {
    "stdout": "Hello World\n",
    "stderr": "",
    "exitCode": 0,
    "duration": 15
  }
}
```

---

## 🔧 Common Issues

### Port Already in Use

```bash
# Check what's using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>

# Or change port in .env
PORT=5000
```

### Permission Denied

```bash
# Ensure proper permissions
chmod +x dist/index.js

# For privileged operations, configure sudoers (see INSTALLATION.md)
```

### Module Not Found

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 🚀 Next Steps

1. **Explore API**: Read [ENDPOINTS.md](/docs/core/ENDPOINTS.md)
2. **Configure Security**: Review [AUTHENTICATION.md](/docs/guides/AUTHENTICATION.md)
3. **Production Setup**: Follow [INSTALLATION.md](/docs/guides/INSTALLATION.md)
4. **Advanced Features**: Check [FEATURE_ROADMAP.md](/docs/core/FEATURE_ROADMAP.md)

---

## 📚 Additional Resources

- [Configuration Guide](/docs/guides/CONFIGURATION.md)
- [Environment Variables](/docs/guides/ENVIRONMENT.md)
- [Testing Guide](/docs/core/TESTING.md)
- [Contributing](/docs/core/CONTRIBUTING.md)

---

**Got Questions?** Check the [FAQ](/docs/guides/FAQ.md) or open an issue on GitHub.
