# Configuración Privada del Sistema

## 📋 Resumen

Se ha implementado un sistema seguro de configuración que:
- ✅ Almacena credenciales sensibles en `.env` (privado)
- ✅ Proporciona plantilla en `.env.example` (público)
- ✅ Previene commits accidentales con `.gitignore`
- ✅ Valida variables de entorno al iniciar
- ✅ Centraliza configuración en TypeScript

## 🔐 Archivos Clave

### 1. `.env` (Privado - Nunca Commitear)
Archivo con credenciales reales. **NUNCA debe ser commiteado**.

```bash
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
PORT=3000
LOG_LEVEL=info
SUDO_PASSWORD=tu-contraseña-de-sudo
ENABLE_PRIVILEGED_ENDPOINTS=true
MAX_COMMAND_TIMEOUT=300000
ALLOWED_SCRIPT_PATHS=/scripts,/usr/local/scripts
ALERT_EMAIL=admin@example.com
WEBHOOK_LOG_URL=https://webhook.site/xxx
```

### 2. `.env.example` (Público - Seguro Commitear)
Plantilla para nuevo setup. Segura para el repositorio.

```bash
API_TOKEN=your-secret-token-here
PORT=3000
LOG_LEVEL=info
SUDO_PASSWORD=your-sudo-password
ENABLE_PRIVILEGED_ENDPOINTS=true
MAX_COMMAND_TIMEOUT=300000
ALLOWED_SCRIPT_PATHS=/scripts
ALERT_EMAIL=admin@example.com
WEBHOOK_LOG_URL=https://webhook.site/xxx
```

### 3. `.gitignore` (Protección)
Previene que archivos sensibles sean commiteados.

```
.env
.env.local
.env.*.local
.env.production.local
node_modules/
dist/
build/
*.log
.DS_Store
.vscode/
.idea/
```

## 🔧 Sistema de Configuración

### Estructura en TypeScript
```typescript
// api/src/config/index.ts
export interface Config {
  api: {
    port: number;
    host: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  security: {
    apiToken: string;
    enablePrivilegedEndpoints: boolean;
    allowSudoCommands: boolean;
    sudoPassword: string;
  };
  commands: {
    maxTimeout: number;
    allowedScriptPaths: string[];
  };
  notifications: {
    alertEmail?: string;
    webhookLogUrl?: string;
  };
}
```

### Carga de Configuración
```typescript
import 'dotenv/config';

export function getConfig(): Config {
  validateEnv();  // Valida variables requeridas
  
  return {
    api: {
      port: parseInt(process.env.PORT || '3000', 10),
      host: '127.0.0.1',
      logLevel: process.env.LOG_LEVEL as any || 'info'
    },
    security: {
      apiToken: process.env.API_TOKEN || '',
      enablePrivilegedEndpoints: process.env.ENABLE_PRIVILEGED_ENDPOINTS === 'true',
      allowSudoCommands: process.env.ALLOW_SUDO_COMMANDS === 'true',
      sudoPassword: process.env.SUDO_PASSWORD || ''
    },
    // ... más campos
  };
}
```

## 🚀 Setup Inicial

### 1. Primera Instalación
```bash
cd api
npm install
cp .env.example .env
```

### 2. Generar Token Seguro
```bash
openssl rand -hex 32
```

### 3. Editar `.env`
```bash
nano .env
```

Copiar el token generado:
```bash
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### 4. Iniciar Servidor
```bash
npm run dev
```

## 📝 Validación de Variables

Al iniciar, el servidor verifica variables requeridas:

```
Validando variables de entorno:
  ✅ API_TOKEN
  ✅ PORT
```

Si falta alguna variable requerida:
```
❌ Variables de entorno requeridas no encontradas:
   - API_TOKEN
   - PORT

Copia .env.example a .env y configura los valores:
   cp api/.env.example api/.env
```

## 🔐 Seguridad de Credenciales

### Nunca Hacer
```bash
# ❌ NO: Exponer token en línea de comandos
export API_TOKEN=secret123
npm run dev

# ❌ NO: Commitear .env
git add .env
git commit -m "Add env file"

# ❌ NO: Loguear credenciales
console.log(`Token: ${config.security.apiToken}`);

