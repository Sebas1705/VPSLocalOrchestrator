git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
# VPS Local Orchestrator

Version: v1.0.3 · Node 18+ · TypeScript 5+

Production-ready API to orchestrate VPS resources and execute local commands with RBAC, encryption, auditing, metrics, and tracing.

## Quick start

```bash
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api
npm install
# Create ./api/.env with API_TOKEN, SECRET_KEY (base64 32 bytes), and PORT=3000
npm run build && npm start
```

Server: http://localhost:3000

## Essential docs
- Reference: `docs/REFERENCE.md`
- Setup & architecture: `docs/SETUP_ARCHITECTURE.md`
- Security & examples: `docs/SECURITY_EXAMPLES.md`
- Operations: `docs/OPERATIONS.md`
- Development: `docs/DEVELOPMENT.md`
- Roadmap & releases: `docs/ROADMAP_RELEASES.md`
- Testing: `docs/core/TESTING.md`

## Testing

```bash
npm test                     # all tests
npm run test:coverage        # coverage report
```

Current: 555 tests, 23 suites, ~43% coverage (target 80%).

## Deploy quick refs
- Docker Compose: `docker compose build api && docker compose up -d` (binds to 127.0.0.1:3000, auto-restarts via `restart: unless-stopped`)
- Systemd: copy `vps-orchestrator.service`, then `systemctl enable --now vps-orchestrator`

## Containers

```bash
cd VPSLocalOrchestrator
# Provide API_TOKEN and SECRET_KEY in api/.env (SECRET_KEY must be base64 for 32 bytes)
docker compose build api
docker compose up -d
```

- Service is only exposed on the host loopback: `127.0.0.1:${PORT:-3000}`
- Containers restart automatically unless explicitly stopped; ensure Docker starts on boot for server restarts to bring the app back up

## Support
Docs: `docs/` · Issues: GitHub · License: MIT
