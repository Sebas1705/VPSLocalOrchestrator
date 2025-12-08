# 🧠 Mental Map - Phase 5 Architectural Evolution

Visual guide to understanding the architectural transformation from v4.0.0 to v5.0.0

---

## 🏗️ High-Level Architecture Evolution

```
v4.0.0 (CURRENT - MVP)
├── routes/
│   ├── command.routes.ts
│   ├── workflows.routes.ts
│   └── ... (14 route files)
│
├── services/
│   ├── commandExecutor.ts
│   ├── workflowManager.ts
│   └── ... (17 service files)
│
├── middleware/
│   ├── auth.ts
│   ├── security.ts
│   └── requireAuth.ts
│
└── config/
    └── index.ts (logger, config)

PROBLEMS:
❌ In-memory data
❌ Scattered error handling
❌ No DI
❌ Duplicated validation
├─ Tightly coupled


                    ⬇️ PHASE 5 REFACTORING ⬇️


v5.0.0 (PROPOSED - ENTERPRISE)
├── domain/                      ← Business rules
│   ├── entities/
│   │   └── Command, Workflow, Service
│   ├── services/
│   │   └── CommandDomainService
│   └── repositories/
│       └── ICommandRepository
│
├── application/                 ← Use cases
│   ├── dto/
│   │   └── schemas.ts (Zod)
│   ├── use-cases/
│   │   └── ExecuteCommandUseCase
│   └── interfaces/
│       └── ICommandService
│
├── infrastructure/              ← Implementations
│   ├── persistence/
│   │   ├── SQLiteCommandRepository
│   │   └── Database.ts
│   ├── external/
│   │   └── SystemCommandExecutor
│   └── logging/
│       └── StructuredLogger
│
├── presentation/                ← HTTP handling
│   ├── controllers/
│   │   └── CommandController
│   ├── middleware/
│   │   ├── ErrorHandler (global)
│   │   ├── ValidationMiddleware
│   │   └── AuthMiddleware
│   └── dto/
│       └── Request/Response schemas
│
└── common/                       ← Cross-cutting
    ├── exceptions/
    │   ├── ApplicationException
    │   ├── DomainException
    │   └── NotFoundException
    ├── utils/
    └── types/

BENEFITS:
✅ SQLite persistence
✅ Stratified error handling
✅ Tsyringe DI
✅ Centralized validation (Zod)
✅ Clear layer separation
✅ Loosely coupled
```

---

## 🔀 Data Flow Evolution

### v4.0.0 (Current)

```
HTTP Request
    ↓
Route Handler
    ├─ Validation (ad-hoc)
    ├─ Auth check
    └─ Error handling (try-catch)
        ↓
Service.executeCommand()
    ├─ Direct system call (child_process)
    └─ Store in memory array
        ↓
HTTP Response (JSON)

PROBLEMS:
- No persistence
- Validation duplicated
- Error handling scattered
- Hard to test
```

### v5.0.0 (Proposed)

```
HTTP Request
    ↓
Middleware Stack
├─ Parse JSON
├─ Validate (Zod schema)
├─ Authenticate (Bearer token)
└─ Attach correlationId
    ↓
Controller/Handler
    ├─ Extract DTO
    └─ Resolve use case (DI)
        ↓
Use Case (Application Service)
├─ Create domain entity
├─ Call domain service
├─ Call repository
└─ Log action (structured)
    ↓
Domain Service
├─ Validate business rules
└─ Execute core logic
    ↓
Repository
├─ Persist to SQLite
└─ Return entity
    ↓
Use Case returns result
    ↓
Controller formats response
    ↓
Global Error Handler (if error)
├─ Categorize error
├─ Log with context
└─ Format response
    ↓
HTTP Response (consistent format)

BENEFITS:
- Clear responsibility separation
- Persistent storage
- Centralized error handling
- Context-aware logging
- Easy to test each layer
```

---

## 🔄 Testing Strategy Evolution

### v4.0.0

```
Integration Tests (100%)
├─ Start full Express server
├─ Make HTTP request
├─ Check response
└─ ~60% coverage (can't test edge cases)

Problem: Slow (~20 sec), hard to mock internals
```

### v5.0.0

```
Unit Tests (60%)
├─ Domain entities/services
│   └─ Pure business logic, no dependencies
├─ Use cases
│   └─ Mocked repositories
├─ Controllers
│   └─ Mocked services
└─ Fast, focused, high coverage

Integration Tests (40%)
├─ Repository → Database
├─ Controller → Service → Repository
└─ End-to-end workflows

Benefit: Fast (~5 sec), 80%+ coverage
```

