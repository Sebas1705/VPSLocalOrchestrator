# 🔒 Security Best Practices

Security guidelines for deploying and maintaining VPS Local Orchestrator in production.

---

## 🎯 Security Overview

VPS Local Orchestrator handles sensitive operations like command execution, system management, and resource monitoring. Following security best practices is critical.

**Security Layers:**
1. Authentication & Authorization
2. Network Security
3. Input Validation
4. Secrets Management
5. Audit Logging
6. System Hardening

---

## 🔐 Authentication & Authorization

### 1. Strong API Tokens

**Generate cryptographically secure tokens:**

```bash
# 64-character token (256 bits)
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**❌ Bad Examples:**
```bash
API_TOKEN=admin123           # Too short, predictable
API_TOKEN=password           # Dictionary word
API_TOKEN=mytoken2024        # Guessable
```

**✅ Good Examples:**
```bash
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

---

### 2. Token Rotation

Rotate tokens regularly:

```bash
# Generate new token
NEW_TOKEN=$(openssl rand -hex 32)

# Update .env
sed -i "s/API_TOKEN=.*/API_TOKEN=$NEW_TOKEN/" .env

# Restart service
sudo systemctl restart vps-orchestrator

# Update clients with new token
# (Coordinate with team to minimize downtime)
```

**Recommended rotation schedule:**
- **Development**: Every 90 days
- **Production**: Every 30-60 days
- **After security incident**: Immediately

---

### 3. Multiple Authentication Levels

Consider implementing role-based access:

```bash
# .env configuration
API_TOKEN_ADMIN=<strong-token>      # Full access
API_TOKEN_READONLY=<strong-token>   # Read-only access
API_TOKEN_MONITOR=<strong-token>    # Monitoring only
```

---

## 🌐 Network Security

### 1. Localhost Only (Default)

**Current configuration** (secure by default):
```typescript
// api/src/index.ts
app.listen(PORT, '127.0.0.1', () => {
  console.log('Server running on http://127.0.0.1:3000');
});
```

**Benefits:**
- ✅ Only accessible from local machine
- ✅ No external exposure
- ✅ Works well for on-host automation tools

---

### 2. Reverse Proxy (Recommended for Remote Access)

If remote access is needed, use reverse proxy:

**Nginx Configuration:**
```nginx
# /etc/nginx/sites-available/vps-orchestrator
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Rate limiting
    limit_req zone=api_limit burst=20 nodelay;

    # IP whitelist (optional)
    allow 203.0.113.0/24;  # Your office IP range
    allow 198.51.100.50;    # Specific trusted IP
    deny all;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
```

**Enable configuration:**
```bash
sudo ln -s /etc/nginx/sites-available/vps-orchestrator /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### 3. Firewall Configuration

**UFW (Ubuntu/Debian):**
```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTPS only (if using nginx)
sudo ufw allow 443/tcp

# Block direct API access
sudo ufw deny 3000/tcp

# Enable firewall
sudo ufw enable
```

**Firewalld (CentOS/RHEL):**
```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --remove-port=3000/tcp
sudo firewall-cmd --reload
```

---

## 🛡️ Input Validation

### 1. Command Length Limits

Already implemented:
```typescript
// Max 10KB per command
if (command.length > 10000) {
  return res.status(400).json({ error: 'Command too long' });
}
```

---

### 2. Command Blacklist

Dangerous commands require authentication:
```typescript
// api/src/middleware/auth.ts
const DANGEROUS_PATTERNS = [
  /^sudo\s+/,
  /^rm\s+-rf/,
  /^shutdown/,
  /^reboot/,
  /^systemctl/,
  /^dd\s+/,
  /^mkfs/,
  /^fdisk/,
  // ... more patterns
];
```

---

### 3. Path Traversal Prevention

**Validate file paths:**
```typescript
// ❌ Dangerous
const filePath = req.body.path;  // Could be ../../etc/passwd

// ✅ Safe
import path from 'path';
const safePath = path.resolve('/allowed/directory', req.body.path);
if (!safePath.startsWith('/allowed/directory')) {
  throw new Error('Invalid path');
}
```

---

## 🔑 Secrets Management

### 1. Environment Variables

**✅ Correct:**
```bash
# Store in .env (never commit)
API_TOKEN=xxx
SUDO_PASSWORD=yyy
DATABASE_PASSWORD=zzz
```

**❌ Incorrect:**
```typescript
// Never hardcode secrets
const token = "my-secret-token";  // ❌
const password = "admin123";       // ❌
```

---

### 2. Secure .env File

```bash
# Set proper permissions
chmod 600 .env
chown <service-user>:<service-group> .env

# Verify
ls -la .env
# Should show: -rw------- (only owner can read/write)
```

---

### 3. External Secrets Manager

For production, consider:

**HashiCorp Vault:**
```bash
# Install Vault
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install vault

# Store secret
vault kv put secret/vps-orchestrator api_token="xxx"

