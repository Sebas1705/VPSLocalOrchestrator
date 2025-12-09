# Quick Reference

Version: v1.0.3 · Tests: 555 (~43% coverage, target 80%)

## Run
```bash
npm install
npm run build && npm start
```
Server: http://localhost:3000

## Auth
`Authorization: Bearer <API_TOKEN>`

## Key endpoints
- Info/health: `GET /`, `GET /health`, `GET /api/openapi.json`
- Commands: `POST /api/command/execute`, `POST /api/command/batch`, `POST /api/command/service` (passwordless sudo recommended)
- Resources: `GET /api/resources`, `/processes`, `/network`; `POST /api/resources/process/:pid/priority`; `DELETE /api/resources/process/:pid`
- Files/backups: `GET|POST /api/file`, `POST /api/file/upload`, `POST /api/backup/create`, `POST /api/backup/restore`
- Security: `POST /api/auth/validate`, `GET /api/rbac/roles`, `GET /api/rbac/permissions`
- Observability: `GET /api/metrics`, `GET /api/logs`, `GET /api/tracing`

## Testing
```bash
npm test                  # all
npm run test:coverage     # coverage HTML in coverage/lcov-report/index.html
```

## Docs map
- Reference: `docs/REFERENCE.md`
- Setup & architecture: `docs/SETUP_ARCHITECTURE.md`
- Security & examples: `docs/SECURITY_EXAMPLES.md`
- Operations: `docs/OPERATIONS.md`
- Roadmap & releases: `docs/ROADMAP_RELEASES.md`
- Testing: `docs/core/TESTING.md`
- Coverage details: `TEST_COVERAGE_EXPANSION_REPORT.md`

## Deployment quick refs
- Docker: `docker build -t vps-orchestrator . && docker run -e API_TOKEN=token -p 3000:3000 vps-orchestrator`
- Systemd: copy `vps-orchestrator.service`, then `systemctl enable --now vps-orchestrator`
