# Endpoint Usage Examples

Practical curl examples for VPS Local Orchestrator API. Replace `YOUR_TOKEN` with your API token.

## Public Endpoints (no auth)

### Health
```bash
curl -s http://127.0.0.1:3000/health
```

### API Info
```bash
curl -s http://127.0.0.1:3000/
```

### System Resources
```bash
curl -s http://127.0.0.1:3000/api/resources | jq
```

### Processes (top N)
```bash
curl -s "http://127.0.0.1:3000/api/resources/processes?limit=10" | jq
```

### Kill Process by PID
```bash
curl -X DELETE -s http://127.0.0.1:3000/api/resources/process/12345
```

### Network Stats
```bash
curl -s http://127.0.0.1:3000/api/resources/network | jq
```

## Protected Endpoints (auth required)
Set header `Authorization: Bearer YOUR_TOKEN`.

### Execute Command
```bash
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "echo hello"}'
```

### Batch Commands
```bash
curl -X POST http://127.0.0.1:3000/api/command/batch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"commands": ["df -h", "free -h", "uptime"]}'
```

### Privileged Command (service status)
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "systemctl status nginx"}'
```

### Privileged Batch (multiple service actions)
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/batch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"commands": ["systemctl restart nginx", "systemctl status nginx"]}'
```

### Service Control (privileged)
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/service \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service": "nginx", "action": "restart"}'
```

### Services Health (per service)
```bash
curl -s http://127.0.0.1:3000/api/services/nginx/health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Logs (list)
```bash
curl -s http://127.0.0.1:3000/api/logs \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### Logs Search
```bash
curl -X POST http://127.0.0.1:3000/api/logs/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "error", "limit": 50}' | jq
```

### Process Priority (nice)
```bash
curl -X POST http://127.0.0.1:3000/api/processes/set-priority/12345 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"priority": 10}'
```

## Docker (if enabled)

### List Containers
```bash
curl -s http://127.0.0.1:3000/api/docker/containers \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### Start Container
```bash
curl -X POST http://127.0.0.1:3000/api/docker/containers/myapp/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Stop Container
```bash
curl -X POST http://127.0.0.1:3000/api/docker/containers/myapp/stop \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Container Logs (last 100 lines)
```bash
curl -s "http://127.0.0.1:3000/api/docker/containers/myapp/logs?tail=100" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Database & Backup (if enabled)

### Database Status
```bash
curl -s http://127.0.0.1:3000/api/database/status \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### Database Backup
```bash
curl -X POST http://127.0.0.1:3000/api/database/backup \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Audit & Analytics (if enabled)

### Audit Logs
```bash
curl -s http://127.0.0.1:3000/api/audit?limit=100 \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### Audit Search
```bash
curl -X POST http://127.0.0.1:3000/api/audit/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "command_execute", "limit": 50}' | jq
```

### Metrics Snapshot
```bash
curl -s http://127.0.0.1:3000/api/analytics/snapshot \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### Metrics Aggregate
```bash
curl -s "http://127.0.0.1:3000/api/analytics/aggregate?metric=cpu&aggregation=avg&interval=hour" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### Metrics Trend
```bash
curl -s "http://127.0.0.1:3000/api/analytics/trend?metric=memory&period=24h" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

## Webhooks (if enabled)

### Create Webhook Subscription
```bash
curl -X POST http://127.0.0.1:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-webhook.com/endpoint", "events": ["command_execute", "service_restart"]}'
```

### List Webhooks
```bash
curl -s http://127.0.0.1:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### Delete Webhook
```bash
curl -X DELETE http://127.0.0.1:3000/api/webhooks/<id> \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---
**Tip:** Use `jq` for pretty-printing JSON responses. In production, access the API via HTTPS behind a reverse proxy (nginx) and keep tokens secure.
