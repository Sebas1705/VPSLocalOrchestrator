# 🚀 Instalación Completa

Guía paso a paso para instalar y configurar VPS Local Orchestrator API.

## 📋 Requisitos Previos

- **Node.js** 18+ (recomendado 24.11.1)
- **npm** 9+
- **Git**
- Acceso a terminal/shell
- Opcional: **openssl** para generar tokens

Verificar versiones:
```bash
node --version   # v24.11.1+
npm --version    # 9+
git --version    # 2.30+
```

## 🔧 Instalación Paso a Paso

### Paso 1: Clonar Repositorio

```bash
# Clonar
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git

# Entrar en directorio
cd VPSLocalOrchestrator
```

### Paso 2: Instalar Dependencias

```bash
# Entrar en directorio de API
cd api

# Instalar dependencias
npm install
```

Esto instalará:
- Express.js 5.2.1
- TypeScript 5.9.3
- tsx (ejecutor TypeScript)
- dotenv (manejo de variables)
- y más...

### Paso 3: Configurar Variables de Entorno

```bash
# Copiar plantilla
cp .env.example .env

# Editar con tu editor favorito
nano .env   # o vi, vim, code, etc.
```

#### Generar Token Seguro

```bash
# Generar token aleatorio de 64 caracteres
openssl rand -hex 32
```

Resultado: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2`

#### Editar `.env`

```bash
nano api/.env
```

Contenido mínimo:
```bash
# Requerido: Token para endpoints privilegiados
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# Requerido: Puerto de escucha
PORT=3000

# Opcional: Nivel de logs (debug, info, warn, error)
LOG_LEVEL=info

# Opcional: Otros
SUDO_PASSWORD=tu-contraseña
ENABLE_PRIVILEGED_ENDPOINTS=true
```

Guardar y cerrar (Ctrl+X si usas nano).

### Paso 4: Verificar Configuración

```bash
# Verificar que .env fue creado
cat api/.env | head -5
```

Deberías ver algo como:
```
API_TOKEN=a1b2c3d4...
PORT=3000
LOG_LEVEL=info
```

## ▶️ Ejecutar la API

### Modo Desarrollo (Recomendado para empezar)

```bash
# Desde carpeta api/
npm run dev
```

Verás output como:
```
==================================================
🚀 VPS Local Orchestrator API
==================================================
📍 Server running at: http://127.0.0.1:3000
🔒 Access restricted to: localhost only
⏰ Started at: 2025-12-06T...
...
```

**Detener**: Presiona `Ctrl+C`

### Modo Producción

```bash
# Compilar TypeScript
npm run build

# Iniciar
npm start
```

Esto genera archivos optimizados en `dist/`.

## ✅ Verificar Instalación

### Test 1: Health Check

```bash
# Abrir otra terminal y ejecutar
curl http://127.0.0.1:3000/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "timestamp": "2025-12-06T10:30:00.000Z",
  "uptime": 5.23
}
```

### Test 2: Comando Simple

```bash
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "whoami"}'
```

Respuesta:
```json
{
  "success": true,
  "result": {
    "stdout": "your_username",
    "stderr": "",
    "exitCode": 0,
    "duration": 45
  }
}
```

### Test 3: Recursos del Sistema

```bash
curl http://127.0.0.1:3000/api/resources
```

Verás información de CPU, memoria, disco.

### Test 4: Con Token (Privilegiado)

```bash
# Reemplaza YOUR_TOKEN con el valor de .env
curl -X POST http://127.0.0.1:3000/api/privileged/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "date"}'
```

Si todo funciona, verás:
```json
{
  "success": true,
  "result": { ... }
}
```

Si falla token:
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Valid API token required..."
}
```

## 📦 Scripts npm Disponibles

```bash
npm run dev       # Desarrollo con reload automático
npm run build     # Compilar TypeScript → dist/
npm start         # Ejecutar versión compilada
npm run clean     # Limpiar directorios
npm run check     # Verificar TypeScript
```

## 🆘 Problemas Comunes

### Error: "Variables de entorno requeridas no encontradas"

**Problema**: Falta `.env`

