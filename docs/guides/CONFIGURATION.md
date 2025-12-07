# Private System Configuration

## 📋 Overview

A secure configuration system has been implemented that:
- ✅ Stores sensitive credentials in `.env` (private)
- ✅ Provides template in `.env.example` (public)
- ✅ Prevents accidental commits with `.gitignore`
- ✅ Validates environment variables on startup
- ✅ Centralizes configuration in TypeScript

## 🔐 Key Files

### 1. `.env` (Private - Never Commit)
File with real credentials. **MUST NEVER be committed**.

```bash
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
PORT=3000
LOG_LEVEL=info
SUDO_PASSWORD=your-sudo-password
ENABLE_PRIVILEGED_ENDPOINTS=true
MAX_COMMAND_TIMEOUT=300000
ALLOWED_SCRIPT_PATHS=/scripts,/usr/local/scripts
ALERT_EMAIL=admin@example.com
WEBHOOK_LOG_URL=https://webhook.site/xxx
```

### 2. `.env.example` (Public - Safe to Commit)
Template for new setup. Safe for the repository.

```bash
API_TOKEN=your-secret-token-here
PORT=3000
LOG_LEVEL=info
SUDO_PASSWORD=your-sudo-password
ENABLE_PRIVILEGED_ENDPOINTS=true
MAX_COMMAND_TIMEOUT=300000
ALLOWED_SCRIPT_PATHS=/scripts
ALERT_EMAIL=admin@example.com
WEBHOOK_LOG_URL=https://webhook.site/xxx
```

### 3. `.gitignore` (Protection)
Prevents sensitive files from being committed.

```
.env
.env.local
.env.*.local
.env.production.local
node_modules/
dist/
build/
*.log
.DS_Store
.vscode/
.idea/
```

## 🔧 Configuration System

### TypeScript Structure
```typescript
// api/src/config/index.ts
export interface Config {
  api: {
    port: number;
    host: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  security: {
    apiToken: string;
    enablePrivilegedEndpoints: boolean;
    allowSudoCommands: boolean;
    sudoPassword: string;
  };
  commands: {
    maxTimeout: number;
    allowedScriptPaths: string[];
  };
  notifications: {
    alertEmail?: string;
    webhookLogUrl?: string;
  };
}
```

### Loading Configuration
```typescript
import 'dotenv/config';

export function getConfig(): Config {
  validateEnv();  // Validates required variables
  
  return {
    api: {
      port: parseInt(process.env.PORT || '3000', 10),
      host: '127.0.0.1',
      logLevel: process.env.LOG_LEVEL as any || 'info'
    },
    security: {
      apiToken: process.env.API_TOKEN || '',
      enablePrivilegedEndpoints: process.env.ENABLE_PRIVILEGED_ENDPOINTS === 'true',
      allowSudoCommands: process.env.ALLOW_SUDO_COMMANDS === 'true',
      sudoPassword: process.env.SUDO_PASSWORD || ''
    },
    // ... more fields
  };
}
```

## 🚀 Initial Setup

### 1. First Installation
```bash
cd api
npm install
cp .env.example .env
```

### 2. Generate Secure Token
```bash
openssl rand -hex 32
```

### 3. Edit `.env`
```bash
nano .env
```

Copy the generated token:
```bash
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### 4. Start Server
```bash
npm run dev
```

## 📝 Variable Validation

On startup, the server verifies required variables:

```
Validating environment variables:
  ✅ API_TOKEN
  ✅ PORT
```

If a required variable is missing:
```
❌ Required environment variables not found:
   - API_TOKEN
   - PORT

Copy .env.example to .env and configure the values:
   cp api/.env.example api/.env
```

## 🔐 Credential Security

### Never Do This
```bash
# ❌ NO: Expose token in command line
export API_TOKEN=secret123
npm run dev

# ❌ NO: Commit .env
git add .env
git commit -m "Add env file"

