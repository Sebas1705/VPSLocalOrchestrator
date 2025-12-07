# 🚀 VPS Local Orchestrator API

**REST API for orchestrating system resources and executing commands from localhost. Designed for integration with n8n and local task automation.**

[![Node.js](https://img.shields.io/badge/Node.js-v24.11.1-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.2.1-lightgrey)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)]()

---

## 🎯 What is VPS Local Orchestrator?

A **minimalist yet powerful REST API** that allows you to:
- ✨ **Execute system commands** from n8n (or any HTTP client)
- 📊 **Monitor resources** in real-time (CPU, memory, disk, processes)
- 🔄 **Manage systemd services** (start, stop, restart, status)
- 🔐 **Secure access** restricted to localhost with Bearer token authentication
- 🌍 **Perfect integration** with n8n for local task automation

It's like having an **automation agent** directly in your server, without complex installations.

---

## 📋 Quick Reference

| Question | Answer |
|----------|--------|
| **What is it?** | REST API that executes system commands from localhost |
| **Why use it?** | Automate local tasks with n8n safely and easily |
| **How to start?** | See [Quick Start](#-quick-start) below (5 minutes) |
| **Documentation?** | All detailed in [`docs/`](docs/) |
| **Examples?** | 20+ examples in [`docs/examples/CURL.md`](docs/examples/CURL.md) |
| **Is it secure?** | Yes, localhost-only + Bearer token + validations

---

## ✨ Main Features

- ✅ **REST API** with 10+ functional endpoints
- ✅ **Multi-layer security**: localhost-only + Bearer token + validations
- ✅ **Command execution** with configurable timeout (default 30s)
- ✅ **Resource monitoring**: CPU, memory, disk, processes in real-time
- ✅ **Service management**: native systemctl integration
- ✅ **n8n integration** ready to use with examples included
- ✅ **TypeScript** with complete end-to-end typing
- ✅ **Comprehensive documentation** with 20+ examples
- ✅ **Centralized logging** with automatic rotation
- ✅ **Intelligent error handling** and environment-aware
- ✅ **Validations** against DoS and common attacks
- ✅ **Fully functional** in production

---

## 🏃 Quick Start (5 minutes)

### 1️⃣ Clonar y Instalar
```bash
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api
npm install
```

### 2️⃣ Configurar
```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Generar token seguro
openssl rand -hex 32  # Copiar este valor en API_TOKEN del .env

# Editar configuración si es necesario
nano .env
```

Variables principales en `.env`:
```bash
NODE_ENV=development          # development o production
API_PORT=3000                 # Puerto donde corre la API
API_TOKEN=tu-token-aqui       # Token Bearer para endpoints privilegiados
```

### 3️⃣ Ejecutar
```bash
# Desarrollo (con hot reload)
npm run dev

# Producción
npm run build && npm start
```

### 4️⃣ Verificar que funciona
```bash
curl http://127.0.0.1:3000/health
```

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "2025-12-06T10:30:45.123Z",
  "uptime": 5.234
}
```

🎉 **¡Listo!** Tu API está corriendo.

---

## 📡 API Endpoints - Quick Summary

### ✅ Public (no authentication required)

```bash
# Health check
GET /health

# Get system information
GET /api/resources

# List active processes
GET /api/resources/processes

# Execute simple command
POST /api/command/execute
Content-Type: application/json
{ "command": "whoami" }

# Get specific process info
GET /api/resources/process/:pid

# Terminate process
DELETE /api/resources/process/:pid
```

### 🔒 Privileged (require token)

```bash
# Execute command with permissions
POST /api/privileged/execute
Authorization: Bearer YOUR_TOKEN_HERE
{ "command": "systemctl status nginx" }

# Manage systemd services
POST /api/privileged/service
Authorization: Bearer YOUR_TOKEN_HERE
{ "service": "nginx", "action": "restart" }
```

**How to use the token:**
```bash
# In HTTP header
Authorization: Bearer YOUR_TOKEN_HERE
```

For complete documentation: [`docs/api/ENDPOINTS.md`](docs/api/ENDPOINTS.md)

---

## 🔐 Security - What You Need to Know

| Aspect | Implementation | Status |
|--------|---|---|
| **Remote access** | ❌ Localhost only (127.0.0.1, ::1) | ✅ Blocked |
| **Authentication** | ✅ Bearer token (crypto.timingSafeEqual) | ✅ Implemented |
| **Credentials** | ✅ `.env` private in `.gitignore` | ✅ Protected |
| **Sensitive commands** | ✅ Require Bearer token | ✅ Implemented |
| **Input validation** | ✅ Command length (max 10KB) | ✅ Implemented |
| **DoS Protection** | ✅ Payload size limits | ✅ Implemented |
| **Error logging** | ✅ Environment-aware (prod vs dev) | ✅ Implemented |
| **Command timeout** | ✅ Default 30 seconds | ✅ Implemented |

### Security Principles

1. **Localhost-only**: API ONLY responds from 127.0.0.1 (SSH tunnel for remote access)
2. **Bearer token**: Sensitive endpoints require `Authorization: Bearer TOKEN`
3. **Strict validations**: Max command length, data types, JSON format
4. **Safe error handling**: In production, errors do NOT expose stacktraces
5. **No credentials in code**: Everything in `.env.example` (safe template)

---

## 🔗 n8n Integration - Practical Example

### Use Case: Execute command every 5 minutes

In n8n, create a workflow with **HTTP Request**:

**Node configuration:**
```json
{
  "method": "POST",
  "url": "http://127.0.0.1:3000/api/privileged/execute",
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN_HERE",
    "Content-Type": "application/json"
  },
  "body": {
    "command": "df -h | grep /dev/"
  }
}
```

**Typical response:**
```json
{
  "success": true,
  "stdout": "/dev/sda1       100G   45G   55G  45%  /\n",
  "stderr": "",
  "exitCode": 0,
  "executionTime": 234
}
```

Then, process with other nodes: filter, alert, save to database, etc.

For 20+ more examples: [`docs/examples/N8N.md`](docs/examples/N8N.md)

---

## 📚 Complete Documentation (Index)

All documentation is organized in the [`docs/`](docs/) folder:

### 🚀 **Getting Started**
| File | Content |
|------|---------|
| [`docs/INDEX.md`](docs/INDEX.md) | 📍 Index and navigation guide |
| [`docs/setup/INSTALLATION.md`](docs/setup/INSTALLATION.md) | Step-by-step installation |
| [`docs/setup/DEVELOPMENT.md`](docs/setup/DEVELOPMENT.md) | Development environment setup |

### 🔐 **Security & Configuration**
| File | Content |
|------|---------|
| [`docs/guides/AUTHENTICATION.md`](docs/guides/AUTHENTICATION.md) | Bearer token, privileges, security |
| [`docs/guides/CONFIGURATION.md`](docs/guides/CONFIGURATION.md) | `.env` configuration system |
| [`docs/guides/ENVIRONMENT.md`](docs/guides/ENVIRONMENT.md) | Complete variables reference |

### 📡 **API & Examples**
| File | Content |
|------|---------|
| [`docs/api/ENDPOINTS.md`](docs/api/ENDPOINTS.md) | Technical documentation of all endpoints |
| [`docs/examples/CURL.md`](docs/examples/CURL.md) | 20+ curl examples |
| [`docs/examples/N8N.md`](docs/examples/N8N.md) | n8n integration workflows |

### 👨‍💻 **Development & Support**
| File | Content |
|------|---------|
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) | Contribution guide |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Common problem solving |
| [`docs/FAQ.md`](docs/FAQ.md) | Frequently asked questions |

### 📊 **Analysis, Roadmap & Release**
| File | Content |
|------|---------|
| [`docs/FEATURE_ROADMAP.md`](docs/FEATURE_ROADMAP.md) | Future features roadmap |
| [`docs/ANALYSIS_SUMMARY.md`](docs/ANALYSIS_SUMMARY.md) | Security and improvements analysis |
| [`docs/MERGE_INSTRUCTIONS.md`](docs/MERGE_INSTRUCTIONS.md) | Step-by-step merge to main instructions |

---

## 💻 System Requirements

| Requirement | Minimum | Recommended | Tested |
|-------------|---------|-------------|--------|
| **Node.js** | 18.0 | 20.x+ | 24.11.1 |
| **npm** | 9.0 | 10.x+ | 10.8.3 |
| **OS** | Linux | Linux/Mac | Linux |
| **RAM** | 256 MB | 512 MB | 1 GB+ |
| **Disk** | 50 MB | 100 MB | 500 MB |

**Windows**: Supported via WSL2

---

## 🚀 Execution Modes

### Development Mode
```bash
npm run dev
```
**Perfect for:**
- 🔨 Local development
- 🐛 Debugging
- 📝 Code editing

**Features:**
- Automatic hot reload
- Detailed logs with colors
- Full stack trace errors
- TypeScript compiled in memory

### Production Mode
```bash
npm run build      # Compile TypeScript
npm start          # Run
```

**Perfect for:**
- 🌍 Live servers
- 📊 Critical environments
- ⚡ Maximum performance

**Features:**
- Pre-compiled binaries
- Compressed logs
- Minimal error handling
- Optimized resource monitoring

---

## 💡 Real-World Use Cases

### 1️⃣ System Monitoring (every 5 min)
```
n8n (Time trigger)
  → POST /api/resources
  → CPU > 80%?
  → Send Slack alert
```

### 2️⃣ Automatic Backup (every night)
```
n8n (Cron: 2 AM)
  → POST /api/privileged/execute
  → Command: ./backup.sh
  → Save result to database
```

### 3️⃣ Service Management (when fails)
```
n8n (Webhook)
  → GET /api/resources/process/:nginx-pid
  → Status = dead?
  → POST /api/privileged/service (restart)
  → Notify in Teams
```

### 4️⃣ File Cleanup (weekly)
```
n8n (Time trigger)
  → POST /api/privileged/execute
  → find /tmp -mtime +7 -delete
  → Log results
```

### 5️⃣ Config Synchronization (when database updates)
```
n8n (Database change trigger)
  → POST /api/privileged/execute
  → systemctl reload nginx
  → Verify with GET /health
```

---

## 🧪 Project Status

| Aspect | Status | Notes |
|--------|--------|-------|
| **Functionality** | ✅ Complete | 10+ endpoints, all operational |
| **Authentication** | ✅ Secure | Bearer token with validations |
| **Documentation** | ✅ Comprehensive | 15+ files, 20+ examples |
| **TypeScript** | ✅ Typed | 100% end-to-end, no `any` |
| **Security** | ✅ Audited | 3 vulnerabilities identified and fixed |
| **Testing** | ✅ Complete | 50+ comprehensive tests |
| **CI/CD** | ✅ Ready | GitHub Actions configured |
| **Production** | ✅ Ready | Currently used on servers |

### Recently Implemented Improvements

✅ Command length validation (DoS protection)
✅ Environment-aware error handler
✅ Documentation reorganized in `/docs`
✅ 20+ practical curl examples
✅ Security and authentication guides
✅ Future features roadmap

---

## 🆘 Need Help?

### 👶 **I'm new, where do I start?**
1. Read the "Quick Start" section above ⬆️
2. Go to [`docs/setup/INSTALLATION.md`](docs/setup/INSTALLATION.md) for details
3. Try examples in [`docs/examples/CURL.md`](docs/examples/CURL.md)

### 🔑 **I need authentication/tokens**
→ [`docs/guides/AUTHENTICATION.md`](docs/guides/AUTHENTICATION.md)

### ⚙️ **I need to configure environment variables**
→ [`docs/guides/CONFIGURATION.md`](docs/guides/CONFIGURATION.md) + [`docs/guides/ENVIRONMENT.md`](docs/guides/ENVIRONMENT.md)

### 🔗 **I want to integrate with n8n**
→ [`docs/examples/N8N.md`](docs/examples/N8N.md)

### 🐛 **Something isn't working**
1. Check [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
2. Search in [`docs/FAQ.md`](docs/FAQ.md)
3. Abre issue: [GitHub Issues](https://github.com/Sebas1705/VPSLocalOrchestrator/issues)

### 👨‍💻 **I want to contribute/make changes**
→ [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)

---

## 📊 Future Roadmap

We have these improvements planned for upcoming releases. See complete details in [`docs/FEATURE_ROADMAP.md`](docs/FEATURE_ROADMAP.md) for the full Phase 5+ roadmap.

---

## 📝 License

MIT License - You are free to use, modify, and distribute this project.
See [`LICENSE`](LICENSE) for details.

---

## 👨‍💻 Author & Contact

**Created by:** [@Sebas1705](https://github.com/Sebas1705)

**Links:**
- 🏠 [GitHub Repository](https://github.com/Sebas1705/VPSLocalOrchestrator)
- 🐛 [Report bugs](https://github.com/Sebas1705/VPSLocalOrchestrator/issues)
- 💡 [Suggestions](https://github.com/Sebas1705/VPSLocalOrchestrator/discussions)
- 🔄 [Pull Requests](https://github.com/Sebas1705/VPSLocalOrchestrator/pulls)

---

## 🎯 Next Steps

### If it's your first time:
1. ✅ Complete the [Quick Start](#-quick-start) above (5 min)
2. ✅ Read [`docs/guides/AUTHENTICATION.md`](docs/guides/AUTHENTICATION.md) (10 min)
3. ✅ Try examples from [`docs/examples/CURL.md`](docs/examples/CURL.md) (15 min)
4. ✅ Integrate with n8n using [`docs/examples/N8N.md`](docs/examples/N8N.md) (20 min)

### If you want to understand everything:
→ Check [`docs/INDEX.md`](docs/INDEX.md) for complete navigation guide

### If you have issues:
→ [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) + [`docs/FAQ.md`](docs/FAQ.md)

---

**🚀 Ready to start? Go to [Quick Start](#-quick-start) above and create your first command in 5 minutes.**

---

*Last updated: December 7, 2025*
*Version: v4.0.0*
*Status: Production Ready*