---

## 💾 Data Persistence Evolution

### v4.0.0

```
Memory ([]Array)
    ↓
    └─ Request restart
        ↓
        └─ 💥 DATA LOSS

workflows = []
metrics = []
commandHistory = []
```

### v5.0.0

```
Application
    ↓
Use Case ──┐
           │
Repository │ (abstraction)
           │
SQLite DB ◄┘
    ↓
    └─ Request restart
        ↓
        └─ ✅ DATA PERSISTS

data/database.db
├─ commands table
├─ workflows table
├─ metrics table
└─ ... other tables
```

---

## ⚡ Error Handling Evolution

### v4.0.0

```
try {
  const result = await executeCommand(cmd);
  res.json({ result });
} catch (error) {
  res.status(500).json({ error: error.message });
}

PROBLEMS:
❌ Try-catch in every route
❌ Generic error format
❌ No logging context
❌ Hard to debug
```

### v5.0.0

```
// 1. Domain layer exceptions
class CommandExecutionError extends DomainError {
  constructor(message, exitCode) { ... }
}

// 2. Application layer exceptions
class ApplicationException extends Error {
  constructor(message, code, statusCode) { ... }
}

// 3. Use case: Handle and transform
try {
  return await executor.execute(cmd);
} catch (error) {
  if (error instanceof TimeoutError) {
    throw new ApplicationException('Command timeout', 'TIMEOUT', 408);
  }
  throw error;
}

// 4. Global error handler (ONE place)
app.use((error, req, res) => {
  if (error instanceof ApplicationException) {
    logger.warn('Application error', { 
      code: error.code,
      requestId: req.id
    });
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message
    });
  }
  
  logger.error('Unhandled error', { error, requestId: req.id });
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

BENEFITS:
✅ Consistent error format
✅ One place to handle errors
✅ Structured logging
✅ Request correlation
✅ Type-safe
```

---

## 🧪 Dependency Injection Evolution

### v4.0.0

```
// Direct imports (tight coupling)
import { executeCommand } from './commandExecutor';
import { logger } from './config';
import { config } from './config';

export function handler(req, res) {
  try {
    const result = executeCommand(req.body.command);
    logger.log(result);
    res.json(result);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error });
  }
}

PROBLEMS:
❌ Hard to mock for testing
❌ Can't change implementations
❌ Global state (singletons)
❌ Hidden dependencies
```

### v5.0.0

```
// Dependency Injection (loose coupling)
@injectable()
class CommandExecutor { /* implementation */ }

@injectable()
class ExecuteCommandUseCase {
  constructor(
    @inject('CommandExecutor') executor: ICommandExecutor,
    @inject('Logger') logger: Logger
  ) {}
  
  async execute(cmd: string): Promise<Result> {
    // Use dependencies
  }
}

// Register once
container.registerSingleton('CommandExecutor', CommandExecutor);

// Use in controller
const useCase = container.resolve(ExecuteCommandUseCase);
const result = await useCase.execute(cmd);

// Testing: Easy to mock
describe('ExecuteCommandUseCase', () => {
  it('should handle timeout', () => {
    const mockExecutor = { execute: jest.fn() };
    const useCase = new ExecuteCommandUseCase(mockExecutor, mockLogger);
    
    mockExecutor.execute.mockRejectedValue(new TimeoutError());
    
    expect(() => useCase.execute('cmd')).toThrow('TIMEOUT');
  });
});

BENEFITS:
✅ Loose coupling
✅ Easy to test with mocks
✅ Swap implementations at runtime
✅ Clear dependencies
✅ Follows SOLID principles
```

---

## ✅ Validation Strategy Evolution

### v4.0.0

```
router.post('/execute', async (req, res) => {
  // Scattered validation
  if (!req.body.command) return res.status(400).json({ error: 'Required' });
  if (req.body.command.length > 10000) return res.status(400).json({ error: 'Too long' });
  if (req.body.timeout && req.body.timeout < 1000) return res.status(400).json({ error: 'Too small' });
  
  const result = await executeCommand(req.body.command);
  res.json(result);
});

PROBLEMS:
❌ Duplicated in every route
❌ No schema
❌ Hard to maintain
❌ Inconsistent errors
```

### v5.0.0

