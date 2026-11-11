afterAll(() => {
# Testing Guide

Lightweight guide to run and extend the test suite (v1.3.0).

## Stack
- Jest with ts-jest (ESM enabled)
- Supertest available for integration tests
- Global setup: `tests/setup.ts` cleans generated dirs before/after runs

## Structure
```
api/tests/
├─ setup.ts
├─ integration/      # routes and API surface
└─ unit/             # services, middleware, controllers, domain, config, metrics
```

## Run commands
```bash
npm test                  # all suites
npm run test:watch        # watch mode
npm run test:coverage     # coverage + HTML report
npm test -- file.test.ts  # single file
```

Typical full run: 37 suites, 1074 tests (14 skipped), a few seconds.

## Coverage
- Run `npm run test:coverage` for the current figure (target 80%)
- Reports: `coverage/lcov-report/index.html`, `coverage/lcov.info`
- Focus next: services 70%+, routes 60%+, utilities/middleware 80%+
- Gaps and plan: `TEST_COVERAGE_EXPANSION_REPORT.md`

## Cleanup
`tests/setup.ts` removes `api/{workflows,metrics,databases,loadbalancer,backups,webhooks}` before and after all tests. Run `npm test` to trigger cleanup or remove them manually if needed.

## Troubleshooting
- Import/ESM errors: confirm `extensionsToTreatAsEsm: ['.ts']` in `jest.config.js`
- Long tests/timeouts: increase per-test timeout or limit workers (`npm test -- --maxWorkers=2`)
- Open handles: `npm test -- --detectOpenHandles --detectLeaks`

Last updated: 2025-12-08
