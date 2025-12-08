# Security & Examples

Version: v1.0.3

## Security essentials
- **Auth**: Bearer token; generate strong token with `openssl rand -hex 32`, store in `.env` as `API_TOKEN`.
- **Rotation**: Change token every 30-60 days (prod) or 90 days (dev); update `.env` and restart.
- **Sudo**: `/api/command/service` uses `sudo -n`; configure passwordless sudo to avoid 403.
- **Network**: Bind to `127.0.0.1` (default) for localhost-only; use reverse proxy (nginx) for prod access.
- **Secrets**: Keep `.env` secret; never commit to git.
- **Audit**: All protected operations logged.

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

### Resource monitoring (public)
```bash
curl http://localhost:3000/api/resources
curl http://localhost:3000/api/resources/processes?limit=5
curl http://localhost:3000/api/resources/network
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
  -H "Content-Type: application/json" \
  -d '{"priority":10}'
```

### Docker container list (public)
```bash
curl http://localhost:3000/api/docker/containers
```

### File operations
```bash
curl -X POST http://localhost:3000/api/file \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"path":"/tmp/test.txt","content":"Hello"}'
```

### OpenAPI schema (public)
```bash
curl http://localhost:3000/api/openapi.json
```

More examples: `docs/examples/ENDPOINT_EXAMPLES.md`
