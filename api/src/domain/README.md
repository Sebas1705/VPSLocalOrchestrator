# Domain Layer

This directory contains domain-specific models, entities, and value objects. Each domain boundary below represents a core area of the API.

## Domain Boundaries

### 1. Command Domain
- **Responsibility**: Execute, schedule, batch, and manage shell commands.
- **Key Entities**: `Command`, `CommandExecution`, `CommandResult`.
- **Files**: `command/` (models, errors, use-cases).

### 2. Resources Domain
- **Responsibility**: Monitor and report system resources (CPU, memory, disk, processes, network).
- **Key Entities**: `Resource`, `Process`, `NetworkInterface`.
- **Files**: `resources/` (models, errors, use-cases).

### 3. Auth Domain
- **Responsibility**: Token validation, privilege levels, and access control.
- **Key Entities**: `Token`, `Principal`, `Permission`.
- **Files**: `auth/` (models, errors, use-cases).

### 4. Services Domain
- **Responsibility**: Manage system services (systemd, docker containers, etc.).
- **Key Entities**: `Service`, `ServiceStatus`, `ServiceEvent`.
- **Files**: `services/` (models, errors, use-cases).

## Architecture Notes

- **No external dependencies** in domain models. Use value objects and pure functions.
- **Error handling** via domain-specific error types (e.g., `CommandExecutionError`).
- **Use-cases** coordinate domain logic and adapters (DB, file system, etc.).
- **DTOs** sit in application layer, not here.

## Status

- **Phase 5 (v4.1.0)**: Extract domain boundaries and define core models.
