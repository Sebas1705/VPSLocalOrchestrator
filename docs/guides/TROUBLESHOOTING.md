# 🔍 Troubleshooting Guide

Common issues and their solutions for VPS Local Orchestrator.

---

## 🚨 Installation Issues

### Error: "Cannot find module 'typescript'"

**Problem**: TypeScript is not installed.

**Solution:**
```bash
npm install --save-dev typescript ts-node
npm run build
```

---

### Error: "Port 3000 is already in use"

**Problem**: Another service is using port 3000.

**Solutions:**

**Option 1**: Kill the process
```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```

**Option 2**: Change port
```bash
# Edit .env
PORT=5000

# Restart server
npm run dev
```

---

### Error: "EACCES: permission denied"

**Problem**: Insufficient permissions.

**Solutions:**

**For development:**
```bash
# Change directory ownership
sudo chown -R $USER:$USER /home/sebss/apps/VPSLocalOrchestrator

# Fix npm permissions
sudo chown -R $USER:$USER ~/.npm
```

**For production:**
```bash
# Run as service with proper user
sudo systemctl start vps-orchestrator
```

---

## 🔐 Authentication Issues

### Error: "Unauthorized" (401)

**Problem**: Missing or invalid API token.

**Check 1**: Token is in request
```bash
# ❌ Wrong - no token
curl -X POST http://127.0.0.1:3000/api/command/execute

# ✅ Correct - with token
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Check 2**: Token matches .env
```bash
# View current token
grep API_TOKEN .env

# Test with exact token
TOKEN=$(grep API_TOKEN .env | cut -d '=' -f2)
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "whoami"}'
```

**Check 3**: Token has correct format
```bash
# Token should be 32+ characters
# Generate new token if needed
openssl rand -hex 32
```

---

### Error: "Valid API token required"

**Problem**: Token validation failed.

**Solutions:**

1. Regenerate token:
```bash
# Generate new token
TOKEN=$(openssl rand -hex 32)

# Update .env
sed -i "s/API_TOKEN=.*/API_TOKEN=$TOKEN/" .env

# Restart server
npm run dev
```

2. Check for special characters:
```bash
# Token should only contain: a-f, 0-9
# No spaces, quotes, or special characters
```

---

## ⚙️ Runtime Errors

### Error: "Command execution timeout"

**Problem**: Command took too long to execute.

**Solutions:**

**Option 1**: Increase timeout
```bash
# Edit .env
MAX_COMMAND_TIMEOUT=600000  # 10 minutes

# Restart server
```

**Option 2**: Run command in background
```bash
# Instead of long-running command
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "nohup long-process.sh &"}'
```

---

### Error: "Command failed with exit code 127"

**Problem**: Command not found.

**Solutions:**

1. Check command exists:
```bash
which <command>
```

2. Use full path:
```bash
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "/usr/bin/python3 script.py"}'
```

3. Check PATH:
```bash
# Show current PATH
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "echo $PATH"}'
```

---

### Error: "sudo: no tty present"

**Problem**: sudo requires password but no TTY available.

**Solutions:**

**Option 1**: Configure passwordless sudo (recommended)
```bash
# Edit sudoers
sudo visudo

# Add line (replace <user> with your username)
<user> ALL=(ALL) NOPASSWD: ALL
```

**Option 2**: Set sudo password in .env
```bash
# Edit .env
SUDO_PASSWORD=your-password

# Restart server
```

---

## 📊 Resource Monitoring Issues

### Error: "Cannot read system resources"

**Problem**: Missing system utilities.

**Solutions:**

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y sysstat procps net-tools
```

**CentOS/RHEL:**
```bash
sudo yum install -y sysstat procps-ng net-tools
```

---

### Metrics showing 0 or NaN

**Problem**: Metrics collection not working.

**Solutions:**

1. Check sysstat is running:
```bash
sudo systemctl status sysstat
sudo systemctl start sysstat
```

2. Manually test:
```bash
# CPU info
cat /proc/cpuinfo

# Memory info
free -m

# Disk info
df -h
```

---

## 🐳 Docker Issues

### Error: "Cannot connect to Docker daemon"

**Problem**: Docker is not running or user lacks permissions.

**Solutions:**

**Option 1**: Start Docker
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