**Solución**:
```bash
cp api/.env.example api/.env
# Editar y agregar API_TOKEN
```

### Error: "EADDRINUSE: address already in use :::3000"

**Problema**: Puerto 3000 está siendo usado

**Solución 1**: Liberar puerto
```bash
# Ver qué usa el puerto
lsof -i :3000

# Matar proceso (si es seguro)
kill -9 <PID>
```

**Solución 2**: Usar otro puerto
```bash
# Editar .env
echo "PORT=3001" >> api/.env

npm run dev
```

### Error: "command not found: npm"

**Problema**: npm no está instalado

**Solución**: Instalar Node.js desde [nodejs.org](https://nodejs.org/)

### Error: "403 Forbidden"

**Problema**: Intentas acceder desde IP externa

**Solución**: API solo funciona desde localhost (127.0.0.1)

Si necesitas acceso externo, ver [`docs/guides/CONFIGURATION.md`](../guides/CONFIGURATION.md)

### Error: "Token inválido"

**Problema**: Token en request no coincide con `.env`

**Solución**:
```bash
# Verificar token en .env
cat api/.env | grep API_TOKEN

# Usar ese token en Authorization header
Authorization: Bearer <valor-exacto>
```

## 🔒 Configuración de Seguridad

### 1. Generar Token Fuerte

```bash
# NO: Token débil ❌
API_TOKEN=123456

# SI: Token fuerte ✅
openssl rand -hex 32
```

### 2. Proteger .env

```bash
# Asegurar que .env está en .gitignore
grep "^\.env$" ../.gitignore
# Debe devolver: .env

# Cambiar permisos (solo lectura para owner)
chmod 600 api/.env
```

### 3. Cambiar Token por Entorno

```bash
# Desarrollo
API_TOKEN=dev-token-123...

# Staging
API_TOKEN=staging-token-456...

# Producción
API_TOKEN=prod-token-789...
```

## 🌍 Diferentes Entornos

### Desarrollo Local

```bash
# .env
PORT=3000
LOG_LEVEL=debug
ENABLE_PRIVILEGED_ENDPOINTS=true
```

```bash
npm run dev
```

### Staging Server

```bash
# .env
PORT=3000
LOG_LEVEL=info
ENABLE_PRIVILEGED_ENDPOINTS=true
ALERT_EMAIL=ops@example.com
```

```bash
npm run build
npm start
```

### Producción

```bash
# .env
PORT=3000
LOG_LEVEL=warn
ENABLE_PRIVILEGED_ENDPOINTS=false
ALLOW_SUDO_COMMANDS=false
```

```bash
# Usando systemd (recomendado)
# Ver documentación de deploy
npm run build
npm start
```

## 📊 Verificar Estado

Después de instalar, ejecutar:

```bash
# Verificar compilación
npm run check

# Listar archivos de configuración
ls -la api/.env*

# Ver procesos node
ps aux | grep node

# Verificar puerto
lsof -i :3000
```

## 🎯 Próximos Pasos

1. **Verificar que funciona**: Sigue tests arriba ✅
2. **Leer documentación**: Ver [`docs/README.md`](../README.md)
3. **Configurar completamente**: [`docs/guides/CONFIGURATION.md`](../guides/CONFIGURATION.md)
4. **Aprender endpoints**: [`docs/api/ENDPOINTS.md`](../api/ENDPOINTS.md)
5. **Integrar con n8n**: [`docs/examples/N8N.md`](../examples/N8N.md)

## ✅ Checklist de Instalación

- [ ] Node.js 18+ instalado
- [ ] Repositorio clonado
- [ ] Dependencias instaladas (`npm install`)
- [ ] `.env` creado con `API_TOKEN`
- [ ] Token generado con `openssl rand -hex 32`
- [ ] API ejecutándose (`npm run dev`)
- [ ] Health check funciona (`curl /health`)
- [ ] Comando simple ejecuta (`curl /api/command/execute`)
- [ ] Token privilegiado funciona
- [ ] `.env` está en `.gitignore`
- [ ] Documentación leída

---

¡Instalación completada! 🎉 Ahora revisa [`docs/examples/CURL.md`](../examples/CURL.md) para ver ejemplos prácticos.
