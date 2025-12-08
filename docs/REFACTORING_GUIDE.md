# 🔧 Guía de Refactorización Práctica - Phase 5

**Objetivo**: Migrar gradualmente de arquitectura actual a Clean Architecture + DDD  
**Versión destino**: v5.0.0  
**Duración estimada**: 4-6 sprints

---

## 📋 Paso 1: Agregar Dependencias Necesarias

### package.json Actualizado

```bash
npm install zod tsyringe reflect-metadata sqlite better-sqlite3 drizzle-orm
npm install --save-dev drizzle-kit
```

```json
{
  "dependencies": {
    "express": "^5.2.1",
    "dotenv": "^17.2.3",
    "zod": "^3.22.0",
    "tsyringe": "^4.8.0",
    "sqlite": "^5.0.0",
    "better-sqlite3": "^9.0.0",
    "drizzle-orm": "^0.29.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.0"
  }
}
```

---

## 🏗️ Paso 2: Crear Estructura de Capas

### 2.1 Crear Carpetas

```bash
mkdir -p api/src/domain/{entities,value-objects,services,repositories}
mkdir -p api/src/application/{use-cases,dto,interfaces}
mkdir -p api/src/infrastructure/{persistence,external,logging}
mkdir -p api/src/presentation/{controllers,middleware,dto}
mkdir -p api/src/common/{exceptions,utils,types}
```

### 2.2 Migrración Gradual

**Fase 1**: Nuevas funcionalidades en Clean Architecture  
**Fase 2**: Refactorizar servicios existentes  
**Fase 3**: Actualizar routes a controllers  

---

## 💾 Paso 3: Persistencia con SQLite + Drizzle

### 3.1 Crear Schema (drizzle/schema.ts)

```typescript
import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const commands = sqliteTable('commands', {
  id: text('id').primaryKey(),
  command: text('command').notNull(),
  output: text('output'),
  exitCode: integer('exit_code'),
  duration: integer('duration'),
  status: text('status', { enum: ['pending', 'success', 'failed'] }).notNull(),
  executedAt: integer('executed_at').notNull(),
  createdAt: integer('created_at').default(sql`(cast(unixepoch() as int))`),
});

export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  definition: text('definition').notNull(), // JSON string
  status: text('status', { enum: ['active', 'paused', 'archived'] }).notNull(),
  lastRun: integer('last_run'),
  createdAt: integer('created_at').default(sql`(cast(unixepoch() as int))`),
});

export const metrics = sqliteTable('metrics', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'cpu', 'memory', 'disk'
  value: real('value').notNull(),
  timestamp: integer('timestamp').notNull(),
});
```

### 3.2 Configurar Base de Datos (infrastructure/persistence/Database.ts)

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../../drizzle/schema';
import path from 'path';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private db: any;

  private constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'database.db');
    const sqliteDb = new Database(dbPath);
    this.db = drizzle(sqliteDb, { schema });
  }

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  getDb() {
    return this.db;
  }
}

export const database = DatabaseConnection.getInstance().getDb();
```

### 3.3 Repository Implementation (infrastructure/persistence/CommandRepository.ts)

```typescript
import { injectable } from 'tsyringe';
import { eq, desc } from 'drizzle-orm';
import { database } from './Database';
import { commands } from '../../../drizzle/schema';
import type { ICommandRepository } from '../../domain/repositories/ICommandRepository';
import type { Command } from '../../domain/entities/Command';

@injectable()
export class SQLiteCommandRepository implements ICommandRepository {
  async create(command: Command): Promise<Command> {
    await database.insert(commands).values({
      id: command.id,
      command: command.command,
      output: command.output,
      exitCode: command.exitCode,
      duration: command.duration,
      status: command.status,
      executedAt: command.executedAt,
    });
    return command;
  }

  async findById(id: string): Promise<Command | null> {
    const result = await database
      .select()
      .from(commands)
      .where(eq(commands.id, id))
      .limit(1);
    
    return result[0] ? this.mapToDomain(result[0]) : null;
  }

