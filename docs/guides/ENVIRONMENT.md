# Complete Environment Variables Guide

## 📋 All Available Variables

### Required ⚠️

#### `API_TOKEN`
Bearer token for privileged endpoints.

```bash
# Generate secure token (64 characters)
openssl rand -hex 32

# Copy to .env
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Validation**:
- Minimum 32 characters
- Cannot be empty
- Validated with timing-safe comparison

#### `PORT`
Port on which the API listens.

```bash
# Default (if not specified)
PORT=3000

# Another port
PORT=5000
```

**Validation**:
- Must be number between 1 and 65535
- If unavailable, server will fail

### Optional 📌

#### `LOG_LEVEL`
Log level in console.

```bash
# Options
LOG_LEVEL=debug    # Shows everything (development)
LOG_LEVEL=info     # Info, warn, error (default)
LOG_LEVEL=warn     # Warn, error
LOG_LEVEL=error    # Errors only (production)
```

**Values**:
```
debug > info > warn > error
```

#### `SUDO_PASSWORD`
Sudo password for privileged commands.

```bash
SUDO_PASSWORD=my-super-secure-password
```

**Note**: Better to use passwordless sudoers if possible.

#### `ENABLE_PRIVILEGED_ENDPOINTS`
Enable/disable privileged endpoints.

```bash
# Enable (default)
ENABLE_PRIVILEGED_ENDPOINTS=true

# Disable (doesn't expose /api/privileged/*)
ENABLE_PRIVILEGED_ENDPOINTS=false
```

#### `ALLOW_SUDO_COMMANDS`
Allow/block commands with sudo.

```bash
# Allow sudo
ALLOW_SUDO_COMMANDS=true

# Block sudo (more secure)
ALLOW_SUDO_COMMANDS=false
```

#### `MAX_COMMAND_TIMEOUT`
Maximum timeout for commands (in milliseconds).

```bash
# 30 seconds (default)
MAX_COMMAND_TIMEOUT=30000

# 5 minutes
MAX_COMMAND_TIMEOUT=300000

# 10 minutes
MAX_COMMAND_TIMEOUT=600000
```

#### `ALLOWED_SCRIPT_PATHS`
Allowed paths to execute scripts.

```bash
# Single path
ALLOWED_SCRIPT_PATHS=/scripts

# Multiple paths (comma-separated)
ALLOWED_SCRIPT_PATHS=/scripts,/usr/local/scripts,/app/scripts

# All paths (not recommended)
ALLOWED_SCRIPT_PATHS=/
```

#### `ALERT_EMAIL`
Email for system alerts.

```bash
ALERT_EMAIL=admin@example.com
```

#### `WEBHOOK_LOG_URL`
Webhook URL to send logs.

```bash
WEBHOOK_LOG_URL=https://webhook.site/xxx-yyy-zzz
```

#### `NODE_ENV`
Execution environment.

```bash
NODE_ENV=development   # Development (more verbose)
NODE_ENV=staging       # Staging
NODE_ENV=production    # Production (less verbose)
```

## 🔧 Complete `.env` File

### Development
```bash
# Tokens
API_TOKEN=dev-token-1234567890abcdef1234567890abcdef12345678

# Server
PORT=3000
LOG_LEVEL=debug
NODE_ENV=development

# Security
ENABLE_PRIVILEGED_ENDPOINTS=true
ALLOW_SUDO_COMMANDS=true
SUDO_PASSWORD=dev-password

# Commands
MAX_COMMAND_TIMEOUT=30000
ALLOWED_SCRIPT_PATHS=/scripts,./api/scripts

# Notifications
ALERT_EMAIL=dev@example.com
WEBHOOK_LOG_URL=https://webhook.site/test
```

### Staging
```bash
# Tokens
API_TOKEN=staging-token-abcdef1234567890abcdef1234567890abcdef12

# Server
PORT=3000
LOG_LEVEL=info
NODE_ENV=staging

# Security
ENABLE_PRIVILEGED_ENDPOINTS=true
ALLOW_SUDO_COMMANDS=true
SUDO_PASSWORD=staging-password

# Commands
MAX_COMMAND_TIMEOUT=60000
ALLOWED_SCRIPT_PATHS=/scripts

# Notifications
ALERT_EMAIL=staging-admin@example.com
WEBHOOK_LOG_URL=https://webhook.site/staging
```

### Production
```bash
# Tokens
API_TOKEN=prod-token-prod1234567890abcdefabcdefabcdefabcdefabcd

