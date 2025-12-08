# 🤖 AGENTS.md - Guía de Desarrollo y Estructura del Proyecto

## 🌐 Language Policy

All documentation, code comments, and project communication **must be in English**. Any new or updated documentation must be written in English. If any document is found in another language, it must be translated to English immediately.

## 🔒 AI Model Data Protection Policy

**CRITICAL**: This project contains proprietary code and sensitive infrastructure details. All AI assistants and code generation tools **MUST** comply with the following rules:

### Data Sharing Restrictions
1. **No External Training**: Project code, configurations, and documentation must NOT be used to train external AI models
2. **Local Processing Only**: When possible, use local AI models (Ollama, LM Studio) instead of cloud APIs
3. **API Data Policies**: 
   - For OpenAI: Enable organization-level data opt-out
   - For Anthropic: Use enterprise API (no training by default)
   - For GitHub Copilot: Enable business/enterprise mode with data protection

### Sensitive File Protection
Never share or process these files with external AI services:
- `.env`, `.env.*` - Environment variables and secrets
- `*.key`, `*.pem` - Cryptographic keys
- `*.db`, `*.sqlite` - Database files
- `logs/*.log` - Application logs
- `config/production.*` - Production configurations
- Any file containing API tokens, passwords, or credentials

### Compliance Requirements
- **Review Before Commit**: Always review AI-generated code before committing
- **Sanitize Examples**: Remove real tokens, IPs, and credentials from code examples
- **Audit Trail**: Log all AI interactions that process project files
- **Team Awareness**: All team members must be trained on these policies

### Enforcement
Violations of this policy may result in:
- Immediate revocation of AI tool access
- Security audit of affected code
- Potential data breach disclosure requirements

## 📋 Reglas de Versionado

### Versionado por Funcionalidad
Cada vez que se implemente **una funcionalidad concreta** (con su lógica, endpoint y test de endpoint), la versión debe aumentar en **minor**:

- **Ejemplo**: `v1.0.0` → `v1.0.1` → `v1.0.2` → `v1.0.3` → ...

### Versionado por Fase Completada
Cuando se **completen todas las funcionalidades de una fase**, la versión cambiará a la indicada en `FEATURE_ROADMAP.md`:

- **Fase 1 completada**: `v1.0.x` → `v1.2.0`
- **Fase 2 completada**: `v1.2.x` → `v1.3.0`
- **Fase 3 completada**: `v1.3.x` → `v2.0.0`
- **Fase 4+**: Según roadmap

### Proceso de Actualización de Versión

1. **En `api/package.json`**: Actualizar `"version"`
2. **En `api/src/index.ts`**: Actualizar versión en endpoint GET `/`
3. **Commit**: `git commit -m "bump: version X.X.X - <descripción>"`
4. **Crear rama release**: `git checkout -b release/vX.X.X`
5. **Tag**: `git tag -a vX.X.X -m "Release vX.X.X"`
6. **Push rama y tag**: `git push -u origin release/vX.X.X && git push origin vX.X.X`
7. **Volver a develop**: `git checkout develop && git merge release/vX.X.X`
8. **Push develop**: `git push origin develop`

---

## 📁 Estructura del Proyecto

### Raíz del Repositorio
```
VPSLocalOrchestrator/
├── README.md                           # Documentación principal
├── .gitignore                          # Configuración de git
├── vps-orchestrator.service            # Configuración de systemd
└── api/                                # Carpeta principal de la API
```

### Carpeta `/api`
```
api/
├── package.json                        # Dependencias y scripts
├── tsconfig.json                       # Configuración de TypeScript
├── .env                                # Variables de entorno (NO en git)
├── .env.example → docs/examples/.env.example (movido)
│
├── src/                                # Código fuente TypeScript
│   ├── index.ts                        # Punto de entrada de la API
│   ├── globals.ts                      # Utilidades globales
│   │
│   ├── config/
│   │   └── index.ts                    # Configuración y Logger
│   │
│   ├── middleware/
│   │   ├── auth.ts                     # Utilidades de autenticación
│   │   ├── requireAuth.ts              # Middleware de protección (NEW)
│   │   └── security.ts                 # Middleware de seguridad
│   │
│   ├── routes/
│   │   ├── command.routes.ts           # POST /api/command/* (requiere auth)
│   │   ├── privileged.routes.ts        # POST /api/privileged/* (requiere auth)
│   │   └── resources.routes.ts         # GET /api/resources/* (público)
│   │
│   └── services/
│       ├── commandExecutor.ts          # Ejecución de comandos
│       └── resourceMonitor.ts          # Monitoreo de recursos
│
└── dist/                               # Código compilado (generado por build)
    ├── index.js
    ├── config/
    ├── middleware/
    ├── routes/
    └── services/
```

