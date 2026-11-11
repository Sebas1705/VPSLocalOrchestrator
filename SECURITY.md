# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub:
[Report a vulnerability](https://github.com/Sebas1705/VPSLocalOrchestrator/security/advisories/new).
Do not open a public issue for a security problem, and never include a real `API_TOKEN`, `SECRET_KEY`
or `.env` contents in a report. This is a one-person project, so expect a reply within a few days,
not hours.

## Supported versions

Only the latest tagged version receives fixes. GitHub Releases lag behind the tags; use the tags.

## What this API is, and what that means for security

VPS Local Orchestrator runs allowlisted host commands, manages Docker containers and systemd services,
and reads and writes files inside configured roots. **Whoever holds `API_TOKEN` can do all of that**:
authentication is a single shared bearer token with no per-user identities, and the RBAC model that
exists in the code does not gate the other routes today. The
[Security model](README.md#security-model) section of the README is the precise, file-by-file
description of what is enforced and what is not. In short:

- Every route except a short public list (liveness, API docs) needs the token, and a rate limit runs
  before authentication.
- No shell is ever spawned. Commands run with an explicit argv, against an allowlist of programs with
  per-program subcommand and flag rules. Denied commands are logged without their arguments;
  successful commands are not logged.
- `sudo` is off unless `ALLOW_SUDO_COMMANDS=true`.
- File access is limited to `FILE_ALLOWED_ROOTS`, with symlinks resolved first.
- Secrets stored by the API are encrypted at rest with AES-256-GCM using `SECRET_KEY`.
- The server binds to `127.0.0.1` by default. **The design assumes a trusted network**: run it behind
  a reverse proxy or VPN on a host you control, and do not expose the port directly to the Internet.

Reports that show a way around the token gate, the command allowlist or argument rules, the path
policy, or secret handling are the most valuable ones.