# ❌ NO: Log credentials
console.log(`Token: ${config.security.apiToken}`);

# ❌ NO: Hardcode in code
const API_TOKEN = "secret123";
```

### Always Do This
```bash
# ✅ YES: Use .env with .gitignore
cp .env.example .env
# Edit .env privately
nano .env

# ✅ YES: Generate secure tokens
openssl rand -hex 32

# ✅ YES: Use environment variables
const token = process.env.API_TOKEN;

# ✅ YES: Protect .env in .gitignore
echo ".env" >> .gitignore
git add .gitignore
```

## 📋 Complete Environment Variables

| Variable | Type | Required | Default | Example |
|----------|------|----------|---------|---------|
| `API_TOKEN` | string | ✅ | - | `a1b2c3...` |
| `PORT` | number | ✅ | - | `3000` |
| `LOG_LEVEL` | enum | ❌ | `info` | `debug\|info\|warn\|error` |
| `SUDO_PASSWORD` | string | ❌ | - | `my-password` |
| `ENABLE_PRIVILEGED_ENDPOINTS` | boolean | ❌ | `true` | `true\|false` |
| `ALLOW_SUDO_COMMANDS` | boolean | ❌ | `true` | `true\|false` |
| `MAX_COMMAND_TIMEOUT` | number | ❌ | `30000` | `60000` |
| `ALLOWED_SCRIPT_PATHS` | string | ❌ | `/scripts` | `/scripts,/usr/local` |
| `ALERT_EMAIL` | string | ❌ | - | `admin@example.com` |
| `WEBHOOK_LOG_URL` | string | ❌ | - | `https://webhook.site/xxx` |

## 🔄 Credential Rotation

### Change Token
```bash
# 1. Generate new token
openssl rand -hex 32

# 2. Update .env
nano api/.env
# Copy new token in API_TOKEN

# 3. Restart server
npm run dev
```

### Change Sudo Password
```bash
# 1. Update .env
nano api/.env
SUDO_PASSWORD=new-password

# 2. Restart server
npm run dev
```

## 🌍 Different Environments

### Development
```bash
# api/.env.development
API_TOKEN=dev-token-123
LOG_LEVEL=debug
ENABLE_PRIVILEGED_ENDPOINTS=true
```

### Staging
```bash
# api/.env.staging
API_TOKEN=staging-token-456
LOG_LEVEL=info
ENABLE_PRIVILEGED_ENDPOINTS=true
```

### Production
```bash
# api/.env.production
API_TOKEN=prod-token-789
LOG_LEVEL=warn
ENABLE_PRIVILEGED_ENDPOINTS=false
```

Load by environment:
```bash
NODE_ENV=production npm start
```

## ✅ Security Checklist

- [ ] `.env.example` created with dummy values
- [ ] `.env` in `.gitignore`
- [ ] Token generated with `openssl rand -hex 32`
- [ ] `.env` never committed
- [ ] Variable validation on startup
- [ ] Different tokens per environment
- [ ] Sudo password in `.env` (not hardcoded)
- [ ] Logs don't expose credentials
- [ ] `.env` access restricted (chmod 600)

## 🆘 Troubleshooting

**Error: "Required environment variables not found"**
```bash
# Solution
cp api/.env.example api/.env
nano api/.env
# Fill in necessary values
```

**Error: "API token required"**
```bash
# Verify that .env has API_TOKEN
grep API_TOKEN api/.env

# Verify it's defined
cat api/.env
```

**Token expired/compromised**
```bash
# Generate new
openssl rand -hex 32

# Update
nano api/.env

# Restart
npm run dev
```

## 📚 Related

- See [`docs/guides/ENVIRONMENT.md`](ENVIRONMENT.md) for variable details
- See [`docs/guides/AUTHENTICATION.md`](AUTHENTICATION.md) for token usage
- See [`docs/setup/INSTALLATION.md`](../setup/INSTALLATION.md) for complete installation
