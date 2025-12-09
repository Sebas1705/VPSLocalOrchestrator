git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
# VPS Local Orchestrator

Version: v1.0.3 · Node 18+ · TypeScript 5+

Production-ready API to orchestrate VPS resources and execute local commands with RBAC, encryption, auditing, metrics, and tracing.

## Quick start

```bash
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api
npm install
cp docs/examples/.env.example .env  # set API_TOKEN
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
- Docker: `docker build -t vps-orchestrator . && docker run -e API_TOKEN=token -p 3000:3000 vps-orchestrator`
- Systemd: copy `vps-orchestrator.service`, then `systemctl enable --now vps-orchestrator`

## Support
Docs: `docs/` · Issues: GitHub · License: MIT
