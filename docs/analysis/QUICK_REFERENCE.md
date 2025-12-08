# 🚀 Quick Reference - Phase 5 Implementation

**Purpose**: Quick lookup guide for Phase 5 refactoring  
**Target Audience**: Developers implementing Phase 5  
**Last Updated**: December 7, 2025

---

## 📍 Documentation Map

### **For Decision Makers**
→ Start with `EXECUTIVE_SUMMARY.md` (20 min read)

### **For Architects**
→ Read `ARCHITECTURE_ANALYSIS.md` (45 min read)

### **For Developers**
→ Follow `REFACTORING_GUIDE.md` step by step

### **To See What Changes**
→ Review `BEFORE_AFTER_COMPARISON.md` (30 min read)

---

## ⚡ 11-Step Quick Checklist

```
Phase 5 Implementation Roadmap:

Sprint 1-2 (Foundation)
  [ ] Step 1: Add dependencies (zod, tsyringe, better-sqlite3, drizzle-orm)
  [ ] Step 2: Create folder structure (domain/, application/, infrastructure/, presentation/)
  [ ] Step 3: Create SQLite schema with drizzle
  [ ] Step 4: Setup DatabaseConnection singleton

Sprint 3-4 (Core Refactor)
  [ ] Step 5: Create domain entities (Command, Workflow, etc.)
  [ ] Step 6: Create repository interfaces
  [ ] Step 7: Implement SQLite repositories
  [ ] Step 8: Create use cases (application services)

Sprint 5-6 (Layers & Polish)
  [ ] Step 9: Create controllers
  [ ] Step 10: Add global error handler
  [ ] Step 11: Improve tests (80%+ coverage)
```

---

## 🛠️ Technology Stack

```bash
# Dependencies to add
npm install zod tsyringe reflect-metadata sqlite better-sqlite3 drizzle-orm
npm install --save-dev drizzle-kit

# Optional enhancements
npm install winston uuid        # For logging + IDs
npm install bull redis          # For job queue
npm install class-validator     # Alternative validation
```

---

## 📁 Folder Structure (Copy-Paste Ready)

```bash
mkdir -p api/src/domain/{entities,value-objects,services,repositories}
mkdir -p api/src/application/{use-cases,dto,interfaces}
mkdir -p api/src/infrastructure/{persistence,external,logging}
mkdir -p api/src/presentation/{controllers,middleware,dto}
mkdir -p api/src/common/{exceptions,utils,types}
```

---

## 🎯 Implementation Order

### **Must Do First**
1. Database setup (SQLite + Drizzle)
2. Exception hierarchy
3. Dependency injection container

### **Do Second**
4. Repository pattern for data access
5. Use cases (application services)
6. Controllers (request handlers)

### **Do Last**
7. Error handler middleware
8. Validation middleware
9. Logging improvements
10. Test suite upgrade

---

## 📝 Common Patterns

### **Exception Handling**
```typescript
// Create in common/exceptions/
export class ApplicationException extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
  }
}

// Use in use case
throw new ApplicationException(
  'Command not found',
  'NOT_FOUND',
  404
);

// Handle globally
app.use((error: Error, req, res) => {
  if (error instanceof ApplicationException) {
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
    });
  }
});
```

### **Repository Pattern**
```typescript
// Domain: define interface
export interface ICommandRepository {
  create(cmd: Command): Promise<Command>;
  findById(id: string): Promise<Command | null>;
  findAll(): Promise<Command[]>;
}

// Infrastructure: implement
@injectable()
export class SQLiteCommandRepository implements ICommandRepository {
  async create(cmd: Command): Promise<Command> {
    await db.insert(commands).values({...});
    return cmd;
  }
}
```

### **Dependency Injection**
```typescript
// Define
@injectable()
class ExecuteCommandUseCase {
  constructor(
    @inject('CommandRepository')
    private repo: ICommandRepository
  ) {}
}

// Register
container.registerSingleton('CommandRepository', SQLiteCommandRepository);

// Use
const useCase = container.resolve(ExecuteCommandUseCase);
```

### **Validation with Zod**
```typescript
// Define schema
export const executeCommandSchema = z.object({
  command: z.string().min(1).max(10000),
  timeout: z.number().optional(),
});

// Validate in middleware
const validate = (schema: z.ZodSchema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR' });
  }
  req.body = result.data;
  next();
};

// Use in route
router.post('/execute', validate(executeCommandSchema), handler);
```

---

## 🧪 Testing Template

```typescript
describe('ExecuteCommandUseCase', () => {
  let useCase: ExecuteCommandUseCase;
  let mockRepo: jest.Mocked<ICommandRepository>;
  let mockExecutor: jest.Mocked<ICommandExecutor>;

  beforeEach(() => {
    mockRepo = { 
      create: jest.fn(), 
      save: jest.fn(),
    } as any;
    mockExecutor = { 
      execute: jest.fn() 
    } as any;
    
    useCase = new ExecuteCommandUseCase(mockRepo, mockExecutor);
  });

  it('should execute and save command', async () => {
    mockExecutor.execute.mockResolvedValue({ 
      stdout: 'test', 
      exitCode: 0 
    });

    const result = await useCase.execute('echo test');

    expect(mockRepo.create).toHaveBeenCalled();
    expect(result.status).toBe('success');
  });
});
```

