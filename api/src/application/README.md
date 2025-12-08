# Application Layer — v4.2.0

## Overview
Use-cases sit here, orchestrating domain logic with infrastructure adapters. They are framework-agnostic and can be tested independently.

## Files

### `/use-cases.ts`
- **ExecuteCommandUseCase**: Execute a command, persist, and return result.
  - Takes: `Command` (domain), `repository` (port), `executor` (adapter).
  - Returns: `CommandExecution` or error.
- **GetExecutionHistoryUseCase**: Fetch recent command executions.

## Pattern

```typescript
// Domain: pure business rules
const cmd = new Command('ls -la');

// Use-Case: orchestrate domain + infra
const uc = new ExecuteCommandUseCase(repository, executor);
const result = await uc.execute(cmd, userId);

// Presentation: expose via HTTP
res.json(result);
```

## Next Step (v4.3.0)

Create more use-cases for services, resources, auth, and wire them into routes via DI container.

## Reference

- See `docs/analysis/FUTURE_TECH_ROADMAP.md` Phase 5-6 for use-case patterns.