# Retrieve in app
# (Use Vault Node.js client)
```

**AWS Secrets Manager:**
```bash
# Store secret
aws secretsmanager create-secret \
  --name vps-orchestrator/api-token \
  --secret-string "xxx"

# Retrieve in app
# (Use AWS SDK)
```

---

## 📋 Audit Logging

### 1. Enable Audit Logs

Already implemented in Phase 3:
```bash
curl http://127.0.0.1:3000/api/audit?limit=50
```

**Logs contain:**
- Timestamp
- User/IP
- Action performed
- Command executed
- Result (success/failure)

---

### 2. Log Retention

Configure log retention:
```bash
# .env
LOG_RETENTION_DAYS=90  # Keep logs for 90 days
```

**Implement log rotation:**
```bash
# /etc/logrotate.d/vps-orchestrator
/var/log/vps-orchestrator/*.log {
    daily
    rotate 90
    compress
    delaycompress
    missingok
    notifempty
    create 0640 vps-orchestrator vps-orchestrator
}
```

---

### 3. Centralized Logging

Send logs to SIEM or log aggregator:

**Rsyslog:**
```bash
# /etc/rsyslog.d/50-vps-orchestrator.conf
if $programname == 'vps-orchestrator' then @@logserver.example.com:514
& stop
```

**ELK Stack:**
```bash
# Use Filebeat to ship logs
# Configure in filebeat.yml
```

---

## 🔧 System Hardening

### 1. Run as Non-Root User

**Create dedicated user:**
```bash
sudo useradd -r -s /bin/false vps-orchestrator
sudo chown -R vps-orchestrator:vps-orchestrator /home/sebss/apps/VPSLocalOrchestrator
```

**Update systemd service:**
```ini
[Service]
User=vps-orchestrator
Group=vps-orchestrator
```

---

### 2. Sudo Configuration

**Passwordless sudo for specific commands only:**
```bash
sudo visudo

# Add these lines (replace <user> with service user)
<user> ALL=(ALL) NOPASSWD: /bin/systemctl start *
<user> ALL=(ALL) NOPASSWD: /bin/systemctl stop *
<user> ALL=(ALL) NOPASSWD: /bin/systemctl restart *
<user> ALL=(ALL) NOPASSWD: /bin/systemctl status *

# DO NOT allow: ALL=(ALL) NOPASSWD: ALL (too permissive)
```

---

### 3. File Permissions

```bash
# Application files
chmod 755 /home/sebss/apps/VPSLocalOrchestrator
chmod 644 /home/sebss/apps/VPSLocalOrchestrator/api/dist/*.js

# .env file (contains secrets)
chmod 600 /home/sebss/apps/VPSLocalOrchestrator/api/.env

# Database file (if using SQLite)
chmod 660 /home/sebss/apps/VPSLocalOrchestrator/api/data/*.db
```

---

### 4. Disable Unnecessary Endpoints

If you don't need certain features:

```bash
# .env
ENABLE_PRIVILEGED_ENDPOINTS=false  # Disable /api/privileged/*
ALLOW_SUDO_COMMANDS=false          # Block sudo commands
ENABLE_DOCKER_ENDPOINTS=false      # Disable Docker management
```

---

## 🚨 Incident Response

### 1. Suspected Token Compromise

**Immediate actions:**
```bash
# 1. Generate new token
NEW_TOKEN=$(openssl rand -hex 32)

# 2. Update .env
sed -i "s/API_TOKEN=.*/API_TOKEN=$NEW_TOKEN/" .env

# 3. Restart service
sudo systemctl restart vps-orchestrator

# 4. Review audit logs
curl http://127.0.0.1:3000/api/audit?limit=1000 > audit.json
grep -i "suspicious" audit.json

# 5. Check for unauthorized access
sudo journalctl -u vps-orchestrator -since "1 hour ago" | grep "401\|403"
```

---

### 2. Unauthorized Command Execution

**Investigation:**
```bash
# Check recent commands
curl http://127.0.0.1:3000/api/audit | jq '.[] | select(.action=="command_execute")'

# Check suspicious patterns
curl http://127.0.0.1:3000/api/audit | jq '.[] | select(.command | contains("rm -rf"))'

# Review systemd logs
sudo journalctl -u vps-orchestrator -since "24 hours ago" > incident.log
```

---

## ✅ Security Checklist

Before going to production:

- [ ] Strong API token (64+ characters)
- [ ] HTTPS enabled (via reverse proxy)
- [ ] Firewall configured (block direct API access)
- [ ] Rate limiting enabled
- [ ] IP whitelist configured (if applicable)
- [ ] .env file has 600 permissions
- [ ] Service runs as non-root user
- [ ] Sudo limited to specific commands
- [ ] Audit logging enabled
- [ ] Log rotation configured
- [ ] Secrets not in git repository
- [ ] Token rotation schedule established
- [ ] Incident response plan documented
- [ ] Team trained on security policies

---

## 📚 Additional Resources

- [AI Data Protection](/docs/core/AI_DATA_PROTECTION.md)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Last Updated**: December 8, 2025  
**Review Frequency**: Quarterly
