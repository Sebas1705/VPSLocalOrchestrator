# 🚀 Getting Started with VPS Local Orchestrator

**Version**: v1.0.0  
**Last Updated**: December 8, 2025

## 📋 Table of Contents

1. [Quick Start (5 minutes)](#quick-start-5-minutes)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [First Steps](#first-steps)
5. [Common Questions](#common-questions)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start (5 minutes)

### Prerequisites
- Node.js v18+ 
- npm or yarn
- Linux/macOS environment

### Installation & Run

```bash
# 1. Clone repository
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api

# 2. Install dependencies
npm install

# 3. Create .env file
cp docs/examples/.env.example .env
# Edit .env and set your API_TOKEN

# 4. Build TypeScript
npm run build

# 5. Start server
npm start
```

Server runs on: `http://localhost:3000`

### Test Connection

```bash
# Health check
curl http://localhost:3000/health

# API info
curl http://localhost:3000/

# Execute command (requires auth token)
curl -X POST http://localhost:3000/api/command/execute \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"whoami"}'
```

---

## Installation

### System Requirements

| Component | Version | Required |
|-----------|---------|----------|
| Node.js | 18.x or higher | ✅ Yes |
| npm | 8.x or higher | ✅ Yes |
| TypeScript | 5.x | ✅ Yes |
| Linux/macOS | Any recent | ✅ Yes |
| Windows | WSL2 recommended | ⚠️ Partial support |

### Step-by-Step Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator
```

#### 2. Install Dependencies

```bash
cd api
npm install
```

If you encounter permission issues:
```bash
sudo npm install --unsafe-perm
```

#### 3. Verify Installation

```bash
npm run build
echo "✓ TypeScript compiled successfully"
```

#### 4. Optional: Install System Service

For production, install as systemd service:

```bash
sudo cp vps-orchestrator.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable vps-orchestrator
sudo systemctl start vps-orchestrator
```

---

## Configuration

### Environment Variables

Create `api/.env` file:

```env
# API Configuration
API_HOST=localhost
API_PORT=3000
API_LOG_LEVEL=info

# Security
API_TOKEN=your-secret-token-here-minimum-32-chars
ALLOW_SUDO_COMMANDS=false

# Optional: Encryption
ENCRYPTION_MASTER_KEY=your-32-char-hex-key-optional
```

### .env Variables Explained

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `API_HOST` | Server bind address | localhost | No |
| `API_PORT` | Server port | 3000 | No |
| `API_LOG_LEVEL` | Log verbosity: debug, info, warn, error | info | No |
| `API_TOKEN` | Authentication token for API | (none) | ✅ Yes |
| `ALLOW_SUDO_COMMANDS` | Allow sudo in command execution | false | No |
| `ENCRYPTION_MASTER_KEY` | Master key for data encryption | (none) | No |

### Production Configuration

For production deployment:

```env
API_HOST=0.0.0.0
API_PORT=3000
API_LOG_LEVEL=warn
API_TOKEN=your-strong-token-min-32-chars
ALLOW_SUDO_COMMANDS=false
ENCRYPTION_MASTER_KEY=your-encrypted-master-key
```

---

## First Steps

### 1. Verify Server is Running

```bash
curl http://localhost:3000/health
# Response: {"status":"ok","timestamp":"...","uptime":123.45}
```

### 2. Get API Information

```bash
curl http://localhost:3000/
# Shows version, available endpoints
```

### 3. Check System Resources

```bash
curl http://localhost:3000/api/resources
# Shows CPU, memory, disk usage
```

### 4. Execute Your First Command

```bash
export TOKEN="your-api-token"
curl -X POST http://localhost:3000/api/command/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"ls -la"}'
```

### 5. Explore More Endpoints

- **Get processes**: `GET /api/resources/processes`
- **Get network info**: `GET /api/resources/network`
- **Get services**: `GET /api/services`
- **Execute batch**: `POST /api/command/batch` (multiple commands)

See [ENDPOINTS.md](./ENDPOINTS.md) for complete API documentation.

---

## Common Questions

### Q: How do I change the API token?

**A**: Edit `.env` file and change `API_TOKEN`:

```bash
API_TOKEN=your-new-token-here
npm restart
```

### Q: Can I run this on Windows?

**A**: Yes, but it's recommended to use **WSL2 (Windows Subsystem for Linux)**:

```bash
# In WSL2 terminal
git clone ...
cd VPSLocalOrchestrator/api
npm install && npm run build && npm start
```

### Q: How do I enable HTTPS/SSL?

**A**: Currently the API runs on HTTP. For production HTTPS, use a reverse proxy:

**Using Nginx:**
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

### Q: How do I see the logs?

**A**: Logs appear in stdout and in `api/logs/` directory:

```bash
# Real-time logs
npm start

# View log files
cat api/logs/*.log

# For systemd service
sudo journalctl -u vps-orchestrator -f
```

### Q: Can I use this without authentication?

**A**: No. All API endpoints require `Authorization: Bearer <token>` header.

### Q: How do I reset the database/state?

**A**: Currently the API is stateless. To reset:

```bash
npm run build
npm start
```

---

## Troubleshooting

### Server won't start: "Port 3000 already in use"

**Solution 1**: Change port in `.env`:
```env
API_PORT=3001
```

**Solution 2**: Kill existing process:
```bash
# Find process on port 3000
lsof -i :3000
# Kill it
kill -9 <PID>
```

### "Cannot find module" errors

**Solution**: Rebuild TypeScript:
```bash
npm run build
# Or clean and rebuild
rm -rf dist/
npm run build
```

### Authentication fails: "Unauthorized"

**Solution**: 
1. Check token in `.env`
2. Include in request header: `Authorization: Bearer YOUR_TOKEN`
3. Token must be at least 32 characters

Example with valid token:
```bash
curl -H "Authorization: Bearer your-very-long-secret-token-here-32chars" \
  http://localhost:3000/api/resources
```

### Permission denied errors

**Solution**: Run with proper permissions:

```bash
# For localhost
npm start

# For system service
sudo systemctl start vps-orchestrator
```

### Tests are failing

**Solution**: 
```bash
# Install dependencies
npm install

# Run tests with details
npm test -- --verbose

# Run specific test file
npm test -- tests/unit/services/commandExecutor.test.ts
```

---

## Next Steps

1. **Explore Endpoints**: Read [ENDPOINTS.md](./ENDPOINTS.md)
2. **Understand Architecture**: Read [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **See Examples**: Read [EXAMPLES.md](./EXAMPLES.md)
4. **Learn About Security**: Read [guides/SECURITY.md](./guides/SECURITY.md)
5. **Check Roadmap**: Read [FEATURE_ROADMAP.md](./core/FEATURE_ROADMAP.md)

---

## Getting Help

- **Documentation**: Check [docs/INDEX.md](./INDEX.md)
- **Issues**: Open issue on GitHub
- **Examples**: See [EXAMPLES.md](./EXAMPLES.md)
- **Security**: Read [guides/SECURITY.md](./guides/SECURITY.md)

---

**Happy orchestrating! 🚀**
