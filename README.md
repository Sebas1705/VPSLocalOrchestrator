# VPS Local Orchestrator

[![CI](https://github.com/Sebas1705/VPSLocalOrchestrator/actions/workflows/ci.yml/badge.svg)](https://github.com/Sebas1705/VPSLocalOrchestrator/actions/workflows/ci.yml)

**v1.3.0** (per `api/package.json`, the `v1.3.0` git tag and the latest GitHub release) · Node 18+ · TypeScript 5 · Express 5

A self-hosted REST API for orchestrating VPS resources and executing commands locally — with AES-256-GCM secret encryption, a default-deny bearer token gate, rate limiting, per-program command rules and a log of denied commands. See [Security model](#security-model) for what is enforced today and what is not.

Designed to run on your own VPS behind a reverse proxy, giving you a secure HTTP interface to automate infrastructure tasks without exposing SSH.

## Why

Managing a VPS typically means SSH + manual commands. This API wraps those operations behind a single authenticated HTTP surface with:

- One bearer token in front of everything except liveness and API docs
- An allowlist of programs, subcommands and flags instead of a shell
- A log of denied commands, without their arguments
- Secret encryption at rest

## Features

| Category | Capabilities |
|---|---|
| **Security** | Single-token auth on all but a short public list, rate limiting per token and per client address, AES-256-GCM secret encryption. There is one shared token, so every holder has every permission; an RBAC model and threat detector exist behind their own APIs but do not gate other routes |
| **Commands** | Run allowlisted host commands via authenticated endpoints (argv only, no shell) |
| **Docker** | List, start and stop containers |
| **Services** | Manage systemd services |
| **Files** | Read, write, and manage files inside the allowed roots |
| **Database** | Back up PostgreSQL databases and check readiness |
| **Jobs** | Schedule and track background jobs |
| **Observability** | Custom metrics and Prometheus output, denied-command log, in-memory audit events. The automatic HTTP metrics and tracing middlewares exist but are currently disabled |
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
# Optional, see "Security model": COMMAND_ALLOWLIST, ALLOW_SUDO_COMMANDS,
# FILE_ALLOWED_ROOTS, FILE_WRITE_ROOTS, OUTBOUND_ALLOWED_HOSTS,
# CHILD_ENV_PASSTHROUGH, RATE_LIMIT_TIER, API_HOST

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
Ports `3000` and `3001` are published on `127.0.0.1` only, so put Nginx or Caddy in front. To publish `3001` on another address, set `API_PUBLISH_HOST` in the shell or in the `.env` next to `docker-compose.yml`.

**Systemd**:
```bash
cp vps-orchestrator.service /etc/systemd/system/
systemctl enable --now vps-orchestrator
```
The unit listens on `127.0.0.1`. Set `API_HOST` in `api/.env` to listen elsewhere; that file overrides the unit.

Upgrading an existing install: read [Upgrade notes](docs/OPERATIONS.md#upgrade-notes) first, several defaults changed.

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
npm test                 # Jest: 37 suites, 1074 tests, no external services needed
npm run test:coverage    # HTML/lcov report in api/coverage/
```

End-to-end smoke test against a running server (starts the API, exercises every endpoint as a client, cleans up):

```bash
scripts/test-api-complete.sh
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) installs, typechecks, runs the suite with coverage and writes the coverage table to the job summary.

## Security model

What the code does today, with the file that does it. Read this before exposing the API anywhere.

**Who can call it.** Every request goes through `authGate` ([`api/src/middleware/authGate.ts`](api/src/middleware/authGate.ts)), which runs before body parsing and is default-deny: anything outside `PUBLIC_ROUTES` needs the token, including routes added later. The public list is `GET /`, `GET /health`, the OpenAPI and schema documents and the read-only API version metadata; `/metrics`, `/api/resources`, `/api/services`, `/api/logs` and the `/health` of each subsystem all need the token. [`api/tests/integration/auth-gate.test.ts`](api/tests/integration/auth-gate.test.ts) walks the real Express route table and fails on any route that answers without one. Authentication is a single shared bearer token, `API_TOKEN`, compared in constant time with `crypto.timingSafeEqual` ([`api/src/middleware/auth.ts`](api/src/middleware/auth.ts)). There are no per-user identities and no per-route permissions: anyone holding the token can use every route.

**Command execution.** Nothing in the API spawns a shell. Every process is started with `execFile`/`spawn` and an explicit argv ([`api/src/services/commandExecutor.ts`](api/src/services/commandExecutor.ts), [`api/src/infrastructure/adapters/child-process-command-executor.ts`](api/src/infrastructure/adapters/child-process-command-executor.ts)), so `;`, `&&`, `|`, backticks, `$()` and redirections are never interpreted. Caller-supplied commands (`/api/command/execute`, `/api/command/batch`, `/api/command/service`, `command` and `batch-command` jobs, workflow `command` steps) go through the policy in [`api/src/services/commandPolicy.ts`](api/src/services/commandPolicy.ts):

- Contract: send `{ "command": "docker", "args": ["ps", "-a"] }`. The older `{ "command": "docker ps -a" }` still works: it is split by a quote-aware tokenizer (single quotes, double quotes, backslash escapes), and any string containing `;`, `&`, `|`, `$`, a backtick, `<`, `>`, a newline or a NUL byte is rejected with 403, quoted or not. Elements of `args` are passed verbatim and may contain those characters (they reach the program as literal text); only newlines and NUL bytes are refused there.
- Allowlist: the executable must be listed in `COMMAND_ALLOWLIST` (comma or space separated; an empty value denies everything). The default is `docker, systemctl, journalctl, df, du, free, uptime, ps, ip, ss, ls, echo, date, whoami, hostname, uname, id, pwd, pg_isready`. Shells, interpreters and wrappers that run arbitrary code from their arguments (`sh`, `bash`, `python`, `node`, `env`, `xargs`, `find`, `awk`, `git`) are deliberately not in it; adding them re-opens arbitrary execution. Bare names are resolved to an absolute path inside `COMMAND_SEARCH_PATH` (default `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`), never through `PATH`; absolute paths are accepted only when listed verbatim (for example a deploy script, which then needs a shebang and the executable bit) or when they are exactly where an allowlisted name resolves, so `/bin/rm`, `/tmp/docker`, `../x` and `FOO=1 cmd` are denied.
- Arguments: each default program has a rule in [`api/src/services/commandArgPolicy.ts`](api/src/services/commandArgPolicy.ts) naming the subcommands and flags it may use; anything not listed is denied. `docker` is limited to `ps, images, logs, stats, top, port, version, info, start, stop, restart`, with no global options, so `docker run -v /:/host` and `docker -H ...` are out, as is `docker inspect` (it prints container secrets). `systemctl` has read verbs plus `start, stop, restart, reload, try-restart, enable, disable` on plain unit names. `ip` is read-only, and flags that read or write files or run things are refused (`date -f`, `journalctl --file`, `du --files0-from`, `ss -D`, `ip -batch`, `ps e`). Rules apply under `sudo` too. Programs you add to `COMMAND_ALLOWLIST` yourself have no rule and any arguments: to expose something denied here, put the exact command in a script and allowlist the script's absolute path.
- `sudo`: off unless `ALLOW_SUDO_COMMANDS=true`, and never allowlisted itself. When enabled, `sudo [-n] <allowlisted command> ...` runs as `sudo -n <absolute path> ...` and other sudo options are refused. While it is off, the mutating `/api/command/service` actions return 403 and `renice` has no sudo fallback.
- Environment: callers may set variables, but not `PATH`, `IFS`, `HOME`, `LD_*`, `DYLD_*`, `NODE_OPTIONS`, `BASH_ENV` and similar loader or interpreter hooks, nor anything that redirects an allowlisted tool (`DOCKER_*`, `COMPOSE_*`, `SYSTEMD_*`, `XDG_*`, `PG*`, `PS_FORMAT`, `PAGER`, `EDITOR`).
- Denials return `403` with code `COMMAND_EXECUTION_ERROR` (malformed input such as an unterminated quote returns `400`) and are appended to the audit log as `command.denied` with the executable, the argument count, the reason with quoted values removed, and the calling route, job or workflow step. Arguments are never recorded, because a denied command line can carry a secret.

Internal features (Docker listing, systemd health, resource and network monitors, database backups, the hexagonal adapters under `api/src/infrastructure/adapters/`) run fixed argv chosen by the code, validate user-supplied values (unit names, container ids, PIDs, signals, database names) and do any filtering in TypeScript instead of shell pipelines; they are not subject to `COMMAND_ALLOWLIST`. `requiresPrivileges` in [`api/src/middleware/auth.ts`](api/src/middleware/auth.ts) now only classifies a command (sudo, mutating `systemctl` verbs, destructive tools) and is not a security control; the former regex denylist was removed because it was trivially bypassed.

**RBAC.** [`api/src/infrastructure/rbac/index.ts`](api/src/infrastructure/rbac/index.ts) ships three default roles: `admin` (every permission), `operator` (read, execute, start/stop/restart services, view metrics and logs, create/cancel jobs) and `viewer` (read, view metrics and logs), plus custom roles with inheritance, managed through `/api/rbac`. It is an in-memory model: it is not wired as a middleware gate on the other routes, so today it does not narrow what a token holder can do.

**Files, backups and database dumps.** Paths from requests go through [`api/src/services/pathPolicy.ts`](api/src/services/pathPolicy.ts), which resolves symlinks with `realpath`, rejects `..` escapes by checking the real path, and keeps reads and writes apart. *Reads* (file reads and listings, backup sources) must be inside `FILE_ALLOWED_ROOTS` (separated by `:`; default home, `/tmp`, `/var/log`, `/var/tmp`). *Writes* (write, delete, mkdir, rmdir, backup restore destinations, database dump destinations) must be inside `FILE_WRITE_ROOTS` (same separator), which defaults to one dedicated directory, `api/data/files` (`/app/data/files` in the container, mounted from `./data/files`); an empty value disables writes. Write roots are readable too. A write root that is, or contains, the API install directory (a home directory holding the checkout, or `/`), or that is inside it other than the default directory, is ignored, and the deploy files next to the API (`docker-compose.yml`, `Dockerfile`, `vps-orchestrator.service`, `scripts/`, `.git`, `.github`) are never writable whatever the roots say. The API install directory and anything below a root with a path segment starting with `.` (`.env`, `.ssh`, `.bashrc`, `.git`, ...) are refused for reads and writes alike, with `403`. Dangling symlinks are refused and the last path component is opened with `O_NOFOLLOW`. Hard links, and a parent directory swapped between the check and the use, are not covered. Reads of other applications in the home remain possible: if that is too much, narrow `FILE_ALLOWED_ROOTS`.

**Outbound HTTP.** Workflow `webhook` steps and webhook delivery go through [`api/src/services/outboundPolicy.ts`](api/src/services/outboundPolicy.ts). Only `http:` and `https:` are allowed; the host is resolved by the API and every address must be public (loopback, link-local such as `169.254.169.254`, private, CGNAT, unspecified, multicast and reserved ranges are refused, including their IPv4-mapped, NAT64 and 6to4 IPv6 forms); the socket connects to the address that was checked, so a second DNS answer cannot redirect it; redirects are followed by hand (`OUTBOUND_MAX_REDIRECTS`, default 5) and each hop is checked again; the response is capped at `OUTBOUND_MAX_RESPONSE_BYTES` (default 1048576) and the request times out after `OUTBOUND_TIMEOUT_MS` (default 10000). `OUTBOUND_ALLOWED_HOSTS` (comma separated hostnames, IP literals or `*.suffix`; default empty) permits specific internal hosts, for example an n8n container; even then the step output holds the status and a note, never the body. A blocked destination fails the step (or the webhook delivery) with an error and nothing is sent.

**Child process environment.** Programs started by the API do not inherit its environment. [`api/src/services/childEnv.ts`](api/src/services/childEnv.ts) passes `PATH`, `HOME`, `USER`, `LOGNAME`, `LANG`, `LC_*`, `TZ`, `TERM`, `TMPDIR`/`TEMP`/`TMP`, `SHELL` (and `SystemRoot`, `WINDIR`, `COMSPEC`, `PATHEXT` on Windows), the variables a caller may set (see Environment above) and whatever `CHILD_ENV_PASSTHROUGH` lists (comma or space separated names or `PREFIX*`, default empty; use it for `DOCKER_HOST`, `PG*` and similar). Names containing `TOKEN`, `KEY`, `SECRET` or `PASSWORD` are dropped unless listed there, and the API's own settings (`API_*`, `SECRET_KEY`, `SUDO_PASSWORD`, `FILE_*`, `OUTBOUND_*`, ...) are never passed, even if listed.

**Rate limiting.** [`api/src/middleware/ratelimit.ts`](api/src/middleware/ratelimit.ts) runs before auth. The valid token gets the `RATE_LIMIT_TIER` budget (default `standard`: 50 burst, 5/s, 300/min, 10 concurrent; `free`, `premium` and `unlimited` also exist). Everything else is keyed by client address on the `free` tier (10 burst, 1/s, 60/min), so token guessing is throttled however many values are tried. `GET /health` is exempt. State is in memory, per process. Behind a reverse proxy all unauthenticated clients count as one address.

**Secrets at rest.** [`api/src/services/secretsManager.ts`](api/src/services/secretsManager.ts) encrypts each stored secret with AES-256-GCM (Node `crypto`), a random 12-byte IV per value and the GCM auth tag kept alongside the ciphertext. The key is `SECRET_KEY`, a base64-encoded 32-byte value validated at startup. Ciphertext is written to `api/secrets/secrets.json` (mounted from `./data/secrets` in `docker-compose.yml`). The separate `/api/encryption` vault ([`api/src/infrastructure/encryption/index.ts`](api/src/infrastructure/encryption/index.ts)) also uses AES-256-GCM with key rotation, but keeps keys and secrets in memory only.

**Audit logging.** This is not a full audit trail: successful commands are not recorded. [`api/src/services/auditLogger.ts`](api/src/services/auditLogger.ts) appends denied commands to `api/logs/audit.log`, one JSON line each, queryable through `/api/logs`. [`api/src/infrastructure/audit/index.ts`](api/src/infrastructure/audit/index.ts) adds an in-memory typed event stream exposed at `/api/audit`, fed only by the RBAC and threat detection modules. Credentials are kept out of logs: `requireAuth` logs only that a rejected request had a bearer token present or absent, never the header or token, and the startup banner and rate limiter identify tokens by a short SHA-256 fingerprint (`sha256:xxxxxxxx`, [`api/src/infrastructure/logging/redact.ts`](api/src/infrastructure/logging/redact.ts)). Accepted commands are kept in memory with their arguments, and job and workflow definitions are stored as sent, so do not put secrets in command arguments or URLs.

**Network assumption.** The server binds to `API_HOST`, default `127.0.0.1` ([`api/src/config/index.ts`](api/src/config/index.ts)), which is also what the systemd unit sets. `docker-compose.yml` publishes ports `3000` and `3001` on loopback; `API_PUBLISH_HOST` overrides the address of `3001`. Containers on `apps-network` reach the API at `http://api:3000` without any published port. The `localhostOnly` middleware is not used, because a container sees the Docker gateway rather than loopback: the listen address is the control. The design assumes a trusted network: run it behind a reverse proxy or VPN on a host you control, and never expose the port to the Internet directly. The token remains powerful even with these limits: it can stop any container or service the API user can reach, read the journal and write files in the allowed roots. With `ALLOW_SUDO_COMMANDS=true` that extends to anything the sudoers entry allows.

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
| [SECURITY_EXAMPLES.md](docs/SECURITY_EXAMPLES.md) | Auth and encryption examples (RBAC is a model behind `/api/rbac`, not enforced elsewhere) |
| [OPERATIONS.md](docs/OPERATIONS.md) | Monitoring, alerting, maintenance |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Contributing and adding routes |
| [TESTING.md](docs/TESTING.md) | Test strategy and coverage |
| [ROADMAP_RELEASES.md](docs/ROADMAP_RELEASES.md) | Changelog and upcoming features |

## License

MIT
