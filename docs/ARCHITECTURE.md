# 🏛️ Architecture Overview

**Version**: v1.0.0  
**Last Updated**: December 8, 2025

## 📋 Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Project Structure](#project-structure)
3. [Core Patterns](#core-patterns)
4. [Layered Architecture](#layered-architecture)
5. [Key Design Decisions](#key-design-decisions)
6. [Technology Stack](#technology-stack)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│         API Gateway & Middleware Layer           │
│  (Security, Auth, Rate Limiting, Tracing)       │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
┌───────▼──┐ ┌────▼────┐ ┌──▼─────────┐
│Controllers│ │ Use Cases│ │  Services  │
│(HTTP)     │ │(Business)│ │(Infrastructure)
└───────┬──┘ └────┬────┘ └──┬─────────┘
        │         │         │
        └─────────┼─────────┘
                  │
        ┌─────────▼──────────┐
        │  Domain Layer      │
        │ (Core Logic, Rules)│
        └─────────┬──────────┘
                  │
        ┌─────────▼──────────────────┐
        │ Infrastructure Adapters    │
        │ (DB, Cache, Queue, Events) │
        └────────────────────────────┘
```

### Layers Explained

**1. Presentation Layer (Controllers)**
- Express.js route handlers
- Request/response validation
- HTTP protocol mapping
- Located in: `src/application/controllers/`

**2. Application Layer (Use Cases)**
- Business logic orchestration
- Command handlers
- DTOs (Data Transfer Objects)
- Located in: `src/application/use-cases/`

**3. Domain Layer**
- Core business rules
- Domain models
- Entities and aggregates
- Located in: `src/domain/`

**4. Infrastructure Layer**
- External service adapters
- Database repositories
- Cache, queue, event bus
- Located in: `src/infrastructure/`

---

## Project Structure

```
api/
├── src/
│   ├── index.ts                 # Entry point
│   ├── globals.ts               # Global utilities
│   ├── config/                  # Configuration management
│   │   └── index.ts
│   │
│   ├── middleware/              # Express middleware
│   │   ├── auth.ts             # Authentication
│   │   ├── requireAuth.ts       # Auth guard
│   │   ├── security.ts          # Security headers
│   │   ├── errorHandling.ts     # Error handling
│   │   ├── ratelimit.ts         # Rate limiting
│   │   └── ...
│   │
│   ├── application/             # Business logic
│   │   ├── controllers/         # HTTP handlers
│   │   ├── use-cases/           # Business operations
│   │   ├── dtos/                # Data transfer objects
│   │   ├── mappers/             # DTO mappers
│   │   ├── validation-schemas/  # Input validation
│   │   └── errors/              # Application errors
│   │
│   ├── domain/                  # Core domain
│   │   ├── entities/            # Domain models
│   │   ├── services/            # Domain services
│   │   ├── ports/               # Interfaces for adapters
│   │   └── errors/              # Domain errors
│   │
│   ├── infrastructure/          # External services
│   │   ├── adapters/            # Service adapters
│   │   ├── repositories/        # Data access
│   │   ├── cache/               # Caching layer
│   │   ├── queue/               # Job queue
│   │   ├── events/              # Event bus
│   │   ├── metrics/             # Metrics collection
│   │   ├── logging/             # Structured logging
│   │   ├── tracing/             # Distributed tracing
│   │   └── ...
│   │
│   └── routes/                  # Express routes
│       ├── command.routes.ts
│       ├── resources.routes.ts
│       └── ...
│
├── tests/                       # Test suite
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── setup.ts                 # Test configuration
│
├── dist/                        # Compiled JavaScript
├── package.json
├── tsconfig.json
└── jest.config.js
```

---

## Core Patterns

### 1. **Dependency Injection (DI)**

All services are instantiated through a DI container:

```typescript
// In infrastructure/container.ts
const container = {
  commandRepository: new CommandRepository(),
  resourceService: new ResourceService(),
  // ...
};

// In routes
app.use('/api/command', createCommandRoutes(container.commandRepository));
```

**Benefits:**
- Loose coupling between modules
- Easy to mock for testing
- Centralized configuration

### 2. **Repository Pattern**

Data access is abstracted behind repository interfaces:

```typescript
// Domain interface
interface ICommandRepository {
  execute(cmd: string): Promise<Result>;
  batch(commands: string[]): Promise<Result[]>;
}

// Infrastructure implementation
class CommandRepository implements ICommandRepository {
  async execute(cmd: string): Promise<Result> {
    // Actual implementation
  }
}
```

### 3. **Layered Architecture (Hexagonal)**

Clear separation of concerns:

- **Domain** knows nothing about frameworks
- **Application** knows about domain but not infrastructure
- **Infrastructure** implements ports defined by domain
- **Presentation** is just thin wrappers around application

### 4. **Error Handling**

Domain-specific error hierarchy:

```typescript
// Domain errors
class CommandExecutionError extends DomainError {}
class AuthenticationError extends DomainError {}

// Application errors
class ValidationError extends ApplicationError {}
class NotFoundError extends ApplicationError {}
```

### 5. **Use Case Pattern**

Each business operation is a separate use case:

```typescript
// src/application/use-cases/ExecuteCommandUseCase.ts
class ExecuteCommandUseCase {
  constructor(private repository: ICommandRepository) {}
  
  async execute(request: ExecuteCommandRequest): Promise<CommandResponse> {
    // Validation
    // Execution
    // Error handling
    // Response mapping
  }
}
```

---

## Layered Architecture

### Request Flow

```
1. HTTP Request
   ↓
2. Middleware (Auth, Validation, Security)
   ↓
3. Controller (HTTP → Application)
   ↓
4. Use Case (Business Logic)
   ↓
5. Domain Service (Core Rules)
   ↓
6. Repository (Data Access)
   ↓
7. Infrastructure Adapter (External Service)
   ↓
8. Response (Adapter → Controller → HTTP)
```

### Example: Execute Command

```
POST /api/command/execute

1. Express Route Handler
   ├─ Validates token (auth middleware)
   ├─ Validates request body (validation middleware)
   └─ Calls ExecuteCommandController

2. Controller (application layer)
   ├─ Maps HTTP request to DTO
   ├─ Calls ExecuteCommandUseCase
   └─ Maps response to HTTP

3. Use Case (application layer)
   ├─ Validates input
   ├─ Calls CommandRepository
   ├─ Maps errors
   └─ Returns result

4. Repository (infrastructure layer)
   ├─ Calls CommandExecutor
   ├─ Stores audit log
   └─ Returns result

5. CommandExecutor (infrastructure adapter)
   ├─ Executes shell command
   ├─ Captures output
   └─ Returns CommandResult

6. Response flows back up through layers
```

---

## Key Design Decisions

### 1. **TypeScript**
- ✅ Static typing for reliability
- ✅ Better IDE support
- ✅ Self-documenting code

### 2. **Express.js**
- ✅ Lightweight and flexible
- ✅ Rich ecosystem
- ✅ Easy middleware composition

### 3. **No Database Requirement**
- ✅ Stateless design
- ✅ Works out of the box
- ✅ Optional integration via adapters

### 4. **Event-Driven Architecture**
- ✅ Decoupled components
- ✅ Audit trail
- ✅ Extensibility

### 5. **Horizontal Scaling Ready**
- ✅ Distributed caching
- ✅ Shared rate limiting
- ✅ Stateless operations

---

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Runtime** | Node.js | 18+ |
| **Language** | TypeScript | 5+ |
| **Framework** | Express.js | 4+ |
| **Build** | TypeScript Compiler | 5+ |
| **Testing** | Jest | 29+ |
| **Validation** | Zod | 3+ |
| **Logging** | Pino/Console | - |
| **Monitoring** | Prometheus | - |
| **Auth** | Token-based | - |

### Optional Integrations

- **Cache**: Redis
- **Queue**: Bull/RabbitMQ
- **Database**: PostgreSQL/MongoDB
- **Encryption**: OpenSSL
- **Tracing**: OpenTelemetry
- **Metrics**: Prometheus

---

## Performance Characteristics

### Request Handling
- **Latency**: < 100ms average (local commands)
- **Throughput**: Depends on system; typically 1000+ req/s
- **Concurrency**: Configurable (default: 100 concurrent)

### Resource Usage
- **Memory**: ~50-100 MB idle
- **CPU**: Scales with command complexity
- **Disk**: Minimal (logs only)

---

## Security Architecture

### Authentication
- Token-based (Bearer scheme)
- Timing-safe comparison
- Required for all endpoints except health check

### Authorization
- Role-Based Access Control (RBAC)
- Configurable permissions
- Audit logging

### Data Protection
- AES-256-GCM encryption optional
- TLS support (via reverse proxy)
- Secrets management

---

## Extension Points

### Custom Middleware

```typescript
app.use((req, res, next) => {
  // Custom logic
  next();
});
```

### Custom Adapters

Implement the port interfaces:

```typescript
class CustomAdapter implements ICustomPort {
  // Implementation
}
```

### Custom Domain Services

Add to domain layer:

```typescript
class CustomDomainService {
  execute(): Promise<Result> {}
}
```

---

## Next Steps

- **Learn more**: Read [GETTING_STARTED.md](./GETTING_STARTED.md)
- **API Endpoints**: See [ENDPOINTS.md](./core/ENDPOINTS.md)
- **See Examples**: Check [EXAMPLES.md](./EXAMPLES.md)
- **Implementation Details**: See [domain/IMPLEMENTATION_NOTES.md](./domain/IMPLEMENTATION_NOTES.md)