### Carpeta `/docs`
```
docs/
├── INDEX.md                            # Índice de documentación
├── FEATURE_ROADMAP.md                  # Roadmap de funcionalidades (ESTE ARCHIVO)
├── ARCHITECTURE.md                     # Arquitectura del proyecto
├── API.md                              # Documentación de endpoints
│
└── examples/
    ├── .env.example                    # Ejemplo de configuración
    ├── n8n-examples.json               # Ejemplos de n8n
    └── n8n-workflow-monitor.json       # Workflow monitor de n8n
```

---

## 🔐 Seguridad y Autenticación

### Reglas Actuales
1. **Todos los endpoints de comando REQUIEREN autenticación**
   - `POST /api/command/execute` - ✅ Requiere token
   - `POST /api/command/batch` - ✅ Requiere token
   - `POST /api/privileged/*` - ✅ Requiere token

2. **Endpoints públicos (sin autenticación requerida)**
   - `GET /health` - Sin autenticación
   - `GET /api/resources` - Sin autenticación
   - `GET /api/resources/processes` - Sin autenticación
   - `DELETE /api/resources/process/:pid` - Sin autenticación

3. **Token**
   - Desde: `Authorization: Bearer <token>`
   - Validación: `timingSafeEqual` (contra timing attacks)
   - Configuración: Variable `API_TOKEN` en `.env`

---

## 🚀 Scripts de Build y Ejecución

### Comandos Principales
```bash
# Compilar TypeScript a dist/
npm run build

# Ejecutar servidor compilado
cd dist && node index.js

# Systemd (requiere sudo)
sudo systemctl start vps-orchestrator
sudo systemctl status vps-orchestrator
sudo systemctl restart vps-orchestrator
sudo journalctl -u vps-orchestrator -f
```

---

## 📝 Checklist para Nueva Funcionalidad

Cuando implementes una nueva funcionalidad en Fase 1 o posterior, asegúrate de:

- [ ] **Crear el servicio** (`api/src/services/<feature>.ts`)
- [ ] **Crear/actualizar rutas** (`api/src/routes/<feature>.routes.ts`)
- [ ] **Aplicar middleware de autenticación** si es endpoint de comando
- [ ] **Implementar validación** de inputs
- [ ] **Compilar**: `npm run build`
- [ ] **Probar endpoints** con curl/Postman
- [ ] **Registrar logs** si aplica
- [ ] **Actualizar documentación** en `/docs`
- [ ] **Aumentar versión** en `package.json` (minor bump)
- [ ] **Hacer commit** con mensaje descriptivo
- [ ] **Crear tag** `vX.X.X`

---

## 🎯 Endpoints Actuales

### Health & Status
```
GET /health                              # Status del servidor
GET /                                    # Información de la API
```

### Command Execution (Requiere Auth)
```
POST /api/command/execute                # Ejecutar un comando
POST /api/command/batch                  # Ejecutar múltiples comandos
```

### Privileged Commands (Requiere Auth)
```
POST /api/privileged/execute             # Comando privilegiado
POST /api/privileged/batch               # Múltiples comandos privilegiados
POST /api/privileged/service             # Gestión de servicios
```

### Resources (Público)
```
GET /api/resources                       # CPU, memoria, disco, uptime
GET /api/resources/processes             # Lista de procesos (top 10)
DELETE /api/resources/process/:pid       # Terminar proceso
```

---

## 📊 Fase 1 - Funcionalidades a Implementar

**Destino: v1.2.0**

1. **Network Monitoring** → v1.0.1
   - GET /api/resources/network

2. **Enhanced Service Status** → v1.0.2
   - GET /api/services/:name/health

3. **Basic Audit Logging** → v1.0.3
   - GET /api/logs
   - POST /api/logs/search

4. **Process Priority Control** → v1.0.4
   - POST /api/processes/set-priority/:pid

**Final**: v1.0.4 → v1.2.0

---

## ⚠️ Notas Importantes

- **TypeScript**: Usar `import type` para tipos cuando `verbatimModuleSyntax` esté activo
- **Compilación**: Siempre compilar con `npm run build` antes de probar
- **Testing**: Probar endpoints con token válido (`Bearer tu-token-secreto-aqui`)
- **Logs**: Usar console.log para debugging, Logger para producción
- **Git**: Mantener `develop` como rama principal de desarrollo
- **Systemd**: El servicio ejecuta desde `api/dist/` con `.env`

---

**Última actualización**: 2025-12-08  
**Versión actual**: v7.5.0 (42 features, 8 phases complete)
