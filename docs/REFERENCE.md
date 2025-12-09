# Reference

Version: v1.0.3 · Tests: 555 (23 suites) · Coverage: ~43% (target 80%)

## Quick start
```bash
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api
npm install
cp docs/examples/.env.example .env  # set API_TOKEN
npm run build && npm start
```
Server: http://localhost:3000

## Auth
`Authorization: Bearer <API_TOKEN>` for protected routes.

## Key endpoints (public noted)
- Public: `GET /`, `GET /health`, `GET /api/resources`, `GET /api/resources/processes`, `GET /api/resources/network`, `GET /api/openapi.json`
- Commands: `POST /api/command/execute`, `POST /api/command/batch`, `POST /api/command/service` (passwordless sudo recommended)
- Resources: `GET /api/resources`, `/processes`, `/network`; `POST /api/resources/process/:pid/priority`; `DELETE /api/resources/process/:pid`
- Files/backups: `GET|POST /api/file`, `POST /api/file/upload`, `POST /api/backup/create`, `POST /api/backup/restore`
- Jobs/workflows: `POST /api/jobs`, `GET /api/jobs/:id`, `POST /api/workflows/run`
- Security/RBAC: `POST /api/auth/validate`, `GET /api/rbac/roles`, `GET /api/rbac/permissions`
- Observability: `GET /api/metrics`, `GET /api/logs`, `GET /api/tracing`
- Docker/system: `GET /api/docker/containers`, `POST /api/docker/containers/:id/:action`, `GET /api/services`

Full contract: `GET /api/openapi.json` (public). Examples: `docs/examples/ENDPOINT_EXAMPLES.md`.

## Testing
```bash
npm test                  # all
npm run test:coverage     # coverage HTML: coverage/lcov-report/index.html
npm run test:watch        # watch mode
```
Cleanup runs via `tests/setup.ts` (removes generated dirs before/after).

## Deployment quick refs
- Docker: `docker build -t vps-orchestrator . && docker run -e API_TOKEN=token -p 3000:3000 vps-orchestrator`
- Systemd: copy `vps-orchestrator.service`, then `systemctl enable --now vps-orchestrator`

## Links
- Quick sheet: `docs/QUICK_REFERENCE.md`
- Setup & architecture: `docs/SETUP_ARCHITECTURE.md`
- Security & examples: `docs/SECURITY_EXAMPLES.md`
- Testing guide: `docs/core/TESTING.md`
- Coverage report: `TEST_COVERAGE_EXPANSION_REPORT.md`
- Operations: `docs/OPERATIONS.md`
- Roadmap & releases: `docs/ROADMAP_RELEASES.md`
