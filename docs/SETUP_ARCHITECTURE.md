# Setup & Architecture

Version: v1.0.3

## Quick setup
```bash
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api
npm install
cp docs/examples/.env.example .env  # set API_TOKEN (generate with openssl rand -hex 32)
npm run build && npm start
```
Server: http://localhost:3000

## Prerequisites
- Node.js 18+, npm 8+, TypeScript 5+
- Linux/macOS (Windows via WSL2)

## Architecture layers
1. **Presentation** (controllers): Express routes, request/response validation (`src/application/controllers/`)
2. **Application** (use cases): business logic, DTOs (`src/application/use-cases/`)
3. **Domain**: core rules, entities (`src/domain/`)
4. **Infrastructure**: adapters, repos, cache, queue, events (`src/infrastructure/`)

## Structure
```
api/src/
├── index.ts
├── config/
├── middleware/   # auth, security, rate limiting
├── application/  # controllers, use cases, DTOs, validation
├── domain/       # entities, services, ports
└── infrastructure/ # adapters, repos, cache, logging, metrics
```

## Key patterns
- Clean Architecture: dependency flow inward (infra → app → domain)
- Dependency injection: `infrastructure/container.ts`
- Repository pattern for data access
- Event bus for decoupling
- Zod schemas for validation

## Tech stack
- Node.js + TypeScript + Express
- Jest for testing (555 tests, 23 suites, ~43% coverage)
- Prometheus + OpenTelemetry for observability

## Testing
```bash
npm test
npm run test:coverage
```
See `core/TESTING.md` for details.