---

## 🔧 Database Setup (SQLite)

```typescript
// drizzle/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const commands = sqliteTable('commands', {
  id: text('id').primaryKey(),
  command: text('command').notNull(),
  output: text('output'),
  exitCode: integer('exit_code'),
  status: text('status').notNull(),
});

// infrastructure/persistence/Database.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

export const db = drizzle(
  new Database('data/database.db'),
  { schema }
);
```

---

## 📊 Migration Strategy

### **Phase A: Foundation (Non-Breaking)**
- Add new layers alongside existing code
- New features use Clean Architecture
- Old code remains unchanged
- Backward-compatible API

### **Phase B: Gradual Migration (Optional)**
- Migrate one service at a time
- Update tests during migration
- Run parallel tests (old vs new)
- Retire old code incrementally

### **Phase C: Cleanup**
- Remove old route/service structure
- Consolidate to single architecture
- Update documentation
- Release v5.0.0

---

## 🚨 Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| **Tight coupling to Express** | Abstract Request/Response in middleware |
| **Circular dependencies** | Respect layer boundaries (domain ← app ← infra) |
| **Over-injecting dependencies** | Only inject what you need, not entire services |
| **Skipping tests during refactor** | Write tests as you go, not after |
| **Migrating too fast** | Do it gradually, feature by feature |
| **Forgetting error cases** | Test both happy path and error scenarios |
| **Making DB queries in domain** | Keep domain pure, queries in repositories |

---

## ✅ Daily Standdown Checklist

Each day during Phase 5:

- [ ] Tests passing: `npm test`
- [ ] No TypeScript errors: `npm run build`
- [ ] Code still runs: `npm run dev`
- [ ] Committed changes with meaningful messages
- [ ] Pushed to feature branch
- [ ] Pulled latest from develop
- [ ] Reviewed code quality
- [ ] Updated documentation if needed

---

## 📋 Sprint Planning Template

### **Sprint Goal**
[What capability are we adding?]

### **User Stories**
- [ ] Story 1: [What]
- [ ] Story 2: [What]
- [ ] Story 3: [What]

### **Technical Tasks**
- [ ] Setup [infrastructure]
- [ ] Implement [domain logic]
- [ ] Create [controllers]
- [ ] Write [tests]

### **Done Criteria**
- [ ] Tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Can be deployed

---

## 🎓 Learning Resources

**Understanding Clean Architecture**:
- Robert C. Martin's Clean Architecture book
- ARCHITECTURE_ANALYSIS.md (this project)

**Tsyringe DI**:
- https://github.com/microsoft/tsyringe
- Examples in REFACTORING_GUIDE.md

**Zod Validation**:
- https://zod.dev/
- Examples in REFACTORING_GUIDE.md

**Drizzle ORM**:
- https://orm.drizzle.team/
- Examples in REFACTORING_GUIDE.md

---

## 🆘 Getting Stuck?

1. **Architectural question?** → Read ARCHITECTURE_ANALYSIS.md
2. **Implementation question?** → See REFACTORING_GUIDE.md
3. **Pattern question?** → Check BEFORE_AFTER_COMPARISON.md
4. **Testing question?** → Review REFACTORING_GUIDE.md Step 10
5. **Not in docs?** → Create GitHub Discussion

---

## 📞 Quick Links

- 🏠 [Main docs folder](../docs/)
- 📊 [Architecture Analysis](./ARCHITECTURE_ANALYSIS.md)
- 🔧 [Refactoring Guide](./REFACTORING_GUIDE.md)
- 📈 [Executive Summary](./EXECUTIVE_SUMMARY.md)
- 🔄 [Before/After](./BEFORE_AFTER_COMPARISON.md)
- 📋 [Session Summary](../SESSION_SUMMARY.md)

---

## ⏱️ Time Estimates

| Task | Effort | Impact |
|------|--------|--------|
| Read docs | 2 hours | High |
| Setup foundation | 1 sprint | Critical |
| Create 1st repository | 1-2 days | Medium |
| Create 1st use case | 1-2 days | Medium |
| Migrate 1st service | 2-3 days | Medium |
| Global error handler | 1 day | High |
| Test suite update | 1 sprint | High |
| Full Phase 5 | 4-6 sprints | Critical |

---

## 🎉 Success Indicators

When Phase 5 is complete, you'll have:

- ✅ SQLite database with 100+ rows of data persisting
- ✅ 80%+ test coverage with 50%+ unit tests
- ✅ Tests running in <5 seconds
- ✅ New developers can understand code in 1 day
- ✅ Adding new features takes 1 day instead of 3 days
- ✅ Debugging errors is 10x easier (structured logging)
- ✅ Confidence to deploy to production

---

**Quick Reference Guide**  
**Keep this handy during Phase 5 implementation**  
**Last updated**: December 7, 2025
