# VPS Local Orchestrator

[![CI](https://github.com/Sebas1705/VPSLocalOrchestrator/actions/workflows/ci.yml/badge.svg)](https://github.com/Sebas1705/VPSLocalOrchestrator/actions/workflows/ci.yml)

**v1.2.0** (per `api/package.json` and the `v1.2.0` git tag) · Node 18+ · TypeScript 5 · Express 5

> GitHub Releases lag behind the tags: the latest published release is [v1.0.0](https://github.com/Sebas1705/VPSLocalOrchestrator/releases). Use the tags for the version history.

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
cd api
npm test                 # Jest: 30 suites, 628 tests, no external services needed
npm run test:coverage    # HTML/lcov report in api/coverage/
```

End-to-end smoke test against a running server (starts the API, exercises every endpoint as a client, cleans up):

```bash
scripts/test-api-complete.sh
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) installs, typechecks, runs the suite with coverage and writes the coverage table to the job summary.

## Security model

What the code does today, with the file that does it. Read this before exposing the API anywhere.

**Who can call it.** Authentication is `requireAuth` ([`api/src/middleware/requireAuth.ts`](api/src/middleware/requireAuth.ts)): a single shared bearer token, `API_TOKEN`, compared in constant time with `crypto.timingSafeEqual` ([`api/src/middleware/auth.ts`](api/src/middleware/auth.ts)). It guards the routes that act on the host (`/api/command`, `/api/files`, `/api/secrets`, `/api/docker`, `/api/databases`, `/api/backups`, `/api/workflows`, `/api/webhooks`, `/api/jobs`, `/api/rbac`, `/api/encryption`, `/api/threat`, among others). As of this version the following route modules mount no auth middleware (see [`api/src/index.ts`](api/src/index.ts) and the files under `api/src/routes/`): `/health`, `/api/openapi.json` and `/api/schema`, `/api/resources`, `/api/services`, `/api/logs` (audit log reads), `/api/events`, `/api/eventstore` and `/api/processor`. There are no per-user identities: anyone holding the token can run any guarded endpoint, including arbitrary shell commands (`ALLOW_SUDO_COMMANDS` defaults to on, [`api/src/config/index.ts`](api/src/config/index.ts)).

**RBAC.** [`api/src/infrastructure/rbac/index.ts`](api/src/infrastructure/rbac/index.ts) ships three default roles: `admin` (every permission), `operator` (read, execute, start/stop/restart services, view metrics and logs, create/cancel jobs) and `viewer` (read, view metrics and logs), plus custom roles with inheritance, managed through `/api/rbac`. It is an in-memory model: it is not wired as a middleware gate on the other routes, so today it does not narrow what a token holder can do.

**Secrets at rest.** [`api/src/services/secretsManager.ts`](api/src/services/secretsManager.ts) encrypts each stored secret with AES-256-GCM (Node `crypto`), a random 12-byte IV per value and the GCM auth tag kept alongside the ciphertext. The key is `SECRET_KEY`, a base64-encoded 32-byte value validated at startup. Ciphertext is written to `api/secrets/secrets.json` (mounted from `./data/secrets` in `docker-compose.yml`). The separate `/api/encryption` vault ([`api/src/infrastructure/encryption/index.ts`](api/src/infrastructure/encryption/index.ts)) also uses AES-256-GCM with key rotation, but keeps keys and secrets in memory only.

**Audit logging.** [`api/src/services/auditLogger.ts`](api/src/services/auditLogger.ts) appends one JSON line per recorded action to `api/logs/audit.log`, queryable through `/api/logs`. [`api/src/infrastructure/audit/index.ts`](api/src/infrastructure/audit/index.ts) adds an in-memory typed event stream exposed at `/api/audit`. Note that `requireAuth` currently logs the raw `Authorization` header to the console, so treat the process logs as sensitive.

**Network assumption.** The server binds to `API_HOST`, default `127.0.0.1` ([`api/src/config/index.ts`](api/src/config/index.ts)); `docker-compose.yml` publishes it on loopback and on the internal `apps-network` for n8n. The `localhostOnly` and `rateLimitMiddleware` middlewares exist ([`api/src/middleware/security.ts`](api/src/middleware/security.ts), [`api/src/middleware/ratelimit.ts`](api/src/middleware/ratelimit.ts)) but are commented out in [`api/src/index.ts`](api/src/index.ts), so the token is the only barrier. The design assumes a trusted network: run it behind a reverse proxy or VPN on a host you control, and never expose port 3000 to the Internet directly. A leaked token is equivalent to shell access on the host.

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
