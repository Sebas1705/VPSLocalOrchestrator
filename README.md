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
| **Commands** | Run allowlisted host commands via authenticated endpoints (argv only, no shell) |
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
# Optional: COMMAND_ALLOWLIST=docker,systemctl,df   (see "Security model")

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

**Who can call it.** Authentication is `requireAuth` ([`api/src/middleware/requireAuth.ts`](api/src/middleware/requireAuth.ts)): a single shared bearer token, `API_TOKEN`, compared in constant time with `crypto.timingSafeEqual` ([`api/src/middleware/auth.ts`](api/src/middleware/auth.ts)). It guards the routes that act on the host (`/api/command`, `/api/files`, `/api/secrets`, `/api/docker`, `/api/databases`, `/api/backups`, `/api/workflows`, `/api/webhooks`, `/api/jobs`, `/api/rbac`, `/api/encryption`, `/api/threat`, among others). As of this version the following route modules mount no auth middleware (see [`api/src/index.ts`](api/src/index.ts) and the files under `api/src/routes/`): `/health`, `/api/openapi.json` and `/api/schema`, `/api/resources`, `/api/services`, `/api/logs` (audit log reads), `/api/events`, `/api/eventstore` and `/api/processor`. There are no per-user identities: anyone holding the token can run any guarded endpoint, including every command on the command allowlist (see below), with `sudo -n` while `ALLOW_SUDO_COMMANDS` is on (the default, [`api/src/config/index.ts`](api/src/config/index.ts)).

**Command execution.** Nothing in the API spawns a shell. Every process is started with `execFile`/`spawn` and an explicit argv ([`api/src/services/commandExecutor.ts`](api/src/services/commandExecutor.ts), [`api/src/infrastructure/adapters/child-process-command-executor.ts`](api/src/infrastructure/adapters/child-process-command-executor.ts)), so `;`, `&&`, `|`, backticks, `$()` and redirections are never interpreted. Caller-supplied commands (`/api/command/execute`, `/api/command/batch`, `/api/command/service`, `command` and `batch-command` jobs, workflow `command` steps) go through the policy in [`api/src/services/commandPolicy.ts`](api/src/services/commandPolicy.ts):

- Contract: send `{ "command": "docker", "args": ["ps", "-a"] }`. The older `{ "command": "docker ps -a" }` still works: it is split by a quote-aware tokenizer (single quotes, double quotes, backslash escapes), and any string containing `;`, `&`, `|`, `$`, a backtick, `<`, `>`, a newline or a NUL byte is rejected with 403, quoted or not. Elements of `args` are passed verbatim and may contain those characters (they reach the program as literal text); only newlines and NUL bytes are refused there.
- Allowlist: the executable must be listed in `COMMAND_ALLOWLIST` (comma or space separated; an empty value denies everything). The default is `docker, systemctl, journalctl, df, du, free, uptime, ps, ip, ss, ls, echo, date, whoami, hostname, uname, id, pwd, pg_isready`. Shells, interpreters and wrappers that run arbitrary code from their arguments (`sh`, `bash`, `python`, `node`, `env`, `xargs`, `find`, `awk`, `git`) are deliberately not in it; adding them re-opens arbitrary execution. Bare names are resolved to an absolute path inside `COMMAND_SEARCH_PATH` (default `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`), never through `PATH`; absolute paths are accepted only when listed verbatim (for example a deploy script, which then needs a shebang and the executable bit) or when they are exactly where an allowlisted name resolves, so `/bin/rm`, `/tmp/docker`, `../x` and `FOO=1 cmd` are denied.
- `sudo`: never allowlisted itself. `sudo [-n] <allowlisted command> ...` runs as `sudo -n <absolute path> ...` while `ALLOW_SUDO_COMMANDS` is not `false`; other sudo options are refused. `ALLOW_SUDO_COMMANDS=false` also disables the mutating `/api/command/service` actions and the `renice` sudo fallback.
- Environment: job payloads may set variables, but not `PATH`, `IFS`, `LD_*`, `DYLD_*`, `NODE_OPTIONS`, `BASH_ENV` and similar loader or interpreter hooks.
- Denials return `403` with code `COMMAND_EXECUTION_ERROR` (malformed input such as an unterminated quote returns `400`) and are appended to the audit log as `command.denied` with the command, the reason and the calling route, job or workflow step.

Internal features (Docker listing, systemd health, resource and network monitors, database backups, the hexagonal adapters under `api/src/infrastructure/adapters/`) run fixed argv chosen by the code, validate user-supplied values (unit names, container ids, PIDs, signals, database names) and do any filtering in TypeScript instead of shell pipelines; they are not subject to `COMMAND_ALLOWLIST`. `requiresPrivileges` in [`api/src/middleware/auth.ts`](api/src/middleware/auth.ts) now only classifies a command (sudo, mutating `systemctl` verbs, destructive tools) and is not a security control; the former regex denylist was removed because it was trivially bypassed.

**RBAC.** [`api/src/infrastructure/rbac/index.ts`](api/src/infrastructure/rbac/index.ts) ships three default roles: `admin` (every permission), `operator` (read, execute, start/stop/restart services, view metrics and logs, create/cancel jobs) and `viewer` (read, view metrics and logs), plus custom roles with inheritance, managed through `/api/rbac`. It is an in-memory model: it is not wired as a middleware gate on the other routes, so today it does not narrow what a token holder can do.

**Secrets at rest.** [`api/src/services/secretsManager.ts`](api/src/services/secretsManager.ts) encrypts each stored secret with AES-256-GCM (Node `crypto`), a random 12-byte IV per value and the GCM auth tag kept alongside the ciphertext. The key is `SECRET_KEY`, a base64-encoded 32-byte value validated at startup. Ciphertext is written to `api/secrets/secrets.json` (mounted from `./data/secrets` in `docker-compose.yml`). The separate `/api/encryption` vault ([`api/src/infrastructure/encryption/index.ts`](api/src/infrastructure/encryption/index.ts)) also uses AES-256-GCM with key rotation, but keeps keys and secrets in memory only.

**Audit logging.** [`api/src/services/auditLogger.ts`](api/src/services/auditLogger.ts) appends one JSON line per recorded action to `api/logs/audit.log`, queryable through `/api/logs`. [`api/src/infrastructure/audit/index.ts`](api/src/infrastructure/audit/index.ts) adds an in-memory typed event stream exposed at `/api/audit`. Note that `requireAuth` currently logs the raw `Authorization` header to the console, so treat the process logs as sensitive.

**Network assumption.** The server binds to `API_HOST`, default `127.0.0.1` ([`api/src/config/index.ts`](api/src/config/index.ts)); `docker-compose.yml` publishes it on loopback and on the internal `apps-network` for n8n. The `localhostOnly` and `rateLimitMiddleware` middlewares exist ([`api/src/middleware/security.ts`](api/src/middleware/security.ts), [`api/src/middleware/ratelimit.ts`](api/src/middleware/ratelimit.ts)) but are commented out in [`api/src/index.ts`](api/src/index.ts), so the token is the only barrier. The design assumes a trusted network: run it behind a reverse proxy or VPN on a host you control, and never expose port 3000 to the Internet directly. The allowlist narrows what a token holder can run, but a leaked token is still close to root on the host: with the default allowlist it can drive `docker` (which can mount the host filesystem through the mounted Docker socket) and `sudo -n systemctl`.

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
