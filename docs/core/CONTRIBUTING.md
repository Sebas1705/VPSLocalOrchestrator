# Contribution Guide

## 📋 Table of Contents

- [Development Setup](#development-setup)
- [Git Workflow](#git-workflow)
- [Code Standards](#code-standards)
- [Semantic Commits](#semantic-commits)
- [Pull Requests](#pull-requests)
- [Code Review](#code-review)

## 🚀 Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator
```

### 2. Configure Development Branch
```bash
# Make sure you're on develop
git checkout develop

# Update remote changes
git pull origin develop
```

### 3. Create Feature Branch
```bash
# Create branch from develop
git checkout -b feature/your-feature develop

# Examples
git checkout -b feature/add-websockets develop
git checkout -b bugfix/fix-token-validation develop
git checkout -b docs/update-readme develop
```

### 4. Local Setup
```bash
cd api
npm install
cp .env.example .env
nano .env  # Edit with local values

npm run dev
```

## 🔄 Git Workflow

### Estructura de Ramas

```
main (producción)
  ↑
  └── develop (desarrollo)
        ↑
        ├── feature/add-websockets
        ├── feature/add-rate-limiting
        ├── bugfix/fix-token-validation
        └── docs/update-readme
```

### Proceso de Cambios

#### 1. Crear Rama de Trabajo
```bash
# Desde develop
git checkout develop
git pull origin develop

# Crear rama
git checkout -b feature/nombre-feature develop
```

#### 2. Hacer Cambios
```bash
# Editar archivos
nano api/src/routes/command.routes.ts

# Verificar cambios
git status
```

#### 3. Commit con Mensaje Semántico
```bash
# Ver próxima sección para detalles

git add api/src/routes/command.routes.ts
git commit -m "feat: add new endpoint for resource monitoring"
```

#### 4. Push a Rama
```bash
# Primera vez
git push -u origin feature/nombre-feature

# Siguientes veces
git push origin feature/nombre-feature
```

#### 5. Crear Pull Request
```
En GitHub:
1. Ve a https://github.com/Sebas1705/VPSLocalOrchestrator
2. Click en "Pull Requests"
3. Click en "New Pull Request"
4. Base: main, Compare: feature/nombre-feature
5. Completar template de PR
6. Crear PR
```

#### 6. Merge después de Aprobación
```bash
# En GitHub, usar "Squash and merge" o "Merge with --no-ff"
# Esto preserva el historial de commits

# Localmente (después de merge)
git checkout develop
git pull origin develop
git branch -d feature/nombre-feature
```

## 🏷️ Commits Semánticos

### Formato
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Tipos
- **feat**: Nueva característica
- **fix**: Corrección de bug
- **docs**: Cambios en documentación
- **style**: Cambios de formato (espacios, comas, etc.)
- **refactor**: Refactorización sin cambiar funcionalidad
- **perf**: Mejoras de performance
- **test**: Agregar o actualizar tests
- **chore**: Cambios en build, dependencias, etc.

### Ejemplos

```bash
# Nueva característica
git commit -m "feat(api): add websocket support for real-time logging"

# Fix de bug
git commit -m "fix(auth): prevent timing attack in token validation"

# Documentación
git commit -m "docs(readme): update installation instructions"

# Múltiples cambios
git commit -m "refactor(middleware): extract security checks into separate functions"

# Con descripción
git commit -m "feat(resources): add memory usage tracking

- Track heap usage
- Monitor RSS
- Add /api/resources/memory endpoint

Closes #123"
```

## 📝 Estándares de Código

### TypeScript
- Usar `const` en lugar de `let`/`var`
- Tipado explícito en funciones
- No usar `any` (a menos que sea absolutamente necesario)
- Comentarios JSDoc para funciones públicas

```typescript
// ✅ Correcto
export function executeCommand(
  command: string,
  options: CommandOptions = {}
): Promise<CommandResult> {
  /**
   * Executa un comando del sistema
   * @param command - Comando a ejecutar
   * @param options - Opciones de ejecución
   * @returns Resultado de la ejecución
   */
}

// ❌ Incorrecto
function executeCommand(command, options = {}) {
  // sin tipado
}
```

### Seguridad
- Nunca hardcodear credenciales
- Usar variables de entorno para secretos
- Validar inputs del usuario
- Loguear sin exponer datos sensibles

```typescript
// ✅ Correcto
const token = process.env.API_TOKEN;
logger.info(`Token validation: ${token.substring(0, 10)}...`);

// ❌ Incorrecto
const token = "secret123";
console.log(`Token: ${token}`);
```

### Funciones
- Máximo 30 líneas de código
- Una responsabilidad por función
- Nombres descriptivos

```typescript
// ✅ Correcto - Una responsabilidad
function validateToken(token: string): boolean {
  // Validar token solamente
}

function authenticateRequest(req: Request): boolean {
  // Autenticación de request
}

// ❌ Incorrecto - Múltiples responsabilidades
function validateAndProcess(data: any): any {
  // Validar
  // Procesar
  // Loguear
  // Enviar
}
```

### Manejo de Errores
- Usar try-catch explícitamente
- Devolver errores descriptivos
- Loguear errors para debugging

```typescript
// ✅ Correcto
try {
  const result = await executeCommand(cmd);
  return result;
} catch (error) {
  logger.error(`Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  throw error;
}

// ❌ Incorrecto
try {
  const result = await executeCommand(cmd);
} catch (error) {
  // Sin manejo de error
}
```

## ✅ Checklist Pre-Commit

Antes de hacer commit, verifica:

- [ ] Código compila sin errores: `npm run build`
- [ ] Sin console.log(): usar `logger` centralizado
- [ ] Sin credenciales hardcodeadas
- [ ] Sin archivos .env commiteados
- [ ] Cambios están según los estándares TypeScript
- [ ] Funciones tienen tipos explícitos
- [ ] Mensaje de commit sigue formato semántico
- [ ] Commits son lógicos y atómicos

## 🔄 Pull Requests

### Plantilla de PR

```markdown
## 🎯 Objetivo
Descripción breve del cambio

## 📝 Detalles
Descripción detallada de qué y por qué se cambió

## ✅ Checklist
- [ ] Código sigue estándares del proyecto
- [ ] No hay console.log (usar logger)
- [ ] No hay credenciales expuestas
- [ ] Documentación actualizada
- [ ] Tests realizados (si aplica)
- [ ] PR vinculado a issue (si aplica)

## 📸 Screenshots (si aplica)
Agregar evidencia de cambios

## 🔗 Referencias
Closes #123
Related to #456
```

### Reglas para PR
- [ ] PR debe ser de develop a main (o a develop)
- [ ] Debe pasar todas las validaciones
- [ ] Debe ser aprobado por al menos 1 reviewer
- [ ] Título debe empezar con tipo: feat(), fix(), docs(), etc.

## 👥 Code Review

### Como Reviewer

#### Verifica
- ✅ Código sigue estándares
- ✅ No hay vulnerabilidades de seguridad
- ✅ Logic es correcta
- ✅ Performance es aceptable
- ✅ Documentación está actualizada

#### Aprueba con
```bash
# Si todo está bien
"Looks good to me! ✅"

# Si hay cambios menores
"Approved, consider: ..."

# Si hay cambios críticos
"Request changes"
```

### Como Autor Respondiendo Review

```bash
# Hacer cambios sugeridos
git add .
git commit -m "review: address feedback from code review"
git push origin feature/nombre

# Marcar como resuelto en GitHub y responder
"Done! Changed X according to your suggestion."
```

## 🧪 Testing (Futuro)

Cuando se implemente testing:

```bash
# Ejecutar tests
npm run test

# Tests con cobertura
npm run test:coverage

# Todos los tests deben pasar en PR
```

## 📚 Documentación

Al hacer cambios:

1. **Si cambias código**: Actualiza comentarios JSDoc
2. **Si cambias API**: Actualiza [`docs/api/ENDPOINTS.md`](../api/ENDPOINTS.md)
3. **Si cambias setup**: Actualiza [`docs/guides/CONFIGURATION.md`](../guides/CONFIGURATION.md)
4. **Si añades features**: Actualiza [`README.md`](../../README.md)

## 🚀 Merge a Producción

1. **PR aprobado** en develop → main
2. **Verificar tests** pasan
3. **Code review** completado
4. **Merge con --no-ff** para preservar historial
5. **Crear release tag**:
   ```bash
   git tag -a v1.1.0 -m "Release v1.1.0"
   git push origin v1.1.0
   ```

## 📞 Preguntas?

- Abre un issue en GitHub
- Revisa la [documentación](../)
- Consulta con el team

---

¡Gracias por contribuir! 🙏
