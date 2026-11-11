# Roadmap & Releases

Version: v1.3.0 (latest release, 2026-11-01). The version is defined once, in `api/package.json`; the API reads it at runtime (`api/src/version.ts`) for `GET /`.

## Release summary
- v1.3.0 (2026-11-01): auth gate on every route except a short public list, commands run without a shell behind an executable allowlist, path confinement for files, backups and database dumps, CI with a blocking typecheck, MIT license, README security model.
- v1.2.0: minor release.
- v1.1.0: docs consolidation and test expansion.
- v1.0.3: OpenAPI route, test expansion, docs condensed.
- v1.0.2 and earlier: foundation features (commands, resources, RBAC, encryption, observability, backups/events, DI, tracing, metrics).

GitHub Releases exist for v1.0.0, v1.2.0 and v1.3.0; the git tags hold the full history.

## Next targets
- Enforce RBAC on routes (today a single shared token has every permission; the RBAC module is not a gate).
- Per-user identities or per-token scopes.
- Raise coverage toward 80%.
- Performance/load testing and tracing refinements.

## Later
- OAuth/OIDC + MFA.
- Kubernetes/Helm packaging.
- Advanced monitoring/alerting and SLOs.
- Multi-tenancy and quotas.
