# Examples Index

Sample assets for VPS Local Orchestrator.

## Contents
- `.env.example` — Safe template to configure your instance (no secrets)
- `ENDPOINT_EXAMPLES.md` — Curl examples for all public/protected endpoints

## Quick Use (curl)
1. `export TOKEN="your-token"`
2. `cd docs/examples`
3. Run any call from `ENDPOINT_EXAMPLES.md` (public or protected)

## Auth Notes
- Protected endpoints require `Authorization: Bearer $TOKEN`.
- Public endpoints: `/health`, `/api/resources`, `/api/resources/processes`.
- Use HTTPS via reverse proxy in production.

## Environment Template
- `.env.example` is English-only and contains placeholders; generate real secrets with `openssl rand -hex 32` (tokens) and `openssl rand -base64 32` (AES keys).
- Keep `.env` private (`chmod 600`) and never commit secrets.

## Need More?
- For endpoint details see `docs/core/ENDPOINTS.md`.
- For security guidance see `docs/guides/SECURITY.md` and `docs/core/AI_DATA_PROTECTION.md`.