  async findAll(): Promise<Command[]> {
    const results = await database
      .select()
      .from(commands)
      .orderBy(desc(commands.createdAt))
      .limit(100);
    
    return results.map(r => this.mapToDomain(r));
  }

  async update(id: string, command: Partial<Command>): Promise<void> {
    await database
      .update(commands)
      .set({
        output: command.output,
        exitCode: command.exitCode,
        duration: command.duration,
        status: command.status,
      })
      .where(eq(commands.id, id));
  }

  async delete(id: string): Promise<void> {
    await database
      .delete(commands)
      .where(eq(commands.id, id));
  }

  private mapToDomain(raw: any): Command {
    return new Command(
      raw.id,
      raw.command,
      raw.output,
      raw.exitCode,
      raw.duration,
      raw.status,
      raw.executedAt
    );
  }
}
```

---

## 🎯 Paso 4: Excepciones Personalizadas

### 4.1 Crear Excepciones (common/exceptions/)

```typescript
// ApplicationException.ts
export class ApplicationException extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ApplicationException';
  }
}

// DomainException.ts
export class DomainException extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DomainException';
  }
}

// NotFoundException.ts
export class NotFoundException extends ApplicationException {
  constructor(resource: string, id: string) {
    super(
      `${resource} with id ${id} not found`,
      'NOT_FOUND',
      404
    );
  }
}

// ValidationException.ts
export class ValidationException extends ApplicationException {
  constructor(errors: any[]) {
    super(
      'Validation failed',
      'VALIDATION_ERROR',
      400,
      { errors }
    );
  }
}

// CommandExecutionException.ts
export class CommandExecutionException extends DomainException {
  constructor(
    message: string,
    public exitCode: number,
    public stderr: string
  ) {
    super(message, 'COMMAND_EXECUTION_ERROR');
  }
}
```

---

## ✅ Paso 5: Validación con Zod

### 5.1 Schemas Centralizados (application/dto/schemas.ts)

```typescript
import { z } from 'zod';

export const executeCommandSchema = z.object({
  command: z.string()
    .min(1, 'Command cannot be empty')
    .max(10000, 'Command too long'),
  timeout: z.number()
    .min(1000, 'Timeout must be at least 1s')
    .max(600000, 'Timeout must be less than 10 minutes')
    .optional()
    .default(30000),
  cwd: z.string().optional(),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  definition: z.object({
    steps: z.array(z.object({
      id: z.string(),
      type: z.enum(['command', 'wait', 'condition']),
      config: z.record(z.any()),
    })),
  }),
});

export type ExecuteCommandRequest = z.infer<typeof executeCommandSchema>;
export type CreateWorkflowRequest = z.infer<typeof createWorkflowSchema>;
```

### 5.2 Middleware de Validación (presentation/middleware/ValidationMiddleware.ts)

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationException } from '../../common/exceptions/ValidationException';

export const validate = (schema: ZodSchema) => 
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        throw new ValidationException(
          result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          }))
        );
      }
      
      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
```

---

## 🛠️ Paso 6: Entities y Domain Services

### 6.1 Entity (domain/entities/Command.ts)

```typescript
import { ulid } from 'ulid';

export class Command {
  id: string;
  command: string;
  output?: string;
  exitCode?: number;
  duration?: number;
  status: 'pending' | 'success' | 'failed';
  executedAt: number;
  createdAt: number;

  constructor(
    id: string,
    command: string,
    output?: string,
    exitCode?: number,
    duration?: number,
    status: 'pending' | 'success' | 'failed' = 'pending',
    executedAt: number = Date.now(),
    createdAt: number = Date.now()
  ) {
    this.id = id;
    this.command = command;
    this.output = output;
    this.exitCode = exitCode;
    this.duration = duration;
    this.status = status;
    this.executedAt = executedAt;
    this.createdAt = createdAt;
  }

  static create(command: string): Command {
    return new Command(ulid(), command);
  }

  markSuccess(output: string, duration: number, exitCode: number = 0): void {
    this.output = output;
    this.status = 'success';
    this.duration = duration;
    this.exitCode = exitCode;
  }

  markFailed(output: string, exitCode: number = 1): void {
    this.output = output;
    this.status = 'failed';
    this.exitCode = exitCode;
  }

  isSuccess(): boolean {
    return this.status === 'success' && this.exitCode === 0;
  }
}
```

