# Guía Completa de Variables de Entorno

## 📋 Todas las Variables Disponibles

### Requeridas ⚠️

#### `API_TOKEN`
Token Bearer para endpoints privilegiados.

```bash
# Generar token seguro (64 caracteres)
openssl rand -hex 32

# Copiar en .env
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Validación**:
- Mínimo 32 caracteres
- No puede estar vacío
- Se valida con timing-safe comparison

#### `PORT`
Puerto en el que escucha la API.

```bash
# Default (si no se especifica)
PORT=3000

# Otro puerto
PORT=5000
```

**Validación**:
- Debe ser número entre 1 y 65535
- Si no disponible, el servidor fallará

### Opcionales 📌

#### `LOG_LEVEL`
Nivel de logs en la consola.

```bash
# Opciones
LOG_LEVEL=debug    # Muestra todo (desarrollo)
LOG_LEVEL=info     # Info, warn, error (default)
LOG_LEVEL=warn     # Warn, error
LOG_LEVEL=error    # Solo errores (producción)
```

**Valores**:
```
debug > info > warn > error
```

#### `SUDO_PASSWORD`
Contraseña de sudo para comandos privilegiados.

```bash
SUDO_PASSWORD=my-super-secure-password
```

**Nota**: Es mejor usar sudoers sin contraseña si es posible.

#### `ENABLE_PRIVILEGED_ENDPOINTS`
Habilitar/deshabilitar endpoints privilegiados.

```bash
# Habilitar (default)
ENABLE_PRIVILEGED_ENDPOINTS=true

# Deshabilitar (no expone /api/privileged/*)
ENABLE_PRIVILEGED_ENDPOINTS=false
```

#### `ALLOW_SUDO_COMMANDS`
Permitir/bloquear comandos con sudo.

```bash
# Permitir sudo
ALLOW_SUDO_COMMANDS=true

# Bloquear sudo (más seguro)
ALLOW_SUDO_COMMANDS=false
```

#### `MAX_COMMAND_TIMEOUT`
Timeout máximo para comandos (en milisegundos).

```bash
# 30 segundos (default)
MAX_COMMAND_TIMEOUT=30000

# 5 minutos
MAX_COMMAND_TIMEOUT=300000

# 10 minutos
MAX_COMMAND_TIMEOUT=600000
```

#### `ALLOWED_SCRIPT_PATHS`
Rutas permitidas para ejecutar scripts.

```bash
# Una ruta
ALLOWED_SCRIPT_PATHS=/scripts

# Múltiples rutas (separadas por coma)
ALLOWED_SCRIPT_PATHS=/scripts,/usr/local/scripts,/app/scripts

# Todas las rutas (no recomendado)
ALLOWED_SCRIPT_PATHS=/
```

#### `ALERT_EMAIL`
Email para alertas del sistema.

```bash
ALERT_EMAIL=admin@example.com
```

#### `WEBHOOK_LOG_URL`
URL webhook para enviar logs.

```bash
WEBHOOK_LOG_URL=https://webhook.site/xxx-yyy-zzz
```

#### `NODE_ENV`
Ambiente de ejecución.

```bash
NODE_ENV=development   # Desarrollo (más verbose)
NODE_ENV=staging       # Staging
NODE_ENV=production    # Producción (menos verbose)
```

## 🔧 Archivo `.env` Completo

### Desarrollo
```bash
# Tokens
API_TOKEN=dev-token-1234567890abcdef1234567890abcdef12345678

# Servidor
PORT=3000
LOG_LEVEL=debug
NODE_ENV=development

# Seguridad
ENABLE_PRIVILEGED_ENDPOINTS=true
ALLOW_SUDO_COMMANDS=true
SUDO_PASSWORD=dev-password

# Comandos
MAX_COMMAND_TIMEOUT=30000
ALLOWED_SCRIPT_PATHS=/scripts,./api/scripts

# Notificaciones
ALERT_EMAIL=dev@example.com
WEBHOOK_LOG_URL=https://webhook.site/test
```

### Staging
```bash
# Tokens
API_TOKEN=staging-token-abcdef1234567890abcdef1234567890abcdef12

# Servidor
PORT=3000
LOG_LEVEL=info
NODE_ENV=staging

# Seguridad
ENABLE_PRIVILEGED_ENDPOINTS=true
ALLOW_SUDO_COMMANDS=true
SUDO_PASSWORD=staging-password

# Comandos
MAX_COMMAND_TIMEOUT=60000
ALLOWED_SCRIPT_PATHS=/scripts

