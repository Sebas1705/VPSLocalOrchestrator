# n8n Integration Guide

This guide shows how to call the VPS Local Orchestrator API from n8n while keeping the API accessible only on the host.

## Prerequisites
- API running on the host (e.g., `docker compose up -d` in this repo). Default binding is `127.0.0.1:3000`.
- `api/.env` configured with `API_TOKEN`, `SECRET_KEY` (base64 32 bytes), and `PORT` if not 3000.
- Docker installed (for n8n container) or a local n8n installation.

## Option A: Run n8n as a container on the host network (recommended with host-only API)
Use host networking so the n8n container can reach `127.0.0.1:3000` without exposing the API externally.

```yaml
# Add this service next to the existing api service
n8n:
  image: n8nio/n8n:1.79.1
  restart: unless-stopped
  network_mode: host  # lets n8n reach the host-only API at 127.0.0.1:3000
  environment:
    - N8N_PROTOCOL=http
    - N8N_HOST=127.0.0.1
    - N8N_PORT=5678
    - WEBHOOK_TUNNEL_URL=http://127.0.0.1:5678
    # Optional: secure the editor with basic auth
    # - N8N_BASIC_AUTH_ACTIVE=true
    # - N8N_BASIC_AUTH_USER=admin
    # - N8N_BASIC_AUTH_PASSWORD=change-me
  volumes:
    - ./n8n_data:/home/node/.n8n
```

Start n8n:

```bash
docker compose up -d n8n
```

Access the editor at `http://127.0.0.1:5678` from the host.

## Option B: Run n8n directly on the host
If you install n8n directly (npm/yarn or binary), configure it to listen on `127.0.0.1:5678` and connect to the API at `http://127.0.0.1:3000`.

## Create API credentials in n8n
1. In n8n, go to **Credentials** → **New** → **HTTP Request**.
2. Set **Base URL**: `http://127.0.0.1:3000`.
3. Under **Authentication**, choose **Header Auth** and add:
   - Name: `Authorization`
   - Value: `Bearer <your-API_TOKEN>`
4. Name and save the credential (e.g., `VPS Orchestrator API`).

## Sample workflow
- Add an **HTTP Request** node.
- Select the saved credential `VPS Orchestrator API`.
- Method: `GET`
- URL: `/health`
- Execute: you should get `{ "status": "ok", ... }`.

To trigger commands:
- Method: `POST`
- URL: `/api/command`
- Body: e.g., `{"command":"echo hello"}` with `JSON` body type.

## Security notes
- Keep the API bound to `127.0.0.1`; use host networking for n8n so the API stays unreachable from the outside.
- Protect the n8n editor with basic auth or a reverse proxy if exposed.
- Rotate `API_TOKEN` and keep it only in n8n credentials.
- Ensure Docker starts on boot so both API and n8n restart automatically (`restart: unless-stopped`).