### 6.2 Repository Interface (domain/repositories/ICommandRepository.ts)

```typescript
import type { Command } from '../entities/Command';

export interface ICommandRepository {
  create(command: Command): Promise<Command>;
  findById(id: string): Promise<Command | null>;
  findAll(): Promise<Command[]>;
  update(id: string, command: Partial<Command>): Promise<void>;
  delete(id: string): Promise<void>;
}
```

---

## 🚀 Paso 7: Use Cases (Application Layer)

### 7.1 ExecuteCommandUseCase (application/use-cases/ExecuteCommandUseCase.ts)

```typescript
import { injectable, inject } from 'tsyringe';
import { Command } from '../../domain/entities/Command';
import type { ICommandRepository } from '../../domain/repositories/ICommandRepository';
import type { ICommandExecutor } from '../../domain/services/ICommandExecutor';
import { CommandExecutionException } from '../../common/exceptions/CommandExecutionException';
import type { ExecuteCommandRequest } from '../dto/schemas';

@injectable()
export class ExecuteCommandUseCase {
  constructor(
    @inject('CommandRepository')
    private commandRepository: ICommandRepository,
    @inject('CommandExecutor')
    private executor: ICommandExecutor,
  ) {}

  async execute(request: ExecuteCommandRequest): Promise<Command> {
    // 1. Create domain entity
    const command = Command.create(request.command);
    
    // 2. Save initial state
    await this.commandRepository.create(command);
    
    // 3. Execute
    const startTime = Date.now();
    try {
      const result = await this.executor.execute(
        request.command,
        request.timeout,
        request.cwd
      );
      
      const duration = Date.now() - startTime;
      command.markSuccess(result.stdout, duration, result.exitCode);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      command.duration = duration;
      
      if (error instanceof CommandExecutionException) {
        command.markFailed(error.stderr, error.exitCode);
      } else {
        throw error;
      }
    }
    
    // 4. Persist result
    await this.commandRepository.update(command.id, command);
    
    return command;
  }
}
```

---

## 🎮 Paso 8: Controllers (Presentation Layer)

### 8.1 CommandController (presentation/controllers/CommandController.ts)

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { injectable, inject, container } from 'tsyringe';
import { ExecuteCommandUseCase } from '../../application/use-cases/ExecuteCommandUseCase';
import { executeCommandSchema } from '../../application/dto/schemas';
import { validate } from '../middleware/ValidationMiddleware';
import { requireAuth } from '../middleware/AuthMiddleware';
import type { ExecuteCommandRequest } from '../../application/dto/schemas';

@injectable()
export class CommandController {
  constructor(
    @inject(ExecuteCommandUseCase)
    private executeCommandUseCase: ExecuteCommandUseCase,
  ) {}

  async executeCommand(
    req: Request<{}, {}, ExecuteCommandRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const command = await this.executeCommandUseCase.execute(req.body);
      res.json({
        success: true,
        command: {
          id: command.id,
          command: command.command,
          status: command.status,
          output: command.output,
          exitCode: command.exitCode,
          duration: command.duration,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

// Factory for routes
export function createCommandRoutes(): Router {
  const router = Router();
  const controller = container.resolve(CommandController);
  
  router.post(
    '/execute',
    requireAuth,
    validate(executeCommandSchema),
    (req, res, next) => controller.executeCommand(req, res, next)
  );
  
  return router;
}
```

---

## ⚠️ Paso 9: Global Error Handler

### 9.1 Error Handling Middleware (presentation/middleware/ErrorHandler.ts)

```typescript
import { Request, Response, NextFunction } from 'express';
import { ApplicationException } from '../../common/exceptions/ApplicationException';
import { DomainException } from '../../common/exceptions/DomainException';
import { logger } from '../../config';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = (req as any).id || 'unknown';
  
  // Application Exception (Expected errors)
  if (error instanceof ApplicationException) {
    logger.warn('Application exception', {
      requestId,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    });
    
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
    });
    return;
  }
  
  // Domain Exception (Business rule violations)
  if (error instanceof DomainException) {
    logger.warn('Domain exception', {
      requestId,
      code: error.code,
      message: error.message,
    });
    
    res.status(400).json({
      error: error.code,
      message: error.message,
    });
    return;
  }
  
  // Unhandled errors
  logger.error('Unhandled error', {
    requestId,
    error: error.message,
    stack: error.stack,
  });
  
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
};
```

### 9.2 Actualizar index.ts

```typescript
import express from 'express';
import 'reflect-metadata';
import { container } from 'tsyringe';
import { errorHandler } from './presentation/middleware/ErrorHandler';
import { createCommandRoutes } from './presentation/controllers/CommandController';

const app = express();

// Middleware
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  (req as any).id = Math.random().toString(36).substring(7);
  next();
});

