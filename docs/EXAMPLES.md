# Examples - Ejemplos de Uso

## Table of Contents
- [API Endpoint Examples](#api-endpoint-examples)
- [Command Execution](#command-execution)
- [Batch Operations](#batch-operations)
- [Resource Monitoring](#resource-monitoring)
- [Advanced Usage](#advanced-usage)

---

## API Endpoint Examples

### Health Check
```bash
curl -X GET http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-08T17:42:00.000Z",
  "uptime": 3600,
  "memory": {
    "used": 152,
    "total": 8192,
    "percentage": 1.85
  }
}
```

### API Information
```bash
curl -X GET http://localhost:3000/
```

**Response:**
```json
{
  "name": "VPS Local Orchestrator API",
  "version": "v1.0.0",
  "description": "Enterprise-grade VPS orchestration and monitoring",
  "documentation": "https://github.com/Sebas1705/VPSLocalOrchestrator/wiki",
  "features": [
    "Command execution",
    "Resource monitoring",
    "RBAC",
    "Encryption",
    "Event sourcing",
    "Audit logging",
    "Health checks"
  ]
}
```

---

## Command Execution

### Execute Single Command

```bash
curl -X POST http://localhost:3000/api/command/execute \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "ls -la /home",
    "timeout": 5000,
    "shell": "/bin/bash"
  }'
```

**Response:**
```json
{
  "success": true,
  "executionId": "cmd_abc123def456",
  "command": "ls -la /home",
  "output": "total 24\ndrwxr-xr-x 4 root root 4096 Dec  8 17:00 .\ndrwxr-xr-x 25 root root 4096 Dec  8 17:00 ..\ndrwx------ 5 sebss sebss 4096 Dec  8 17:00 sebss",
  "exitCode": 0,
  "duration": 125,
  "timestamp": "2025-12-08T17:42:30.000Z"
}
```

### Execute with Environment Variables

```bash
curl -X POST http://localhost:3000/api/command/execute \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "echo $MY_VAR",
    "timeout": 5000,
    "env": {
      "MY_VAR": "Hello World"
    }
  }'
```

---

## Batch Operations

### Execute Multiple Commands

```bash
curl -X POST http://localhost:3000/api/command/batch \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {
        "command": "pwd",
        "timeout": 3000
      },
      {
        "command": "whoami",
        "timeout": 3000
      },
      {
        "command": "uname -a",
        "timeout": 3000
      }
    ],
    "failOnError": false
  }'
```

**Response:**
```json
{
  "success": true,
  "batchId": "batch_xyz789abc123",
  "results": [
    {
      "index": 0,
      "command": "pwd",
      "output": "/home/sebss",
      "exitCode": 0,
      "duration": 45,
      "success": true
    },
    {
      "index": 1,
      "command": "whoami",
      "output": "sebss",
      "exitCode": 0,
      "duration": 38,
      "success": true
    },
    {
      "index": 2,
      "command": "uname -a",
      "output": "Linux vps 5.15.0-1234 #1 SMP x86_64 GNU/Linux",
      "exitCode": 0,
      "duration": 52,
      "success": true
    }
  ],
  "totalDuration": 135,
  "successCount": 3,
  "failureCount": 0
}
```

---

## Resource Monitoring

### Get System Resources

```bash
curl -X GET http://localhost:3000/api/resources
```

**Response:**
```json
{
  "cpu": {
    "cores": 4,
    "usage": 25.5,
    "loadAverage": [0.85, 0.92, 0.78],
    "loadPerCore": [0.2125, 0.23, 0.195, 0.2125]
  },
  "memory": {
    "total": 8589934592,
    "used": 3221225472,
    "free": 5368709120,
    "percentage": 37.5,
    "swap": {
      "total": 2147483648,
      "used": 536870912,
      "free": 1610612736,
      "percentage": 25.0
    }
  },
  "disk": {
    "root": {
      "total": 107374182400,
      "used": 53687091200,
      "free": 53687091200,
      "percentage": 50.0
    },
    "home": {
      "total": 1099511627776,
      "used": 549755813888,
      "free": 549755813888,
      "percentage": 50.0
    }
  },
  "uptime": 864000,
  "timestamp": "2025-12-08T17:42:30.000Z"
}
```

### Get Top Processes

```bash
curl -X GET http://localhost:3000/api/resources/processes
```

**Response:**
```json
{
  "processes": [
    {
      "pid": 1234,
      "name": "node",
      "user": "sebss",
      "cpu": 5.2,
      "memory": {
        "rss": 234881024,
        "percentage": 2.75
      },
      "state": "S"
    },
    {
      "pid": 5678,
      "name": "systemd",
      "user": "root",
      "cpu": 0.1,
      "memory": {
        "rss": 67108864,
        "percentage": 0.78
      },
      "state": "S"
    }
  ],
  "count": 10,
  "timestamp": "2025-12-08T17:42:30.000Z"
}
```

### Terminate Process

```bash
curl -X DELETE http://localhost:3000/api/resources/process/1234
```

**Response:**
```json
{
  "success": true,
  "pid": 1234,
  "message": "Process terminated successfully",
  "signal": "SIGTERM",
  "timestamp": "2025-12-08T17:42:35.000Z"
}
```

---

## Advanced Usage

### Privileged Command Execution

```bash
curl -X POST http://localhost:3000/api/privileged/execute \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "systemctl restart nginx",
    "timeout": 10000,
    "requiresElevation": true
  }'
```

### Get Service Health Status

```bash
curl -X GET http://localhost:3000/api/services/nginx/health \
  -H "Authorization: Bearer your-secret-token"
```

**Response:**
```json
{
  "service": "nginx",
  "status": "running",
  "statusCode": 200,
  "checks": {
    "process": "running",
    "port": "listening",
    "responsiveness": "healthy"
  },
  "metrics": {
    "uptime": 864000,
    "restarts": 0,
    "lastCheck": "2025-12-08T17:42:30.000Z"
  }
}
```

### Query Audit Logs

```bash
curl -X GET "http://localhost:3000/api/audit?action=command_execute&limit=10" \
  -H "Authorization: Bearer your-secret-token"
```

**Response:**
```json
{
  "logs": [
    {
      "id": "audit_123",
      "timestamp": "2025-12-08T17:42:30.000Z",
      "action": "command_execute",
      "user": "admin",
      "resource": "/api/command/execute",
      "details": {
        "command": "ls -la",
        "exitCode": 0,
        "duration": 125
      },
      "status": "success"
    }
  ],
  "count": 1,
  "total": 245
}
```

---

## Integration Examples

### Postman Collection

Use the Postman collection in `webhooks/webhooks.json` to test all endpoints.

### n8n Workflow Integration

VPS Orchestrator integrates with n8n for workflow automation:

1. **Command Execution Node**: Execute arbitrary shell commands
2. **Resource Monitoring Node**: Get real-time system metrics
3. **Service Management Node**: Control system services
4. **Audit Logging Node**: Track all operations

Example n8n webhook configuration:
```json
{
  "type": "webhook",
  "method": "POST",
  "url": "http://localhost:3000/api/command/execute",
  "headers": {
    "Authorization": "Bearer your-secret-token",
    "Content-Type": "application/json"
  }
}
```

---

## Error Handling Examples

### Invalid Authorization

```bash
curl -X POST http://localhost:3000/api/command/execute \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"command": "ls"}'
```

**Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token",
  "code": "AUTH_001",
  "timestamp": "2025-12-08T17:42:30.000Z"
}
```

### Rate Limit Exceeded

**Response (429):**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Retry after 60 seconds",
  "code": "RATE_LIMIT_001",
  "retryAfter": 60,
  "timestamp": "2025-12-08T17:42:30.000Z"
}
```

### Command Execution Timeout

**Response (504):**
```json
{
  "error": "Timeout",
  "message": "Command execution exceeded timeout of 5000ms",
  "code": "CMD_TIMEOUT_001",
  "command": "long-running-command",
  "duration": 5000,
  "timestamp": "2025-12-08T17:42:30.000Z"
}
```

---

## Testing with curl

### Test Authentication

```bash
# Without token (should fail)
curl -X POST http://localhost:3000/api/command/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "echo test"}'

# With valid token (should succeed)
curl -X POST http://localhost:3000/api/command/execute \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"command": "echo test"}'
```

### Test Rate Limiting

```bash
# Rapid requests to test rate limiting
for i in {1..100}; do
  curl -X GET http://localhost:3000/api/resources \
    -H "Authorization: Bearer your-secret-token" &
done
wait
```

### Test Error Handling

```bash
# Timeout test (long command)
curl -X POST http://localhost:3000/api/command/execute \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "sleep 10",
    "timeout": 1000
  }'

# Invalid input
curl -X POST http://localhost:3000/api/command/execute \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"invalid_field": "test"}'
```

---

## Docker Usage

### Run with Docker

```bash
docker run -e API_TOKEN=your-secret-token \
  -p 3000:3000 \
  sebas1705/vps-orchestrator:v1.0.0
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  orchestrator:
    image: sebas1705/vps-orchestrator:v1.0.0
    environment:
      - API_TOKEN=your-secret-token
      - NODE_ENV=production
      - LOG_LEVEL=info
    ports:
      - "3000:3000"
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

---

## Performance Testing

### Load Testing with Apache Bench

```bash
# Single request
ab -n 1 -c 1 http://localhost:3000/api/resources

# 1000 requests with 10 concurrent
ab -n 1000 -c 10 -H "Authorization: Bearer your-secret-token" \
  http://localhost:3000/api/resources
```

### Load Testing with wrk

```bash
wrk -t 4 -c 100 -d 30s \
  -H "Authorization: Bearer your-secret-token" \
  http://localhost:3000/api/resources
```

---

## Support

For more examples and use cases, visit:
- 📚 [GETTING_STARTED.md](./GETTING_STARTED.md) - Setup and configuration
- 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- 📡 [ENDPOINTS.md](./core/ENDPOINTS.md) - Complete API reference
- 🔐 [SECURITY.md](./guides/SECURITY.md) - Security best practices

Last updated: 2025-12-08
