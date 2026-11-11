# Operations

Version: v1.3.0

## Security basics
- Auth: Bearer `API_TOKEN`; keep `.env` secret.
- Sudo: off by default. Mutating `/api/command/service` actions need `ALLOW_SUDO_COMMANDS=true` and passwordless sudo for the service user; limit the sudoers entry to the commands you need.
- OpenAPI (public): `GET /api/openapi.json` for contract.

## Troubleshooting fast
- 401 token: ensure header matches `.env`; regenerate with `openssl rand -hex 32` and restart.
- Port 3000 busy: change `PORT` in `.env` or free the port (`lsof -i :3000`).
- Missing TypeScript: `npm i -D typescript ts-node && npm run build`.
- Slow/timeout tests: raise timeout or limit workers `npm test -- --maxWorkers=2`.
- Docker daemon: `systemctl start docker`; add user to `docker` group; `docker ps` to verify.
- Systemd app: `journalctl -u vps-orchestrator -n50 --no-pager`; then `systemctl daemon-reload && systemctl restart vps-orchestrator`.
- Network access: for prod use a reverse proxy. `API_HOST` in `api/.env` changes the listen address; prefer a private address such as the Docker bridge gateway over `0.0.0.0`.
- 429: `RATE_LIMIT_TIER` sizes the budget of the valid token (`standard` by default, also `premium` and `unlimited`).
- 403 on a command: the message names the subcommand or option. See `api/src/services/commandArgPolicy.ts`; for a command that must stay denied here, wrap it in a script and allowlist the script.
- 403 on a path: see "Files, backups and database dumps" in the README; `FILE_ALLOWED_ROOTS` sets the roots.

## Upgrade notes

The security hardening that added the auth gate changes defaults. On a running install:

1. **Listen address.** The unit and compose file now default to loopback, but `api/.env` overrides the unit. Run `grep API_HOST api/.env`: an old `API_HOST=0.0.0.0` keeps the API exposed, so remove it or set a private address. Reinstall the unit (`cp vps-orchestrator.service /etc/systemd/system/ && systemctl daemon-reload`).
2. **n8n and other clients on another host or container.** Port `3001` is now loopback only. Containers on `apps-network` should call `http://api:3000`; containers on the host network can use `http://127.0.0.1:3000`. Otherwise set `API_PUBLISH_HOST` (compose) or `API_HOST` (systemd) to a private address, such as the Docker bridge gateway.
3. **Tokens on every client.** `/api/resources`, `/api/services`, `/api/logs`, `/api/events`, `/api/eventstore`, `/api/processor`, `/metrics`, the subsystem `/health` routes and the read routes of `/api/circuitbreakers` now return 401 without the token. Prometheus needs `authorization: { credentials: <token> }` in its scrape config.
4. **Sudo.** Set `ALLOW_SUDO_COMMANDS=true` if you rely on start, stop, restart, enable or disable through `/api/command/service`, on `sudo` in commands, or on the `renice` fallback.
5. **Commands in workflows and jobs.** Review stored definitions: anything outside the rules now fails with 403, for example `docker compose up`, `docker pull`, `docker inspect` or `docker rm`. Workflow steps report it as a failed step.
6. **Rate limit.** Bursts above 50 requests or 300 per minute now get 429. Raise `RATE_LIMIT_TIER` if a client needs more.
7. **Paths.** Clients touching dotfiles or the API directory through `/api/files`, `/api/backups` or `/api/databases/backup` now get 403. Under compose the default roots do not include `/home/sebss/apps`, so set `FILE_ALLOWED_ROOTS` if you use the file API there.
8. **Old audit entries.** `api/logs/audit.log` written by earlier versions still holds the arguments of denied commands. Rotate or scrub it, and rotate any credential that appears in it. The same goes for the journal, which logged them too.
9. **Treat the token as exposed** if the API was reachable from outside: rotate `API_TOKEN`, and check `SECRET_KEY` if `api/.env` could have been read.

## Cleanup
Tests auto-clean `api/{workflows,metrics,databases,loadbalancer,backups,webhooks}` via `tests/setup.ts`. If needed, remove manually.

## Useful commands
```bash
npm test -- --detectOpenHandles --detectLeaks
npm test -- --maxWorkers=2
sudo journalctl -u vps-orchestrator -f
```
