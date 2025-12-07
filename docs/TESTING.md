# 🧪 Testing Documentation

Complete documentation on testing strategy, execution and coverage of the VPS Local Orchestrator project.

## 📋 Table of Contents

- [Overview](#overview)
- [Testing Setup](#testing-setup)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing New Tests](#writing-new-tests)
- [Post-Test Cleanup](#post-test-cleanup)
- [Coverage](#coverage)

---

## 📖 Overview

The testing suite uses **Jest** as the main framework with **TypeScript** support via **ts-jest**.

### Testing Stack

- **Jest 30.x** - Test runner and assertion library
- **ts-jest 29.x** - TypeScript transformer
- **Supertest 7.x** - HTTP assertion library (available for integration tests)
- **@types/jest** - Type definitions for Jest

### Features

- ✅ **50+ unit and integration tests**
- ✅ **100% passing on compile**
- ✅ **Automatic post-test cleanup**
- ✅ **Full ESM (ES Modules) support**
- ✅ **Type-safe with TypeScript**

---

## 🔧 Configuración de Testing

### Archivos de Configuración

#### `jest.config.js`

```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  // ... más configuración
};
```

**Puntos clave:**
- `preset: 'ts-jest'` - Compila TypeScript para Jest
- `extensionsToTreatAsEsm: ['.ts']` - Soporte para ES Modules
- `roots: ['<rootDir>/tests']` - Tests solo en directorio `/tests`
- `setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']` - Archivo de setup

#### `tests/setup.ts`

```typescript
import fs from 'fs';
import path from 'path';

function cleanupTestDirectories() {
  const dirs = ['workflows', 'metrics', 'databases', 'loadbalancer', 'backups', 'webhooks'];
  dirs.forEach((dir) => {
    const dirPath = path.join(process.cwd(), 'api', dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  });
}

// Limpiar antes de tests
cleanupTestDirectories();

// Limpiar después de todos los tests
afterAll(() => {
  cleanupTestDirectories();
});
```

**Responsabilidades:**
- Limpia directorios generados **antes** de cada ejecución
- Limpia directorios generados **después** de completar todos los tests

### Variables de Entorno

Los tests usan `.env` para:
- `API_TOKEN` - Token de autenticación para tests de rutas protegidas
- Otros valores de configuración según necesidad

**Nota:** Los tests están diseñados para funcionar incluso sin token definido.

---

## 📁 Estructura de Tests

```
api/tests/
├── setup.ts                          # Archivo de setup global
├── integration/
│   ├── endpoints.test.ts             # Tests de estructura API
│   └── advanced.test.ts              # Tests de features avanzadas
└── unit/
    ├── commandExecutor.test.ts       # Tests de ejecución de comandos
    ├── metricsManager.test.ts        # Tests de métricas
    └── analyticsManager.test.ts      # Tests de analítica
```

### Categorías de Tests

#### 1. **Integration Tests** (`integration/`)

Tests que verifican la estructura, configuración y comportamiento general de la API.

**Ejemplos:**
- Verificar que tokens de API estén configurados
- Verificar estructura de rutas
- Verificar features avanzadas (workflows, Docker, databases, etc.)

**Archivo:** `integration/endpoints.test.ts`, `integration/advanced.test.ts`

#### 2. **Unit Tests** (`unit/`)

Tests de lógica específica de servicios sin dependencias externas.

**Ejemplos:**
- Análisis de seguridad de comandos
- Cálculos de agregación de métricas
- Detección de tendencias
- Filtrado y búsqueda de datos

**Archivos:** `unit/commandExecutor.test.ts`, `unit/metricsManager.test.ts`, `unit/analyticsManager.test.ts`

---

## ▶️ Ejecutar Tests

### Ejecutar Todos los Tests

```bash
npm test
```

**Salida esperada:**
```
PASS tests/unit/analyticsManager.test.ts
PASS tests/unit/metricsManager.test.ts
PASS tests/unit/commandExecutor.test.ts
PASS tests/integration/advanced.test.ts
PASS tests/integration/endpoints.test.ts

Test Suites: 5 passed, 5 total
Tests:       50 passed, 50 total
```

### Ejecutar en Modo Watch

Para desarrollo - reinicia tests automáticamente en cambios:

```bash
npm run test:watch
```

### Generar Reporte de Cobertura

```bash
npm run test:coverage
```

**Genera:**
- Reporte en consola
- `coverage/` directorio con reportes HTML (abrir `coverage/index.html`)
- `coverage/lcov.info` para CI/CD

### Ejecutar Test Específico

```bash
npm test -- commandExecutor.test.ts
```

### Ejecutar Suite Específica

```bash
npm test -- --testPathPattern=integration
npm test -- --testPathPattern=unit
```

### Opciones Útiles

```bash
# Mostrar tests pasados/fallidos
npm test -- --verbose

# Ver reporte detallado
npm test -- --coverage --coverageReporters=text-summary

# Detener en primer error
npm test -- --bail

# Sin limpiar cache
npm test -- --no-cache
```

---

## ✍️ Escribir Nuevos Tests

### Estructura Básica

```typescript
describe('Unit Tests - MyFeature', () => {
  describe('Feature Group', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = myFunction(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Ejemplo: Test de un Servicio

```typescript
describe('Unit Tests - MyService', () => {
  describe('processData', () => {
    it('should return processed data', () => {
      const data = { value: 42 };
      const result = processData(data);
      expect(result).toHaveProperty('processed');
      expect(result.processed).toBe(true);
    });

    it('should handle errors gracefully', () => {
      const invalidData = null;
      expect(() => processData(invalidData)).toThrow();
    });

    it('should filter data by criteria', () => {
      const items = [1, 2, 3, 4, 5];
      const filtered = items.filter((x) => x > 2);
      expect(filtered).toEqual([3, 4, 5]);
    });
  });
});
```

### Mejores Prácticas

1. **Nombre Descriptivo**
   ```typescript
   // ✅ Bueno
   it('should return 401 when token is invalid', () => {})

   // ❌ Malo
   it('returns error', () => {})
   ```

2. **Un Concepto por Test**
   ```typescript
   // ✅ Cada test verifica una cosa
   it('should calculate sum correctly', () => {})
   it('should handle empty arrays', () => {})

   // ❌ No agrupar múltiples verificaciones
   ```

3. **AAA Pattern** (Arrange-Act-Assert)
   ```typescript
   it('should validate input', () => {
     // Arrange
     const input = 'test@example.com';

     // Act
     const result = validateEmail(input);

     // Assert
     expect(result).toBe(true);
   });
   ```

4. **Tests Independientes**
   - Cada test debe funcionar aisladamente
   - No dependencias entre tests
   - Limpieza automática de estado

### Matchers Comunes

```typescript
// Igualdad
expect(value).toBe(expected);           // ===
expect(value).toEqual(expected);        // contenido igual
expect(value).not.toBe(expected);

// Booleanos
expect(value).toBeTruthy();
expect(value).toBeFalsy();

// Tipos
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Números
expect(value).toBeGreaterThan(5);
expect(value).toBeLessThan(10);
expect(value).toBeCloseTo(3.1);

// Arrays
expect(value).toContain('item');
expect(value).toHaveLength(5);
expect(value).toEqual([1, 2, 3]);

// Strings
expect(value).toMatch(/pattern/);
expect(value).toMatch('substring');

// Objetos
expect(value).toHaveProperty('key');
expect(value).toHaveProperty('key', 'value');

// Funciones
expect(func).toThrow();
expect(func).toThrow(Error);
```

---

## 🧹 Limpieza Post-Tests

Cada ejecución de tests limpia automáticamente:

```
api/workflows/
api/metrics/
api/databases/
api/loadbalancer/
api/backups/
api/webhooks/
```

**Proceso:**
1. **Pre-test:** Limpia directorios antes de ejecutar
2. **Ejecuta tests:** Servicios pueden generar archivos temporales
3. **Post-test:** Limpia automáticamente después de completar

**Configurado en:** `tests/setup.ts` con hooks `afterAll()`

### Limpieza Manual

Si necesitas limpiar manualmente:

```bash
# Bash
rm -rf api/workflows api/metrics api/databases api/loadbalancer api/backups api/webhooks

# O usar el script setup
npm test  # Ejecuta limpieza
```

---

## 📊 Cobertura

### Generar Cobertura

```bash
npm run test:coverage
```

### Interpretar Reporte

```
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------|---------|----------|---------|---------|-------------------
All files |   45.2  |   32.1   |   50.3  |   44.9  | ...
services/ |   62.5  |   45.2   |   70.1  |   60.3  | ...
routes/   |   28.3  |   15.2   |   30.5  |   27.1  | ...
----------|---------|----------|---------|---------|-------------------
```

**Métricas:**
- **% Stmts** - Porcentaje de statements ejecutados
- **% Branch** - Porcentaje de branches (if/else) ejecutados
- **% Funcs** - Porcentaje de funciones llamadas
- **% Lines** - Porcentaje de líneas ejecutadas

### Objetivos de Cobertura

- **Servicios:** 70%+
- **Routes:** 60%+
- **Utilities:** 80%+
- **Total:** 60%+

### Mejorar Cobertura

1. **Tests de Error:**
   ```typescript
   it('should handle error case', () => {
     expect(() => riskyFunction()).toThrow();
   });
   ```

2. **Edge Cases:**
   ```typescript
   it('should handle empty input', () => {
     expect(processData([])).toEqual([]);
   });
   ```

3. **Branches:**
   ```typescript
   // Cubrir ambos if/else
   it('should return value when exists', () => {});
   it('should return default when missing', () => {});
   ```

---

## 🔍 Troubleshooting

### Error: "Cannot find module"

**Causa:** Import path incorrecto

**Solución:**
```typescript
// ✅ Correcto
import { myFunction } from '../../src/services/myService.js';

// ❌ Incorrecto
import { myFunction } from './../../src/services/myService';
```

### Error: "Cannot use import statement outside module"

**Causa:** ESM no configurado

**Solución:** Verificar `jest.config.js` tiene:
```javascript
extensionsToTreatAsEsm: ['.ts'],
```

### Error: "Timeout - Async callback not called"

**Causa:** Test tarda más de 10 segundos

**Solución:**
```typescript
it('should handle async operation', async () => {
  const result = await slowFunction();
  expect(result).toBeDefined();
}, 20000);  // 20 segundo timeout
```

### Tests Lentos

**Diagnóstico:**
```bash
npm test -- --detectOpenHandles
npm test -- --detectLeaks
```

**Solución:**
- Revisar cleanup en `setup.ts`
- Usar `jest.useFakeTimers()` para timing
- Limitar paralelismo: `npm test -- --maxWorkers=2`

---

## 📚 Referencias

- [Jest Documentation](https://jestjs.io/)
- [ts-jest Setup](https://kulshekhar.github.io/ts-jest/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://jestjs.io/docs/getting-started)

---

**Última actualización:** Diciembre 2025  
**Versión:** v4.0.0
