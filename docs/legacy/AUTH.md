# Autenticación con Token para Operaciones Privilegiadas

## 🔐 Sistema de Seguridad

La API incluye endpoints privilegiados que requieren autenticación mediante token para ejecutarse. Esto añade una capa adicional de seguridad para comandos sensibles.

## 🔑 Configuración del Token

### Token Automático
Al iniciar el servidor sin configuración, se genera un token aleatorio seguro:

```bash
npm run dev
```

El token se muestra en la consola:
```
🔑 API Token for privileged operations:
   51b16db5aabb4817db076b783ee6b7dfa4d4d98f803f9b55aa0919ed9e22b9c2
```

### Token Personalizado
Puedes configurar tu propio token usando la variable de entorno `API_TOKEN`:

```bash
API_TOKEN="mi-token-secreto-123" npm run dev
```

O crear un archivo `.env`:
```bash
API_TOKEN=mi-token-secreto-personalizado
PORT=3000
```

## 📡 Endpoints Privilegiados

### 1. Ejecutar Comando Privilegiado

```bash
POST /api/privileged/execute
```

**Headers requeridos:**
```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**
```json
{
  "command": "/path/to/script.sh",
  "timeout": 30000,
  "cwd": "/optional/working/directory"
}
```

**Ejemplo:**
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mi-token-secreto-123" \
  -d '{
    "command": "/home/user/scripts/restart-service.sh"
  }'
```

### 2. Ejecutar Comandos en Lote (Privilegiado)

```bash
POST /api/privileged/batch
```

**Ejemplo:**
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mi-token-secreto-123" \
  -d '{
    "commands": [
      "systemctl status nginx",
      "df -h",
      "free -m"
    ]
  }'
```

### 3. Gestionar Servicios Systemd

```bash
POST /api/privileged/service
```

**Acciones disponibles:** `start`, `stop`, `restart`, `status`, `enable`, `disable`

**Ejemplo:**
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/service \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mi-token-secreto-123" \
  -d '{
    "service": "nginx",
    "action": "restart"
  }'
```

## 🛡️ Seguridad

### Comparación Segura de Tokens
El sistema usa `crypto.timingSafeEqual()` para prevenir timing attacks.

### Comandos Privilegiados Detectados
La API identifica automáticamente comandos que típicamente requieren privilegios:
- `sudo`
- `systemctl`
- `rm -rf`
- `shutdown` / `reboot`
- `chmod` / `chown`
- `kill -9` / `pkill`
- y más...

## ⚠️ Respuestas de Error

### Sin Token (401 Unauthorized)
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Valid API token required for privileged operations"
}
```

### Token Inválido (401 Unauthorized)
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Valid API token required for privileged operations"
}
```

## 📝 Scripts de Ejemplo

### Script: system-check.sh
Script de verificación del sistema sin necesidad de sudo:

```bash
/home/sebss/apps/VPSLocalOrchestrator/scripts/system-check.sh
```

Características:
- ✅ Top 5 procesos por CPU
- ✅ Uso de memoria
- ✅ Uso de disco
- ✅ Servicios escuchando en puertos web

**Uso con API:**
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "command": "/home/sebss/apps/VPSLocalOrchestrator/scripts/system-check.sh"
  }'
```

### Script: restart-nginx.sh
Script para reiniciar nginx (requiere configuración sudoers):

```bash
/home/sebss/apps/VPSLocalOrchestrator/scripts/restart-nginx.sh
```

## 🔧 Configuración Sudoers (Opcional)

Para ejecutar comandos privilegiados sin contraseña, configura sudoers:

```bash
sudo visudo
```

Añade al final:
```
# Permitir comandos específicos sin contraseña
username ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx
username ALL=(ALL) NOPASSWD: /usr/bin/systemctl status nginx
username ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop nginx
username ALL=(ALL) NOPASSWD: /usr/bin/systemctl start nginx
```

O para scripts específicos:
```
username ALL=(ALL) NOPASSWD: /home/username/scripts/restart-nginx.sh
```

## 🔌 Integración con n8n

### Guardar Token en n8n
1. Ve a **Settings** > **Variables**
2. Crea una variable: `VPS_ORCHESTRATOR_TOKEN`
3. Valor: `mi-token-secreto-123`

### Nodo HTTP Request con Autenticación

**Configuración:**
```json
{
  "method": "POST",
  "url": "http://127.0.0.1:3000/api/privileged/execute",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "headers": {
    "Authorization": "Bearer {{$env.VPS_ORCHESTRATOR_TOKEN}}"
  },
  "body": {
    "command": "/path/to/script.sh"
  }
}
```

O en el cuerpo JSON del nodo:
```json
{
  "url": "http://127.0.0.1:3000/api/privileged/execute",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer {{ $env.VPS_ORCHESTRATOR_TOKEN }}",
    "Content-Type": "application/json"
  },
  "body": {
    "command": "/home/user/scripts/system-check.sh"
  }
}
```

## 📊 Ejemplo Completo: Workflow de Mantenimiento

```bash
# 1. Verificar estado del sistema
curl -X POST http://127.0.0.1:3000/api/privileged/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "/scripts/system-check.sh"}'

# 2. Si el disco está > 80%, limpiar archivos temporales
curl -X POST http://127.0.0.1:3000/api/privileged/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "find /tmp -type f -mtime +7 -delete"}'

# 3. Reiniciar servicio si es necesario
curl -X POST http://127.0.0.1:3000/api/privileged/service \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service": "myapp", "action": "restart"}'
```

## 🎯 Best Practices

1. **Nunca compartas el token en código o repositorios**
   - Usa variables de entorno
   - Guarda el token en un gestor de secretos

2. **Rota el token regularmente**
   - Genera nuevos tokens periódicamente
   - Reinicia la API con el nuevo token

3. **Usa scripts dedicados**
   - Crea scripts específicos para tareas comunes
   - Evita ejecutar comandos complejos directamente

4. **Monitorea el uso**
   - Revisa los logs de operaciones privilegiadas
   - Alerta sobre usos sospechosos

5. **Principio de mínimos privilegios**
   - Solo otorga los permisos necesarios en sudoers
   - Limita las acciones que los scripts pueden realizar

## 📝 Logs

Las operaciones privilegiadas se registran con el prefijo `[PRIVILEGED]`:

```
[2025-12-06T18:09:17.629Z] POST /api/privileged/execute - 127.0.0.1
[PRIVILEGED] Executing: /home/user/scripts/system-check.sh
```

## 🚨 Troubleshooting

### Error: "sudo: a password is required"
- Configura sudoers para comandos sin contraseña
- O usa scripts que no requieran sudo

### Error: "permission denied"
- Verifica que el script tenga permisos de ejecución: `chmod +x script.sh`
- Verifica que el usuario pueda ejecutar el comando

### Token no funciona
- Verifica que el token sea exactamente el mostrado al iniciar
- Asegúrate de usar `Bearer` en el header de Authorization
- El token se regenera cada vez que inicias el servidor (a menos que uses API_TOKEN)