# Notificaciones
ALERT_EMAIL=ops@example.com
WEBHOOK_LOG_URL=https://webhook.site/staging
```

### Producción
```bash
# Tokens
API_TOKEN=prod-token-1234567890abcdef1234567890abcdef123456

# Servidor
PORT=3000
LOG_LEVEL=warn
NODE_ENV=production

# Seguridad
ENABLE_PRIVILEGED_ENDPOINTS=false
ALLOW_SUDO_COMMANDS=false
SUDO_PASSWORD=

# Comandos
MAX_COMMAND_TIMEOUT=300000
ALLOWED_SCRIPT_PATHS=/scripts

# Notificaciones
ALERT_EMAIL=alerts@example.com
WEBHOOK_LOG_URL=https://webhook.site/prod
```

## 🔐 Validación de Variables

El servidor valida al iniciar:

```bash
npm run dev
```

Salida:
```
Validando variables de entorno:
✅ API_TOKEN presente
✅ PORT presente

🔑 API Configuration loaded:
   - API Token: a1b2c3d4...
   - Privileged endpoints: ✅ Enabled
   - Sudo commands: ✅ Allowed
   - Log level: DEBUG
```

Si falta algo requerido:
```
❌ Variables de entorno requeridas no encontradas:
   - API_TOKEN
   - PORT

Copia .env.example a .env y configura los valores:
   cp api/.env.example api/.env
```

## 📊 Tabla de Referencia Rápida

| Variable | Tipo | Requerida | Default | Rango |
|----------|------|-----------|---------|-------|
| `API_TOKEN` | string | ✅ | - | 32-128 chars |
| `PORT` | number | ✅ | - | 1-65535 |
| `LOG_LEVEL` | enum | ❌ | `info` | debug\|info\|warn\|error |
| `NODE_ENV` | enum | ❌ | `development` | dev\|staging\|prod |
| `SUDO_PASSWORD` | string | ❌ | - | any |
| `ENABLE_PRIVILEGED_ENDPOINTS` | boolean | ❌ | `true` | true\|false |
| `ALLOW_SUDO_COMMANDS` | boolean | ❌ | `true` | true\|false |
| `MAX_COMMAND_TIMEOUT` | number | ❌ | `30000` | 1000-3600000 |
| `ALLOWED_SCRIPT_PATHS` | string | ❌ | `/scripts` | paths CSV |
| `ALERT_EMAIL` | string | ❌ | - | valid email |
| `WEBHOOK_LOG_URL` | string | ❌ | - | valid URL |

## 🆘 Troubleshooting

### "Variable `API_TOKEN` no encontrada"
```bash
# Solución
cat api/.env | grep API_TOKEN

# Si no existe
openssl rand -hex 32  # Generar
echo "API_TOKEN=<pegar-aquí>" >> api/.env
```

### "PORT already in use"
```bash
# Ver qué proceso usa el puerto
lsof -i :3000

# Cambiar puerto en .env
echo "PORT=3001" >> api/.env
```

### "LOG_LEVEL no reconocido"
```bash
# Valores válidos: debug, info, warn, error
LOG_LEVEL=debug    # Correcto ✅
LOG_LEVEL=verbose  # Incorrecto ❌
```

### Las variables no se cargan
```bash
# Reiniciar servidor
npm run dev

# Verificar que .env está en la carpeta correcta
ls -la api/.env

# Limpieza
rm -rf node_modules/.cache
npm run dev
```

## 🔒 Mejores Prácticas

### ✅ Hacer
```bash
# Usar variables requeridas
API_TOKEN=$(openssl rand -hex 32)
echo "API_TOKEN=$API_TOKEN" > api/.env

# Usar diferentes valores por entorno
NODE_ENV=production npm start

# Rotar tokens regularmente
openssl rand -hex 32  # cada 3-6 meses

# Documentar todas las variables
# Ver .env.example
```

### ❌ No Hacer
```bash
# No loguear credenciales
console.log(process.env.API_TOKEN)  # ❌

# No hardcodear en código
const API_TOKEN = "secret123"  # ❌

# No commitear .env
git add api/.env  # ❌

# No reusar tokens
API_TOKEN=same-token-everywhere  # ❌
```

## 📚 Relacionado

- [`docs/guides/CONFIGURATION.md`](CONFIGURATION.md) - Sistema de configuración
- [`docs/guides/AUTHENTICATION.md`](AUTHENTICATION.md) - Autenticación con token
- [`docs/setup/INSTALLATION.md`](../setup/INSTALLATION.md) - Instalación