// Routes
app.use('/api/command', createCommandRoutes());

// Global error handler (MUST BE LAST)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 🧪 Paso 10: Testing Mejorado

### 10.1 Test con Mocks (tests/ExecuteCommandUseCase.test.ts)

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExecuteCommandUseCase } from '../src/application/use-cases/ExecuteCommandUseCase';
import type { ICommandRepository } from '../src/domain/repositories/ICommandRepository';
import type { ICommandExecutor } from '../src/domain/services/ICommandExecutor';

describe('ExecuteCommandUseCase', () => {
  let useCase: ExecuteCommandUseCase;
  let mockRepository: jest.Mocked<ICommandRepository>;
  let mockExecutor: jest.Mocked<ICommandExecutor>;
  
  beforeEach(() => {
    mockRepository = {
      create: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    } as any;
    
    mockExecutor = {
      execute: jest.fn(),
    } as any;
    
    useCase = new ExecuteCommandUseCase(mockRepository, mockExecutor);
  });
  
  it('should execute command and persist result', async () => {
    mockExecutor.execute.mockResolvedValue({
      stdout: 'Hello World',
      exitCode: 0,
    });
    
    const result = await useCase.execute({
      command: 'echo "Hello World"',
    });
    
    expect(result.status).toBe('success');
    expect(result.exitCode).toBe(0);
    expect(mockRepository.create).toHaveBeenCalled();
    expect(mockRepository.update).toHaveBeenCalled();
  });
  
  it('should mark command as failed on error', async () => {
    mockExecutor.execute.mockRejectedValue(
      new Error('Command failed')
    );
    
    // Test expected behavior
  });
});
```

---

## 📊 Paso 11: Actualizar package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "db:generate": "drizzle-kit generate:sqlite",
    "db:push": "drizzle-kit push:sqlite"
  }
}
```

---

## 🔄 Estrategia de Migración Gradual

### Sprint 1-2: Foundation
1. ✅ Agregar dependencias
2. ✅ Crear estructura de carpetas
3. ✅ Implementar excepciones personalizadas
4. ✅ Configurar SQLite + Drizzle

### Sprint 3-4: Refactor Core
5. ✅ Crear repository para Commands
6. ✅ Crear use case para ExecuteCommand
7. ✅ Crear controller para Command
8. ✅ Reemplazar routes antiguas

### Sprint 5-6: Complete Layer
9. ✅ Agregar más repositories (Workflows, Metrics)
10. ✅ Crear más use cases
11. ✅ Refactorizar todos los controllers
12. ✅ Tests completos

---

## ✨ Beneficios Después de Refactorización

| Aspecto | Antes | Después |
|---|---|---|
| **Testabilidad** | Difícil, requiere mocks complejos | Fácil con inyección de dependencias |
| **Persistencia** | En memoria | SQLite con ACID |
| **Error Handling** | Inconsistente | Centralizado y typed |
| **Validación** | Ad-hoc | Centralizada con Zod |
| **Escalabilidad** | Monolito acoplado | Capas desacopladas |
| **Mantenibilidad** | Difícil de seguir | Clear separation of concerns |

---

**Documento completado**: Diciembre 7, 2025  
**Listo para comenzar Phase 5**
