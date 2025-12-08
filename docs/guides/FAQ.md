# ❓ Frequently Asked Questions (FAQ)

Common questions about VPS Local Orchestrator.

---

## 📦 Installation & Setup

### Q: What are the system requirements?

**A:** Minimum requirements:
- **OS**: Linux (Ubuntu 20.04+, Debian 10+, CentOS 8+)
- **Node.js**: v18 or higher
- **RAM**: 512 MB minimum, 1 GB recommended
- **Disk**: 100 MB for application
- **CPU**: Any modern CPU (single core sufficient)

---

### Q: Can I run this on Windows or macOS?

**A:** Not officially supported. The application is designed for Linux VPS environments and relies on Linux-specific commands and utilities. However, you could:
- Use WSL2 (Windows Subsystem for Linux) on Windows
- Run in Docker container
- Use a Linux VM

---

### Q: Do I need root access?

**A:** 
- **Installation**: Yes, to install dependencies and configure systemd
- **Running**: No, can run as non-root user
- **Privileged operations**: Requires sudo access (configured via sudoers)

---

## 🔐 Security

### Q: Is it safe to expose this API to the internet?

**A:** By default, **NO**. The API listens only on `127.0.0.1` (localhost) for security. If you need remote access:

1. **Recommended**: Use reverse proxy (nginx) with HTTPS, authentication, and rate limiting
2. **Not recommended**: Change to `0.0.0.0` (exposes to internet without protection)

See: [Security Best Practices](/docs/guides/SECURITY.md)

---

### Q: How secure are the API tokens?

**A:** Very secure when properly configured:
- Validated using timing-safe comparison (prevents timing attacks)
- Minimum 32 characters required
- Should be 64+ characters (256 bits entropy)
- Transmitted via HTTPS (when using reverse proxy)

**Generate secure token:**
```bash
openssl rand -hex 32
```

---

### Q: Can multiple users have different access levels?

**A:** Not natively in v4.0.0. Current implementation has single API token. For role-based access:
- **Workaround**: Use multiple tokens and different endpoints
- **Future**: Phase 5+ will include RBAC (Role-Based Access Control)

---

## 🚀 Usage

### Q: Can I run multiple commands in sequence?

**A:** Yes, use batch execution:

```bash
curl -X POST http://127.0.0.1:3000/api/command/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      "cd /var/www",
      "git pull",
      "npm install",
      "pm2 restart app"
    ]
  }'
```

---

### Q: How do I handle long-running commands?

**A:**

**Option 1**: Increase timeout
```bash
# .env
MAX_COMMAND_TIMEOUT=600000  # 10 minutes
```

**Option 2**: Run in background
```bash
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "nohup long-process.sh > /tmp/output.log 2>&1 &"}'
```

---

### Q: Can I schedule commands to run automatically?

**A:** Not directly. Use external schedulers:

**Option 1**: System cron
```bash
# crontab -e
0 2 * * * curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "backup.sh"}'
```

**Option 2**: systemd timer
```bash
# /etc/systemd/system/vps-backup.service
[Unit]
Description=Run orchestrator backup command

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -X POST http://127.0.0.1:3000/api/command/execute \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type": "application/json" \\
  -d '{"command": "backup.sh"}'

# /etc/systemd/system/vps-backup.timer
[Unit]
Description=Schedule orchestrator backup

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target

sudo systemctl daemon-reload
sudo systemctl enable --now vps-backup.timer
```

---

## 🔧 Configuration

### Q: Where should I store the .env file?

**A:** In the API directory:
```
/home/sebss/apps/VPSLocalOrchestrator/api/.env
```

**Important:**
- ✅ Ensure proper permissions: `chmod 600 .env`
- ✅ Never commit to git
- ✅ Backup securely (encrypted)

---

### Q: Can I use multiple .env files?

**A:** Yes, for different environments:

```bash
# Development
cp .env .env.development
export NODE_ENV=development

# Production
cp .env .env.production
export NODE_ENV=production

# Load appropriate file
node -r dotenv/config dist/index.js dotenv_config_path=.env.${NODE_ENV}
```

---

### Q: What's the difference between PORT and SUDO_PASSWORD?

**A:**

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `PORT` | API listening port | Yes | 3000 |
| `SUDO_PASSWORD` | Sudo password for privileged commands | Optional* | - |

*Only required if:
- `ALLOW_SUDO_COMMANDS=true`
- Passwordless sudo not configured
- Running privileged commands

---

## 📊 Monitoring & Resources

### Q: How do I monitor API health?

**A:** Multiple endpoints available:

```bash
# Basic health check
curl http://127.0.0.1:3000/health

# System resources
curl http://127.0.0.1:3000/api/resources

# Processes
curl http://127.0.0.1:3000/api/resources/processes

# Network
curl http://127.0.0.1:3000/api/resources/network
```

---

### Q: Can I get historical metrics?

**A:** Yes, using analytics endpoints:

```bash
# Get metrics snapshot
curl http://127.0.0.1:3000/api/analytics/snapshot

# Get aggregated data
curl "http://127.0.0.1:3000/api/analytics/aggregate?metric=cpu&aggregation=avg&interval=hour"

# Get trends
curl "http://127.0.0.1:3000/api/analytics/trend?metric=memory&period=24h"
```

---

### Q: How long are metrics stored?

**A:** Currently in-memory (v4.0.0):
- Stored until server restart
- Recommended: Export to time-series database (Prometheus, InfluxDB)
- Phase 5+: SQLite persistence

