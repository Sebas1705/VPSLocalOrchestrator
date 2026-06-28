# VPS Local Orchestrator

**v1.2.0** · Node 18+ · TypeScript 5 · Express 5

A self-hosted REST API for orchestrating VPS resources and executing commands locally — with production-grade features built in: role-based access control, AES-256-GCM encryption, structured audit logging, Prometheus metrics, distributed tracing, rate limiting, and more.

Designed to run on your own VPS behind a reverse proxy, giving you a secure HTTP interface to automate infrastructure tasks without exposing SSH.

## Why

Managing a VPS typically means SSH + manual commands. This API wraps those operations behind a single authenticated HTTP surface with:

- Fine-grained RBAC — different tokens, different permissions
- A full audit trail of every command executed
- Automatic metrics and tracing you can hook into Grafana
- Secret encryption at rest

## Features

| Category | Capabilities |
|---|---|
| **Security** | RBAC with role/permission model, AES-256-GCM secret encryption, threat detection, rate limiting per route |
| **Commands** | Execute shell commands via authenticated endpoints |
| **Docker** | Start/stop/inspect containers and services |
| **Services** | Manage systemd services |
| **Files** | Read, write, and manage files on the host |
| **Database** | Run queries and migrations |
| **Jobs** | Schedule and track background jobs |
| **Observability** | Prometheus metrics, structured audit logs, distributed tracing |
| **Events** | Event store, event processor, webhook delivery |
| **Workflows** | Define and execute multi-step automation workflows |
| **Backups** | Trigger and track backup operations |
| **Load Balancing** | Circuit breaker pattern, load balancer routing |
| **API Docs** | OpenAPI spec auto-generated at runtime |

## Quick Start

```bash
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api
npm install

# Create api/.env with:
# API_TOKEN=your_secret_token
# SECRET_KEY=$(openssl rand -base64 32)
# PORT=3000

npm run build && npm start
```

Server: `http://localhost:3000`

## Deploy

**Docker Compose** (recommended):
```bash
cd VPSLocalOrchestrator
# Set API_TOKEN and SECRET_KEY in api/.env
docker compose build api
docker compose up -d
```
The service binds to `127.0.0.1:3000` only — put Nginx or Caddy in front.

**Systemd**:
```bash
cp vps-orchestrator.service /etc/systemd/system/
systemctl enable --now vps-orchestrator
```

## Tech Stack

| | |
|---|---|
| Runtime | Node.js 18+ |
| Language | TypeScript 5 |
| Framework | Express 5 |
| Validation | Zod 4 |
| Testing | Jest 30 + Supertest |
| Containers | Docker + Docker Compose |

## Testing

```bash
npm test                 # 555 tests, 23 suites
npm run test:coverage    # ~43% coverage (target: 80%)
```

## Architecture

Clean architecture with clear layer separation:

```
api/src/
├── routes/         <- 27 route modules (one per feature domain)
├── application/    <- Use cases / application services
├── domain/         <- Entities and business rules
├── infrastructure/ <- External integrations (filesystem, DB, Docker)
├── middleware/     <- Auth, rate limiting, error handling
├── services/       <- Cross-cutting services (audit, metrics, encryption)
└── config/         <- Environment and DI configuration
```

## Documentation

Full reference in [`docs/`](./docs/):

| Doc | Content |
|---|---|
| [REFERENCE.md](docs/REFERENCE.md) | Complete API endpoint reference |
| [SETUP_ARCHITECTURE.md](docs/SETUP_ARCHITECTURE.md) | Deployment and design decisions |
| [SECURITY_EXAMPLES.md](docs/SECURITY_EXAMPLES.md) | Auth, RBAC, and encryption examples |
| [OPERATIONS.md](docs/OPERATIONS.md) | Monitoring, alerting, maintenance |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Contributing and adding routes |
| [TESTING.md](docs/TESTING.md) | Test strategy and coverage |
| [ROADMAP_RELEASES.md](docs/ROADMAP_RELEASES.md) | Changelog and upcoming features |

## License

MIT