# ❌ NO: Hardcodear en código
const API_TOKEN = "secret123";
```

### Siempre Hacer
```bash
# ✅ SI: Usar .env con .gitignore
cp .env.example .env
# Editar .env de forma privada
nano .env

# ✅ SI: Generar tokens seguros
openssl rand -hex 32

# ✅ SI: Usar variables de entorno
const token = process.env.API_TOKEN;

# ✅ SI: Proteger .env en .gitignore
echo ".env" >> .gitignore
git add .gitignore
```

## 📋 Variables de Entorno Completas

| Variable | Tipo | Requerida | Default | Ejemplo |
|----------|------|-----------|---------|---------|
| `API_TOKEN` | string | ✅ | - | `a1b2c3...` |
| `PORT` | number | ✅ | - | `3000` |
| `LOG_LEVEL` | enum | ❌ | `info` | `debug\|info\|warn\|error` |
| `SUDO_PASSWORD` | string | ❌ | - | `my-password` |
| `ENABLE_PRIVILEGED_ENDPOINTS` | boolean | ❌ | `true` | `true\|false` |
| `ALLOW_SUDO_COMMANDS` | boolean | ❌ | `true` | `true\|false` |
| `MAX_COMMAND_TIMEOUT` | number | ❌ | `30000` | `60000` |
| `ALLOWED_SCRIPT_PATHS` | string | ❌ | `/scripts` | `/scripts,/usr/local` |
| `ALERT_EMAIL` | string | ❌ | - | `admin@example.com` |
| `WEBHOOK_LOG_URL` | string | ❌ | - | `https://webhook.site/xxx` |

## 🔄 Rotación de Credenciales

### Cambiar Token
```bash
# 1. Generar nuevo token
openssl rand -hex 32

# 2. Actualizar .env
nano api/.env
# Copiar nuevo token en API_TOKEN

# 3. Reiniciar servidor
npm run dev
```

### Cambiar Contraseña Sudo
```bash
# 1. Actualizar .env
nano api/.env
SUDO_PASSWORD=nueva-contraseña

# 2. Reiniciar servidor
npm run dev
```

## 🌍 Diferentes Entornos

### Desarrollo
```bash
# api/.env.development
API_TOKEN=dev-token-123
LOG_LEVEL=debug
ENABLE_PRIVILEGED_ENDPOINTS=true
```

### Staging
```bash
# api/.env.staging
API_TOKEN=staging-token-456
LOG_LEVEL=info
ENABLE_PRIVILEGED_ENDPOINTS=true
```

### Producción
```bash
# api/.env.production
API_TOKEN=prod-token-789
LOG_LEVEL=warn
ENABLE_PRIVILEGED_ENDPOINTS=false
```

Cargar según entorno:
```bash
NODE_ENV=production npm start
```

## ✅ Checklist de Seguridad

- [ ] `.env.example` creado con valores dummy
- [ ] `.env` en `.gitignore`
- [ ] Token generado con `openssl rand -hex 32`
- [ ] `.env` nunca commiteado
- [ ] Validación de variables al iniciar
- [ ] Diferentes tokens por entorno
- [ ] Contraseña sudo en `.env` (no hardcoded)
- [ ] Logs no exponen credenciales
- [ ] Acceso a `.env` restringido (chmod 600)

## 🆘 Troubleshooting

**Error: "Variables de entorno requeridas no encontradas"**
```bash
# Solución
cp api/.env.example api/.env
nano api/.env
# Completar valores necesarios
```

**Error: "API token required"**
```bash
# Verificar que .env tiene API_TOKEN
grep API_TOKEN api/.env

# Verificar que está definido
cat api/.env
```

**Token expirado/comprometido**
```bash
# Generar nuevo
openssl rand -hex 32

# Actualizar
nano api/.env

# Reiniciar
npm run dev
```

## 📚 Relacionado

- Ver [`docs/guides/ENVIRONMENT.md`](ENVIRONMENT.md) para detalles de variables
- Ver [`docs/guides/AUTHENTICATION.md`](AUTHENTICATION.md) para uso de tokens
- Ver [`docs/setup/INSTALLATION.md`](../setup/INSTALLATION.md) para instalación completa
