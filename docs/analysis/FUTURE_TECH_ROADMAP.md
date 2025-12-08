# Future Technical Roadmap

A forward-looking plan for architecture migration, testing maturity, and automated code metrics. Written to be actionable for short-, mid-, and long-term execution.

---

## Objectives
- De-risk architecture changes while keeping uptime.
- Raise test depth and reliability (fail fast; meaningful signals).
- Automate quality gates with objective metrics (coverage, complexity, security, drift).

## Versioning Rules for This Roadmap
- Starting point: `v4.0.0`.
- Minor bumps per roadmap point (e.g., `4.0.0` → `4.1.0` → `4.2.0`, etc.).
- Major bump every two phases (Phase 1–2 in 4.x, Phase 3–4 in 5.x, Phase 5 starts 6.x).

## Guiding Principles
- Small, reversible steps; hard boundaries between layers.
- Test first for new surfaces; retrofit tests before refactors.
- Automation as gatekeepers, not dashboards only.
- Security and PII safety baked into pipelines.

## Architecture Migration Plan (Versioned)

### Phase 1: Stabilize & Modularize (Weeks 1-2) — 4.x track
- **v4.1.0**: Extract clear domains: `command`, `resources`, `auth`, `services`.
- **v4.2.0**: Introduce dependency injection boundary for services (configuration-driven).
- **v4.3.0**: Isolate side effects: IO/adapters behind interfaces; pure logic in use-cases.
- **v4.4.0**: Add request/response validators (Zod/OpenAPI) at route boundaries.

### Phase 2: Layered/Clean Architecture (Weeks 3-5) — 4.x track
- **v4.5.0**: Define layers: `presentation (HTTP)` → `application (use cases)` → `domain` → `infrastructure`.
- **v4.6.0**: Introduce ports/adapters for command execution, process management, and metrics collection.
- **v4.7.0**: Centralize errors with domain error types and HTTP mappers.
- **v4.8.0**: Add DTO mappers to keep transport separate from domain models.

### Phase 3: Observability & Resilience (Weeks 4-6) — 5.x track
- **v5.1.0**: Instrument with metrics (Prometheus/OpenTelemetry): request latency, command duration, resource polling stats, error rates.
- **v5.2.0**: Structured logging with correlation IDs; propagate through services.
- **v5.3.0**: Timeouts/circuit breakers around external calls; retries with backoff for idempotent ops.
- **v5.4.0**: Feature flags for risky rollouts (config-based).

### Phase 4: Scalability & Workload Control (Weeks 6-8) — 5.x track
- **v5.5.0**: Job/queue abstraction for long-running commands (Redis/Kafka-compatible interface).
- **v5.6.0**: Concurrency controls and rate limits per token.
- **v5.7.0**: Back-pressure and cancellation for command streams.
- **v5.8.0**: Horizontal-readiness: stateless HTTP layer; shared cache for auth and rate limits.

### Phase 5: Data & Schema Governance (Weeks 8-10) — 6.x track
- **v6.1.0**: OpenAPI-as-source-of-truth; generate clients and contract tests.
- **v6.2.0**: Schema migration workflow (sql migrations if introduced later) with linting and drift checks.
- **v6.3.0**: Audit/event log stream for privileged actions.

## Testing Roadmap (Pyramid)
- **Unit (fast, isolated)**: Use cases, validators, mappers; mandate per-new-feature coverage.
- **Component/service**: Command executor, resource monitor with mocked OS/process adapters.
- **Integration**: HTTP routes hitting real app with in-memory/ephemeral adapters; auth paths; error mapping.
- **Contract**: Consumer-driven tests from OpenAPI snapshots; ensure backward compatibility.
- **E2E smoke**: Health, auth-required path, command execute, resource fetch.

### Testing Milestones
- **Milestone A (Week 2)**: Unit coverage ≥70%, golden tests for auth and validation.
- **Milestone B (Week 4)**: Component tests for executor/monitor; integration suite for core routes.
- **Milestone C (Week 6)**: Contract tests wired to OpenAPI snapshots; E2E smoke in CI.
- **Milestone D (Week 8)**: Mutation testing (Stryker) on critical modules; flaky-test quarantine job.

## Automated Metrics & Quality Gates
- **Coverage gates**: Line/branch thresholds (start 70/60, grow to 80/70); per-package deltas enforced in CI.
- **Mutation score**: Target ≥60% on core domains before release gating.
- **Static analysis**: ESLint strict config; TypeScript `noImplicitAny`, `strictNullChecks` on; circular dependency check (madge/dependency-cruiser) fails build.
- **Complexity**: Track cyclomatic/maintainability index; warn on hot spots (>10 complexity) and fail on >15 in critical paths.
- **Security/Secrets**: Secret scanning and dependency audit in CI; block on high severity.
- **Performance baselines**: Command execution p95 latency, resource poll duration; regressions >10% fail perf check.

## CI/CD Enhancements
- Add dedicated jobs: `lint`, `unit`, `component`, `integration`, `contract`, `e2e-smoke`, `mutation` (nightly), `audit` (deps + secrets), `metrics-report` (complexity + deps).
- Cache node_modules/build artifacts; split test matrices by package or feature area.
- Upload coverage + mutation + dependency graphs as CI artifacts; comment summaries on PRs.
- Enforce required checks: lint, unit, integration, contract, coverage gate, dependency audit.

## Governance & Rollout
- Versioned ADRs for architecture changes; require test plan per ADR.
- Feature flags for new execution backends and rate limiting.
- Progressive delivery: canary config for new adapters; rollback checklist.
- Definition of Done includes tests at appropriate level + passing gates.

## Suggested Timeline (High-Level)
- **Weeks 1-2**: Phase 1 + Milestone A; stand up lint/coverage gates.
- **Weeks 3-5**: Phase 2 + Milestone B; add integration suites and DI boundaries.
- **Weeks 4-6**: Phase 3 + Milestone C; observability hooks + contract tests.
- **Weeks 6-8**: Phase 4 + Milestone D; queues/back-pressure + mutation testing.
- **Weeks 8-10**: Phase 5; schema governance + performance gates.

## Success Criteria
- Clear separation of concerns (no direct IO in use-cases).
- Tests provide fast, deterministic signals; coverage and mutation scores meet gates.
- CI blocks regressions via static analysis, complexity checks, and contract tests.
- Observability in place for latency/errors; resilience patterns reduce timeouts.

## References
- Clean architecture and hexagonal patterns (ports/adapters).
- OpenTelemetry for metrics/tracing; Prometheus/Grafana for dashboards.
- Stryker for mutation testing; dependency-cruiser for architecture rules.
- OWASP ASVS for security controls and checks.