**Option 2**: Add user to docker group
```bash
sudo usermod -aG docker $USER
newgrp docker

# Test
docker ps
```

---

### Error: "Container not found"

**Problem**: Container doesn't exist.

**Solution:**
```bash
# List all containers
curl http://127.0.0.1:3000/api/docker/containers

# Check container exists
docker ps -a | grep <container-name>
```

---

## 🔧 Systemd Service Issues

### Service won't start

**Problem**: Systemd service configuration error.

**Check logs:**
```bash
sudo journalctl -u vps-orchestrator -n 50 --no-pager
```

**Common fixes:**

1. Check file paths:
```bash
# Verify paths in service file
sudo cat /etc/systemd/system/vps-orchestrator.service

# Ensure files exist
ls -la /home/sebss/apps/VPSLocalOrchestrator/api/dist/index.js
```

2. Reload systemd:
```bash
sudo systemctl daemon-reload
sudo systemctl restart vps-orchestrator
```

3. Check permissions:
```bash
# Service file should be owned by root
sudo chown root:root /etc/systemd/system/vps-orchestrator.service
sudo chmod 644 /etc/systemd/system/vps-orchestrator.service
```

---

### Service stops immediately

**Problem**: Error in application code.

**Debug:**
```bash
# View recent logs
sudo journalctl -u vps-orchestrator -f

# Run manually to see errors
cd /home/sebss/apps/VPSLocalOrchestrator/api/dist
node index.js
```

---

## 🌐 Network Issues

### Cannot connect from remote machine

**Problem**: Server only listens on localhost.

**Solution:**

**For testing only (⚠️ security risk):**
```typescript
// api/src/index.ts
app.listen(PORT, '0.0.0.0', () => {  // Listen on all interfaces
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
```

**For production (recommended):**
Use reverse proxy (nginx/Apache):
```nginx
# /etc/nginx/sites-available/vps-orchestrator
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

### Timeout connecting to API

**Problem**: Firewall blocking connections.

**Solutions:**

1. Check firewall:
```bash
# UFW (Ubuntu)
sudo ufw status
sudo ufw allow 3000/tcp

# Firewalld (CentOS)
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --reload
```

2. Test connectivity:
```bash
# From remote machine
curl -v http://your-server-ip:3000/health

# Check if port is listening
sudo netstat -tlnp | grep 3000
```

---

## 📝 Logging Issues

### No logs appearing

**Problem**: Log level too high.

**Solution:**
```bash
# Edit .env
LOG_LEVEL=debug  # Show all logs

# Restart server
```

---

### Logs too verbose

**Problem**: Too much log output.

**Solution:**
```bash
# Edit .env
LOG_LEVEL=warn  # Only warnings and errors

# For production
LOG_LEVEL=error  # Only errors
```

---

## 💾 Database Issues

### Error: "Database file is locked"

**Problem**: Multiple processes accessing database.

**Solutions:**

1. Check for multiple instances:
```bash
ps aux | grep node
# Kill duplicate processes
sudo kill <PID>
```

2. Remove lock file:
```bash
rm /path/to/database.db-shm
rm /path/to/database.db-wal
```

---

## 🧪 Testing Issues

### Tests failing

**Problem**: Various test failures.

**Solutions:**

1. Clean and reinstall:
```bash
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
npm test
```

2. Run specific test:
```bash
npm test -- --testNamePattern="specific test name"
```

3. Check test database:
```bash
# Tests should use separate database
# Verify in test configuration
```

---

## 🆘 Getting Help

If you still have issues:

1. **Check logs**: `sudo journalctl -u vps-orchestrator -n 100`
2. **Review documentation**: `/docs/`
3. **See curl samples**: [Endpoint usage examples](/docs/examples/ENDPOINT_EXAMPLES.md)
3. **Search issues**: GitHub Issues
4. **Create issue**: Include logs, .env (without secrets), and steps to reproduce

---

## 📚 Additional Resources

- [Installation Guide](/docs/guides/INSTALLATION.md)
- [Configuration Guide](/docs/guides/CONFIGURATION.md)
- [API Documentation](/docs/core/ENDPOINTS.md)
- [Testing Guide](/docs/core/TESTING.md)

---

**Last Updated**: December 8, 2025
