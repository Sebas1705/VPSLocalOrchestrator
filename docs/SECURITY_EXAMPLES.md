# Security & Examples

Version: v1.0.3

## Security essentials
- **Auth**: Bearer token; generate strong token with `openssl rand -hex 32`, store in `.env` as `API_TOKEN`.
- **Rotation**: Change token every 30-60 days (prod) or 90 days (dev); update `.env` and restart.
- **Sudo**: off by default. Set `ALLOW_SUDO_COMMANDS=true` and configure passwordless sudo to use mutating `/api/command/service` actions.
- **Network**: Bind to `127.0.0.1` (default) for localhost-only; use reverse proxy (nginx) for prod access.
- **Secrets**: Keep `.env` secret; never commit to git.
- **Audit**: Denied commands are logged, without their arguments. Successful commands are not logged.

## Example requests

### Health check (public)
```bash
curl http://localhost:3000/health
```

### Single command
```bash
curl -X POST http://localhost:3000/api/command/execute \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"command":"whoami"}'
```

### Batch commands
```bash
curl -X POST http://localhost:3000/api/command/batch \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"commands":["pwd","uname -a"]}'
```

### Resource monitoring
```bash
curl -H "Authorization: Bearer <API_TOKEN>" http://localhost:3000/api/resources
curl -H "Authorization: Bearer <API_TOKEN>" "http://localhost:3000/api/resources/processes?limit=5"
curl -H "Authorization: Bearer <API_TOKEN>" http://localhost:3000/api/resources/network
```

### Service management
```bash
curl -X POST http://localhost:3000/api/command/service \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"service":"nginx","action":"status"}'
```

### Process priority
```bash
curl -X POST http://localhost:3000/api/resources/process/1234/priority \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"priority":10}'
```

### Docker container list
```bash
curl -H "Authorization: Bearer <API_TOKEN>" http://localhost:3000/api/docker/containers
```

### File operations
```bash
curl -X POST http://localhost:3000/api/files \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"path":"/tmp/test.txt","content":"Hello"}'
```

### OpenAPI schema (public)
```bash
curl http://localhost:3000/api/openapi.json
```

More examples: `docs/examples/ENDPOINT_EXAMPLES.md`
