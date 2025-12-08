# 🔮 Feature Roadmap

**Current Version**: v4.0.0 (Phases 1-4 complete: core features, services, security, workflows, analytics, docs/tests)

This roadmap summarizes what shipped and what is next, with consecutive phases and explicit version targets.

---

## Versioning Guide (Roadmap)
- Start: `v4.0.0`.
- Minor bumps per roadmap point (e.g., `4.0.0` → `4.1.0` → `4.2.0`).
- Major bump every two phases (Phase 5-6 stay in 4.x, Phase 7-8 move to 5.x, Phase 9 starts 6.x).

---

## ✅ Completed Phases (1-4)

| Phase | Versions | Highlights |
|-------|----------|------------|
| 1. Foundations | 1.x | Command exec/batch, auth token, public health/resources |
| 2. Services & Security | 1.2.x | Service management, security middleware, env config |
| 3. Workflows & Integrations | 3.x | Workflow engine, webhooks, secrets, backups, analytics, docker/db support |
| 4. Quality & Docs | 4.0.0 | Full test suite (50+), analytics, load balancer control, comprehensive docs |

---

## 🚀 Upcoming Phases (Consecutive)

### Phase 5 — Stabilize & Modularize (4.x)
- **v4.1.0**: Domain boundaries (`command`, `resources`, `auth`, `services`).
- **v4.2.0**: Dependency injection for services; configuration-driven wiring.
- **v4.3.0**: Side-effect isolation (IO behind adapters); pure use-cases.
- **v4.4.0**: Request/response validation (Zod/OpenAPI) on all routes.

### Phase 6 — Layered/Clean Architecture (4.x)
- **v4.5.0**: Enforce layers: presentation → application → domain → infrastructure.
- **v4.6.0**: Ports/adapters for executor, process monitor, metrics.
- **v4.7.0**: Domain error taxonomy + HTTP mappers.
- **v4.8.0**: DTO mappers separating transport from domain.

### Phase 7 — Observability & Resilience (5.x)
- **v5.1.0**: Metrics (Prometheus/Otel): latency, command duration, resource polling, error rates.
- **v5.2.0**: Structured logging with correlation IDs.
- **v5.3.0**: Timeouts, circuit breakers, retries with backoff.
- **v5.4.0**: Feature flags for risky rollouts.

### Phase 8 — Scalability & Workload Control (5.x)
- **v5.5.0**: Job/queue abstraction for long-running commands (Redis/Kafka interface).
- **v5.6.0**: Concurrency controls and rate limits per token.
- **v5.7.0**: Back-pressure and cancellation for command streams.
- **v5.8.0**: Horizontal-readiness: stateless HTTP layer; shared cache for auth/rate-limit state.

### Phase 9 — Data & Schema Governance (6.x)
- **v6.1.0**: OpenAPI as source of truth; generated clients; contract tests.
- **v6.2.0**: Schema migration workflow (SQL if introduced) with linting/drift checks.
- **v6.3.0**: Audit/event log stream for privileged actions.

---

## 📌 Backlog (post-Phase 9)
- Advanced security: OAuth2/OIDC, MFA, RBAC/ABAC, key management.
- CI/CD automation: full pipelines, changelog/version automation, artifact promotion.
- Advanced monitoring: tracing, alert routing, dashboards.
- Container/Kubernetes packaging: Helm chart, health/readiness, autoscaling policies.
- GraphQL layer and subscriptions (optional alongside REST).
- Multi-tenancy controls and per-tenant quotas.
- Mobile/PWA client and improved responsive UI.
- Advanced DR: incremental backups, multi-region failover drills.

---

## 📅 High-Level Timeline (Indicative)
| Phase | Target Window | Notes |
|-------|----------------|-------|
| 5 | Weeks 1-2 | Stabilize domains, DI, validation |
| 6 | Weeks 3-5 | Layered architecture, ports/adapters, error mapping |
| 7 | Weeks 4-6 | Metrics, logging, resilience patterns |
| 8 | Weeks 6-8 | Queues, rate limits, horizontal readiness |
| 9 | Weeks 8-10 | OpenAPI source of truth, schema governance, audit stream |

---

## 🤝 Contributing to This Roadmap
1. Review [FUTURE_TECH_ROADMAP.md](../analysis/FUTURE_TECH_ROADMAP.md) for detailed technical steps.
2. Propose changes via GitHub Discussions/Issues before large items.
3. Open a feature branch (`feature/<area>-<brief>`), add tests, and ensure CI passes.
4. Keep changes scoped to one roadmap point (one minor version) when possible.

---

**Last Updated**: December 8, 2025  
**Maintainer**: Sebas1705  
**Repository**: [GitHub](https://github.com/Sebas1705/VPSLocalOrchestrator)
