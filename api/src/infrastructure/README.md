# Infrastructure Layer — v4.2.0

## Overview
This folder contains infrastructure implementations and DI container setup. It forms the bridge between domain logic and external systems.

## Structure

### `/container.ts`
- **Purpose**: Simple, framework-agnostic DI container.
- **Key Classes**: `Container`, `createContainer()`.
- **Usage**:
  ```typescript
  const container = new Container();
  container.register('logger', () => new Logger(), true); // singleton
  const logger = container.get('logger');
  ```
- **Why custom**: Keeps dependencies minimal; can upgrade to tsyringe/awilix later.

### `/ports.ts`
- **Purpose**: Repository interfaces (contracts) for data access and services.
- **Key Interfaces**:
  - `ICommandExecutionRepository`: Persist/query command executions.
  - `IServiceRepository`: Service state management.
  - `IConfigRepository`: Configuration access (env vars, files, etc.).
  - `ILogger`: Logging abstraction.
- **Pattern**: Ports define what adapters must implement.

### `/adapters`
- **Purpose**: Concrete implementations of ports.
- **Current Adapters**:
  - `InMemoryCommandExecutionRepository`: For testing.
  - `InMemoryServiceRepository`: For testing.
  - `EnvConfigRepository`: Reads from `process.env`.
- **Future Adapters**:
  - PostgreSQL-based repositories.
  - File-based config repository.
  - Redis-based caching layer.

## Architecture Pattern

```
Domain (entities, errors, logic)
    ↑
Application (use-cases, orchestration)
    ↑
Infrastructure (DI, adapters, ports)
    ↑
HTTP/Presentation (routes, controllers)
```

## Next Step (v4.3.0)

Integrate DI container into routes and refactor services to accept dependencies via injection instead of direct instantiation.

## Reference

- See `docs/analysis/FUTURE_TECH_ROADMAP.md` Phase 6 (v4.5–4.8) for layered architecture details.