```
// Central schemas
export const executeCommandSchema = z.object({
  command: z.string().min(1).max(10000),
  timeout: z.number().min(1000).max(600000).optional(),
});

type ExecuteCommandRequest = z.infer<typeof executeCommandSchema>;

// Reusable middleware
const validate = (schema: ZodSchema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      issues: result.error.issues
    });
  }
  req.body = result.data;
  next();
};

// Use in routes
router.post(
  '/execute',
  validate(executeCommandSchema),
  async (req: Request<{}, {}, ExecuteCommandRequest>, res) => {
    const result = await useCase.execute(req.body);
    res.json(result);
  }
);

BENEFITS:
✅ Single schema source
✅ Reusable everywhere
✅ Type inference
✅ Consistent errors
✅ Easy to maintain
```

---

## 📊 Metrics & Observability Evolution

### v4.0.0

```
console.log('Starting...');
console.error('Error: ' + error.message);

Result:
[log] Starting...
[error] Error: ENOENT: no such file...

PROBLEMS:
❌ Unstructured text
❌ No context
❌ Can't parse/aggregate
❌ No correlation IDs
```

### v5.0.0

```
const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// With context
logger.info('Command execution started', {
  requestId: req.id,
  command: req.body.command,
  user: req.user?.id,
  timestamp: new Date().toISOString()
});

Result in log:
{
  "level": "info",
  "message": "Command execution started",
  "requestId": "abc123",
  "command": "echo test",
  "user": "admin",
  "timestamp": "2025-12-07T10:30:45.123Z"
}

BENEFITS:
✅ Structured JSON
✅ Correlation IDs
✅ Easy to aggregate
✅ Ready for ELK/CloudWatch
✅ Contextual logging
```

---

## 🎯 Migration Path

```
┌─────────────────────────────────────────────────────────┐
│ PHASE 5: Architecture Refactoring (4-6 sprints)        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Sprint 1-2: FOUNDATION                                 │
│  ├─ Add dependencies                                   │
│  ├─ Create folder structure                            │
│  ├─ Setup SQLite + Drizzle                             │
│  └─ Configure DI container                             │
│                                                         │
│ Sprint 3-4: CORE SERVICES                              │
│  ├─ Migrate commandExecutor                            │
│  ├─ Create repositories                                │
│  ├─ Create use cases                                   │
│  └─ Create controllers                                 │
│                                                         │
│ Sprint 5-6: COMPLETE STACK                             │
│  ├─ Migrate remaining services                         │
│  ├─ Global error handler                               │
│  ├─ 80%+ test coverage                                 │
│  └─ Update documentation                               │
│                                                         │
│ RELEASE: v5.0.0 ✅                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Scalability Comparison

```
v4.0.0 Architecture              v5.0.0 Architecture

     Routes                           Controllers
        ↓                                  ↓
    Services ←─── Tightly         Use Cases ←─── Loosely
        ↓           coupled            ↓           coupled
     Config                       Repositories
     + Logger                           ↓
     (Global)                        Database


Growth challenge:
  Adding service → Must modify many files
  Adding feature → Can't test in isolation
  Debugging → Hard to trace flow
  Performance → Can't identify bottleneck

Growth advantage:
  Adding service → New use case + controller
  Adding feature → Unit testable
  Debugging → Clear correlation IDs
  Performance → Easy to identify layer
```

---

## ✨ Before & After Summary

| Aspect | v4.0.0 | v5.0.0 |
|--------|--------|--------|
| **Data Storage** | Memory → Lost | SQLite → Persistent |
| **Error Handling** | Scattered try-catch | Centralized handler |
| **Validation** | Duplicated checks | Zod schemas |
| **Dependencies** | Direct imports | DI container |
| **Testing** | Integration only | Unit + Integration |
| **Logging** | console.log | Structured (JSON) |
| **Architecture** | 2 layers | 5 layers (clean) |
| **Coupling** | Tight | Loose |
| **Scale Readiness** | MVP | Enterprise |
| **Test Speed** | 20+ sec | <5 sec |
| **Coverage** | 60% | 80%+ |

---

## 🧭 Navigation in This Mental Map

- **Overall transformation**: See top section
- **Data flow**: See middle sections
- **Testing approach**: See "Testing Strategy Evolution"
- **Specific improvements**: See corresponding evolution sections
- **Migration timeline**: See "Migration Path"
- **Comparison table**: See "Before & After Summary"

---

**Created**: December 7, 2025  
**Purpose**: Visual guide to Phase 5 architectural evolution  
**Use**: Reference during design discussions and implementation