---

## 🐳 Docker Integration

### Q: Can I manage Docker containers?

**A:** Yes, Docker management is available:

```bash
# List containers
curl http://127.0.0.1:3000/api/docker/containers

# Start container
curl -X POST http://127.0.0.1:3000/api/docker/containers/myapp/start \
  -H "Authorization: Bearer $TOKEN"

# Stop container
curl -X POST http://127.0.0.1:3000/api/docker/containers/myapp/stop \
  -H "Authorization: Bearer $TOKEN"

# View logs
curl http://127.0.0.1:3000/api/docker/containers/myapp/logs?tail=100
```

---

### Q: Do I need Docker installed?

**A:** Only if you want to use Docker management features. All other features work without Docker.

---

### Q: Can I use webhooks for notifications?

**A:** Yes, configure in .env:

```bash
WEBHOOK_LOG_URL=https://webhook.site/your-unique-url
ALERT_EMAIL=admin@example.com
```

Then use webhook endpoints:
```bash
curl -X POST http://127.0.0.1:3000/api/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-webhook.com/endpoint",
    "events": ["command_execute", "service_restart"]
  }'
```

---

## 🐛 Troubleshooting

### Q: Why am I getting "Port 3000 is already in use"?

**A:** Another service is using port 3000. Solutions:

```bash
# Find process using port
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>

# OR change port in .env
PORT=5000
```

---

### Q: Command returns "permission denied"

**A:** Check:

1. **File permissions:**
```bash
chmod +x /path/to/script.sh
```

2. **Sudo configuration:**
```bash
sudo visudo
# Add: <user> ALL=(ALL) NOPASSWD: /path/to/command
```

3. **User running service:**
```bash
# Check service user
sudo systemctl status vps-orchestrator
```

---

### Q: API is slow or timing out

**A:** Possible causes:

1. **Command timeout**: Increase in .env
```bash
MAX_COMMAND_TIMEOUT=600000
```

2. **System resources**: Check usage
```bash
curl http://127.0.0.1:3000/api/resources
```

3. **Network issues**: Check connectivity
```bash
ping 127.0.0.1
netstat -tlnp | grep 3000
```

---

## 📈 Performance

### Q: How many requests can it handle?

**A:** Depends on:
- Server resources
- Command complexity
- Concurrent requests

**Typical performance:**
- Simple commands: 100+ req/sec
- Resource-intensive commands: 10-20 req/sec
- Concurrent commands: Limited by CPU cores

**Optimization:**
- Use batch execution for multiple commands
- Implement rate limiting (via nginx)
- Use caching for frequently accessed data

---

### Q: Can I run multiple instances?

**A:** Yes, but consider:
- Each instance needs unique port
- Shared state (database, logs) requires synchronization
- Load balancer for distribution

**Example:**
```bash
# Instance 1
PORT=3000 node dist/index.js

# Instance 2
PORT=3001 node dist/index.js

# Nginx load balancer
upstream api_backend {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
}
```

---

## 🔄 Updates & Maintenance

### Q: How do I update to a new version?

**A:**

```bash
# Backup current version
cp -r /home/sebss/apps/VPSLocalOrchestrator /backup/VPSLocalOrchestrator.$(date +%Y%m%d)

# Pull latest code
cd /home/sebss/apps/VPSLocalOrchestrator
git pull origin main

# Install dependencies
cd api
npm install

# Rebuild
npm run build

# Restart service
sudo systemctl restart vps-orchestrator

# Verify
curl http://127.0.0.1:3000/health
```

---

### Q: How do I backup my configuration?

**A:**

```bash
# Backup script
#!/bin/bash
BACKUP_DIR="/backup/vps-orchestrator/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Copy configuration
cp /home/sebss/apps/VPSLocalOrchestrator/api/.env $BACKUP_DIR/
cp /home/sebss/apps/VPSLocalOrchestrator/vps-orchestrator.service $BACKUP_DIR/

# Backup database (if using SQLite)
cp /home/sebss/apps/VPSLocalOrchestrator/api/data/*.db $BACKUP_DIR/

# Encrypt backup
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
gpg --encrypt --recipient your-email@example.com $BACKUP_DIR.tar.gz

# Clean up
rm -rf $BACKUP_DIR $BACKUP_DIR.tar.gz
```

---

## 📚 Development

### Q: How do I contribute to the project?

**A:** See [CONTRIBUTING.md](/docs/core/CONTRIBUTING.md)

1. Fork repository
2. Create feature branch
3. Make changes
4. Write tests
5. Submit pull request

---

### Q: How do I run tests?

**A:**

```bash
cd api

# All tests
npm test

# Specific test file
npm test -- command.test.ts

# With coverage
npm run test:coverage

# Watch mode
npm test -- --watch
```

---

### Q: Where can I find more examples?

**A:**

- [Endpoint Examples](/docs/examples/ENDPOINT_EXAMPLES.md)
- [API Documentation](/docs/core/ENDPOINTS.md)
- [Integration Guides](/docs/guides/)

---

## 🆘 Still Have Questions?

1. **Check documentation**: [/docs/](/docs/)
2. **Search issues**: [GitHub Issues](https://github.com/Sebas1705/VPSLocalOrchestrator/issues)
3. **Create new issue**: Include logs, .env (without secrets), and reproduction steps
4. **Contact**: [Open discussion](https://github.com/Sebas1705/VPSLocalOrchestrator/discussions)

---

**Last Updated**: December 8, 2025