# Server
PORT=3000
LOG_LEVEL=warn
NODE_ENV=production

# Security
ENABLE_PRIVILEGED_ENDPOINTS=false
ALLOW_SUDO_COMMANDS=false
SUDO_PASSWORD=prod-password

# Commands
MAX_COMMAND_TIMEOUT=120000
ALLOWED_SCRIPT_PATHS=/scripts

# Notifications
ALERT_EMAIL=prod-admin@example.com
WEBHOOK_LOG_URL=https://webhook.site/prod
```

## 📝 Environment Variable Reference Table

| Variable | Type | Required | Default | Min | Max | Notes |
|----------|------|----------|---------|-----|-----|-------|
| `API_TOKEN` | string | ✅ | - | 32 | 256 | Bearer token |
| `PORT` | number | ✅ | - | 1 | 65535 | Server port |
| `LOG_LEVEL` | enum | ❌ | `info` | - | - | debug, info, warn, error |
| `SUDO_PASSWORD` | string | ❌ | - | 0 | 256 | Password for sudo |
| `ENABLE_PRIVILEGED_ENDPOINTS` | boolean | ❌ | `true` | - | - | true or false |
| `ALLOW_SUDO_COMMANDS` | boolean | ❌ | `true` | - | - | true or false |
| `MAX_COMMAND_TIMEOUT` | number | ❌ | `30000` | 1000 | 600000 | Milliseconds |
| `ALLOWED_SCRIPT_PATHS` | string | ❌ | `/scripts` | - | - | Comma-separated |
| `ALERT_EMAIL` | string | ❌ | - | - | 256 | Email address |
| `WEBHOOK_LOG_URL` | string | ❌ | - | - | 2048 | HTTPS URL |
| `NODE_ENV` | enum | ❌ | `development` | - | - | development, staging, production |

## 🔍 Validation Examples

### Invalid API_TOKEN
```bash
# ❌ Too short
API_TOKEN=short

# ✅ Valid
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Invalid PORT
```bash
# ❌ Outside range
PORT=99999

# ✅ Valid
PORT=3000
```

### Invalid LOG_LEVEL
```bash
# ❌ Unknown level
LOG_LEVEL=verbose

# ✅ Valid
LOG_LEVEL=info
```

### Invalid TIMEOUT
```bash
# ❌ Too small
MAX_COMMAND_TIMEOUT=100

# ✅ Valid
MAX_COMMAND_TIMEOUT=30000
```

## 🚀 Loading Variables

### From `.env` file
```bash
# Automatically loaded by dotenv
npm run dev
```

### From command line
```bash
# Override .env
API_TOKEN=custom-token npm run dev

# Multiple variables
API_TOKEN=custom PORT=5000 npm run dev
```

### From system environment
```bash
# Linux/Mac
export API_TOKEN=my-token
npm run dev

# Windows
set API_TOKEN=my-token
npm run dev
```

## 🔐 Security Notes

### Never Do This
```bash
# ❌ Commit .env
git add .env

# ❌ Show token in logs
console.log(process.env.API_TOKEN)

# ❌ Hardcode values
const token = "my-secret";

# ❌ Use same token everywhere
# (dev and prod should be different)
```

### Always Do This
```bash
# ✅ Use .env in .gitignore
echo ".env" >> .gitignore

# ✅ Generate secure tokens
openssl rand -hex 32

# ✅ Rotate credentials regularly
# Change tokens every 3-6 months

# ✅ Different tokens per environment
# dev-token != staging-token != prod-token
```

## 🆘 Troubleshooting

### Variables not loading
```bash
# Check if .env exists
ls -la api/.env

# Check content
cat api/.env

# Try restarting
npm run dev
```

### Token validation error
```bash
# Verify token is valid (32+ characters)
grep API_TOKEN api/.env | wc -c

# Should be at least 32 characters
# Generate new if needed
openssl rand -hex 32
```

### Port already in use
```bash
# Check what's using the port
lsof -i :3000

# Use different port
PORT=3001 npm run dev
```

## 📚 Related Documentation

- See [`docs/guides/CONFIGURATION.md`](CONFIGURATION.md) for configuration details
- See [`docs/guides/AUTHENTICATION.md`](AUTHENTICATION.md) for token usage
- See [`docs/guides/INSTALLATION.md`](../guides/INSTALLATION.md) for installation
