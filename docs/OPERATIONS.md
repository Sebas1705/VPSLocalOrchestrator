# Operations

Version: v1.0.3

## Security basics
- Auth: Bearer `API_TOKEN`; keep `.env` secret.
- Sudo: `/api/command/service` uses `sudo -n`; set passwordless sudo for the service user to avoid 403.
- OpenAPI (public): `GET /api/openapi.json` for contract.

## Troubleshooting fast
- 401 token: ensure header matches `.env`; regenerate with `openssl rand -hex 32` and restart.
- Port 3000 busy: change `PORT` in `.env` or free the port (`lsof -i :3000`).
- Missing TypeScript: `npm i -D typescript ts-node && npm run build`.
- Slow/timeout tests: raise timeout or limit workers `npm test -- --maxWorkers=2`.
- Docker daemon: `systemctl start docker`; add user to `docker` group; `docker ps` to verify.
- Systemd app: `journalctl -u vps-orchestrator -n50 --no-pager`; then `systemctl daemon-reload && systemctl restart vps-orchestrator`.
- Network access: for prod use reverse proxy; for testing bind `0.0.0.0` (not recommended for prod).

## Cleanup
Tests auto-clean `api/{workflows,metrics,databases,loadbalancer,backups,webhooks}` via `tests/setup.ts`. If needed, remove manually.

## Useful commands
```bash
npm test -- --detectOpenHandles --detectLeaks
npm test -- --maxWorkers=2
sudo journalctl -u vps-orchestrator -f
```
