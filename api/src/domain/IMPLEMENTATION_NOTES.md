# Domain Layer — v4.1.0 Implementation Notes

## Overview
This folder contains the **domain** entities, errors, and business logic—independent of HTTP, databases, or frameworks.

## What's Here

### `/command`
- `entities.ts`: `Command`, `CommandExecution`, `CommandResult`.
- `errors.ts`: `CommandValidationError`, `CommandExecutionError`, `CommandTimeoutError`, etc.
- Domain logic: immutability, validation, privilege checks.

### `/resources`
- `entities.ts`: `SystemResources`, `CPUMetrics`, `MemoryMetrics`, `DiskMetrics`, `Process`, `NetworkInterface`.
- `errors.ts`: `ResourceCollectionError`, `ProcessNotFoundError`, etc.
- Domain logic: resource snapshots, usage calculations.

### `/auth`
- `entities.ts`: `Token`, `Principal`, `Permission`.
- `errors.ts`: `InvalidTokenError`, `InsufficientPermissionsError`, etc.
- Domain logic: privilege levels, permission matching, expiration checks.

### `/services`
- `entities.ts`: `Service`, `ServiceEvent`, `ServiceHealth`.
- `errors.ts`: `ServiceNotFoundError`, `ServiceOperationError`, etc.
- Domain logic: service state, health tracking, event creation.

## Architecture Principles

1. **No Framework Leakage**: No `express`, `mongoose`, database clients, etc.
2. **Immutable Value Objects**: Entities like `Command`, `Token` are constructed with validation.
3. **Domain Errors**: All exceptions are domain-specific (not generic `Error`).
4. **Pure Logic**: Domain models contain business rules, not I/O or persistence.
5. **Type Safety**: Full TypeScript typing; no `any`.

## Next Steps (v4.2.0+)

- **Repositories** (interfaces) in `/domain` to represent data access contracts.
- **Use-cases** in `/application` layer to coordinate domain + adapters.
- **Adapters** in `/infrastructure` to implement repositories using actual databases/services.

## Reference

- See `docs/analysis/FUTURE_TECH_ROADMAP.md` for Phase 5 details.
- See `docs/core/FEATURE_ROADMAP.md` for versioning and milestones.
