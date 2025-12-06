# Sistema de Configuración Privada - Setup Completado ✅

## 📋 Resumen

Se ha implementado un sistema completo de configuración privada que:
- ✅ Almacena credenciales sensibles en `.env`
- ✅ Previene la subida al repositorio con `.gitignore`
- ✅ Proporciona plantilla con `.env.example`
- ✅ Valida variables de entorno al iniciar
- ✅ Carga configuración con `dotenv`

## 📁 Archivos Creados/Modificados

### 1. **`api/.env`** (Privado - Credenciales Reales)
Archivo con credenciales reales. **NUNCA debe ser commiteado**.

```bash
API_TOKEN=tu-token-secreto-aqui
PORT=3000
SUDO_PASSWORD=tu-contraseña-de-sudo-aqui
LOG_LEVEL=info
```

### 2. **`api/.env.example`** (Público - Plantilla)
Plantilla para configurar. Segura para commitear.

```bash
API_TOKEN=mi-token-secreto-123
PORT=3000
SUDO_PASSWORD=tu-contraseña-aqui
LOG_LEVEL=info
```

### 3. **`.gitignore`** (Protección)
Previene que `.env` sea commiteado accidentalmente.

```
.env
.env.local
.env.*.local
```

### 4. **`api/src/config/index.ts`** (Configuración)
Sistema de carga y validación de variables de entorno.

- Valida variables requeridas
- Proporciona tipos TypeScript
- Logger configurable
- Manejo centralizado

### 5. **`ENV_GUIDE.md`** (Documentación)
Guía completa sobre variables de entorno.

## 🚀 Uso Rápido

### Instalación Inicial
```bash
cd api
cp .env.example .env
nano .env  # Editar con credenciales reales
npm run dev
```

### Generar Token Seguro
```bash
openssl rand -hex 32
# Copiar la salida en API_TOKEN del .env
```

### Variables Disponibles

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `API_TOKEN` | Token para endpoints privilegiados | ✅ |
| `PORT` | Puerto de escucha (def: 3000) | ❌ |
| `SUDO_PASSWORD` | Contraseña sudo | ❌ |
| `LOG_LEVEL` | Nivel de logs (def: info) | ❌ |
| `ENABLE_PRIVILEGED_ENDPOINTS` | Habilitar endpoints privilegiados (def: true) | ❌ |
| `MAX_COMMAND_TIMEOUT` | Timeout máximo en ms (def: 300000) | ❌ |
| `ALLOWED_SCRIPT_PATHS` | Rutas permitidas para scripts | ❌ |
| `ALERT_EMAIL` | Email para alertas | ❌ |
| `WEBHOOK_LOG_URL` | URL para logging remoto | ❌ |

## 🔒 Seguridad

### ✅ Implementado
- Token generado con `dotenv`
- Credenciales en `.env` (ignorado por git)
- Plantilla `.env.example` sin credenciales
- Validación de variables requeridas al iniciar
- Logger configurable

### ✅ Buenas Prácticas
- `.env` no commitido (está en `.gitignore`)
- `.env.example` como plantilla pública
- Variables requeridas validadas al inicio
- Configuración centralizada y tipada

### 🛡️ Permisos Recomendados
```bash
chmod 600 api/.env        # Solo lectura para el propietario
chmod 644 api/.env.example # Lectura pública
```

## 📊 Ejemplo de Flujo

```bash
# 1. Clonar repositorio
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api

# 2. Ver plantilla
cat .env.example

# 3. Crear .env con credenciales reales
cp .env.example .env
nano .env
# Editar API_TOKEN, SUDO_PASSWORD, etc.

# 4. Proteger archivo
chmod 600 .env

# 5. Iniciar servidor (carga .env automáticamente)
npm run dev

# 6. Verificar configuración cargada
curl http://127.0.0.1:3000/health
```

## 🔑 Inicio de Sesión API

Con la configuración:

```bash
TOKEN="tu-token-secreto-aqui"
curl -X POST http://127.0.0.1:3000/api/privileged/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "whoami"}'
```

## ✅ Pruebas Realizadas

### Test 1: Validación de Variables
```
✅ .env se carga correctamente
✅ Variables requeridas se validan
✅ Valor de API_TOKEN se lee correctamente
```

### Test 2: Autenticación
```
❌ Sin token → 401 Unauthorized
❌ Token incorrecto → 401 Unauthorized
✅ Token correcto → 200 OK con comando ejecutado
```

### Test 3: Logging
```
✅ Logger configurable por LOG_LEVEL
✅ Mensajes incluyen timestamp
✅ Nivel debug/info/warn/error funciona
```

## 📝 Próximos Pasos

1. **Configura tu `.env`**
   ```bash
   cd api
   cp .env.example .env
   nano .env  # Editar con tus credenciales
   ```

2. **Genera un token seguro**
   ```bash
   openssl rand -hex 32
   ```

3. **Actualiza n8n con el token**
   - Crea variable: `VPS_ORCHESTRATOR_TOKEN`
   - Valor: tu token del `.env`

4. **Protege el archivo**
   ```bash
   chmod 600 api/.env
   ```

## 🐛 Solución de Problemas

### Error: "Variables de entorno requeridas no encontradas"
```bash
# Verificar .env existe
ls -la api/.env

# Copiar desde .env.example
cp api/.env.example api/.env

# Editar con credenciales
nano api/.env
```

### El token no funciona
- Verificar que `API_TOKEN` en `.env` está sin espacios
- Verificar que lo usas correctamente en el header: `Bearer <token>`
- Reiniciar el servidor después de cambiar `.env`

### Cambiar variables en tiempo real
- Editar `.env`
- Reiniciar el servidor con: `npm run dev`
- Las nuevas variables se cargarán automáticamente

## 📚 Archivos Relacionados

- `ENV_GUIDE.md` - Guía detallada de variables
- `AUTH.md` - Guía de autenticación y seguridad
- `README.md` - Documentación general
- `EXAMPLES.md` - Ejemplos de uso
- `.env.example` - Plantilla de configuración
- `.env` - Configuración privada (no commitear)

## 🎓 Conceptos Aprendidos

1. **dotenv**: Carga variables desde archivos `.env`
2. **.gitignore**: Previene subida de archivos sensibles
3. **Validación de configuración**: Asegura que app pueda arrancar
4. **Logger centralizado**: Control de niveles de logging
5. **Separación de secretos**: `.env` vs `.env.example`

---

**Estado:** ✅ Sistema completamente implementado y probado
**Fecha:** 2025-12-06
**Seguridad:** ✅ Implementada según mejores prácticas
