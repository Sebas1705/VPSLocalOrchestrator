# OS Adapters — v4.3.0

## Overview
OS adapters isolate all side-effects (process execution, file I/O, system calls) behind clean interfaces. This allows pure domain and application logic to remain testable and framework-agnostic.

## Port Interfaces

### `ICommandExecutor`
- **Purpose**: Execute shell commands safely.
- **Implementation**: `ChildProcessCommandExecutor` (Node.js child_process).
- **Testing**: Mock with in-memory executor that doesn't spawn processes.

### `IProcessManager`
- **Purpose**: Query and control running processes.
- **Implementation**: `OsCommandProcessManager` (uses `ps`, `kill`, etc.).
- **Isolation**: No direct Node.js process introspection; uses shell commands.

### `ISystemInfoProvider`
- **Purpose**: Gather CPU, memory, disk, network, and uptime stats.
- **Implementation**: `ShellSystemInfoProvider` (reads `/proc`, runs `df`, `ip`, etc.).
- **Isolation**: All I/O wrapped in shell command adapter.

### `IServiceManager`
- **Purpose**: Start, stop, restart, query systemd services.
- **Implementation**: `SystemdServiceManager` (uses `systemctl`).
- **Isolation**: No direct systemd D-Bus calls; uses shell commands.

## Key Principle

**No side-effects in domain/application layers.** All I/O (spawn processes, read files, system calls) happens in adapters. This:
- Makes domain logic pure and testable.
- Allows easy mocking for unit tests.
- Centralizes error handling for system operations.
- Enables future implementations (e.g., Docker API instead of systemctl).

## Example

```typescript
// Domain: pure, no I/O
const cmd = new Command('ls -la');

// Application: coordinates domain + adapters
const executor = container.get<ICommandExecutor>('commandExecutor');
const result = await executor.execute(cmd.value, { timeout: cmd.timeout });

// HTTP route: exposes via REST
res.json(result);
```

## Next Steps

- v4.4.0: Add request/response validators (Zod/OpenAPI) to all routes.
- v4.5.0+: Refactor existing route handlers to use DI container and new adapters.

## Reference

- See `docs/analysis/FUTURE_TECH_ROADMAP.md` Phase 5.3 for detailed patterns.
