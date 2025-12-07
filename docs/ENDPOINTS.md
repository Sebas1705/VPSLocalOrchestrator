# 📡 Documentación de Endpoints

Guía completa de todos los endpoints disponibles en la VPS Local Orchestrator API.

**Versión actual**: v3.2.0

---

## 🔐 Autenticación

Todos los endpoints de **comando** requieren un token Bearer en el header:

```bash
Authorization: Bearer tu-token-secreto-aqui
```

**Endpoints públicos** (sin autenticación):
- `GET /health`
- `GET /`
- `GET /api/resources`
- `GET /api/resources/processes`
- `GET /api/resources/network`
- `POST /api/resources/process/:pid/priority`
- `DELETE /api/resources/process/:pid`

---

## 📋 Health & Status

### GET /health
Verifica el estado de salud de la API.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-06T22:02:49.890Z"
}
```

**Status Code**: 200

---

### GET /
Información general de la API.

**Response**:
```json
{
  "name": "VPS Local Orchestrator API",
  "version": "1.0.1",
  "description": "API para orquestar recursos y ejecutar comandos localmente",
  "endpoints": {
    "health": "GET /health",
    "executeCommand": "POST /api/command/execute",
    "batchCommands": "POST /api/command/batch",
    "serviceManagement": "POST /api/command/service",
    "systemResources": "GET /api/resources",
    "processes": "GET /api/resources/processes",
    "networkStats": "GET /api/resources/network",
    "processPriority": "POST /api/resources/process/:pid/priority",
    "killProcess": "DELETE /api/resources/process/:pid"
  }
}
```

**Status Code**: 200

---

## 🎮 Ejecución de Comandos

### POST /api/command/execute
Ejecuta un comando individual. **Requiere autenticación**.

**Request**:
```json
{
  "command": "ls -la /home"
}
```

**Response**:
```json
{
  "success": true,
  "stdout": "total 24\ndrwxr-xr-x ...",
  "stderr": "",
  "exitCode": 0
}
```

**Status Codes**:
- `200`: Comando ejecutado exitosamente
- `401`: Token inválido o no proporcionado
- `400`: Comando vacío
- `500`: Error al ejecutar comando

---

### POST /api/command/batch
Ejecuta múltiples comandos en secuencia. **Requiere autenticación**.

**Request**:
```json
{
  "commands": [
    "pwd",
    "whoami",
    "uname -a"
  ]
}
```

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "command": "pwd",
      "stdout": "/home/sebss\n",
      "stderr": "",
      "exitCode": 0
    },
    {
      "command": "whoami",
      "stdout": "sebss\n",
      "stderr": "",
      "exitCode": 0
    },
    {
      "command": "uname -a",
      "stdout": "Linux amksandbox 5.15.0-1234 ...",
      "stderr": "",
      "exitCode": 0
    }
  ]
}
```

**Status Codes**:
- `200`: Todos los comandos ejecutados
- `401`: Token inválido o no proporcionado
- `400`: Array de comandos vacío

---

### POST /api/command/service
Gestiona servicios systemd (start, stop, restart, status, enable, disable). **Requiere autenticación**.

> Nota: usa `sudo -n` y fallará con 403 si sudo requiere contraseña. Configure sudoers para passwordless si necesita usarlo sin prompt.

**Request**:
```json
{
  "service": "nginx",
  "action": "status"
}
```

**Acciones disponibles**: `start`, `stop`, `restart`, `status`, `enable`, `disable`

**Response** (ejemplo):
```json
{
  "success": true,
  "service": "nginx",
  "action": "status",
  "result": {
    "stdout": "● nginx.service - A high performance web server and a reverse proxy server\n   Loaded: loaded (/lib/systemd/system/nginx.service; enabled; vendor preset: enabled)\n   Active: active (running)...",
    "stderr": "",
    "exitCode": 0,
    "duration": 120
  }
}
```

**Status Codes**:
- `200`: Operación ejecutada
- `401`: Token inválido o no proporcionado
- `403`: Sudo no permitido o requiere password (ver stderr)
- `400`: Parámetros inválidos
- `500`: Error al ejecutar el comando

---

## 📊 Monitoreo de Recursos

### GET /api/resources
Obtiene estadísticas de CPU, memoria, disco y uptime.

**Response**:
```json
{
  "success": true,
  "data": {
    "cpu": {
      "cores": 4,
      "loadavg": [0.45, 0.32, 0.28],
      "usage_percent": 12.5
    },
    "memory": {
      "total": 8589934592,
      "used": 4294967296,
      "free": 4294967296,
      "usage_percent": 50.0
    },
    "disk": [
      {
        "filesystem": "/dev/sda1",
        "size": 107374182400,
        "used": 53687091200,
        "available": 53687091200,
        "use_percent": 50,
        "mount": "/"
      }
    ],
    "uptime": 86400,
    "timestamp": "2025-12-06T22:02:49.890Z"
  }
}
```

**Status Code**: 200

---

### GET /api/resources/processes
Obtiene los procesos que más CPU consumen.

**Query Parameters**:
- `limit` (opcional, default: 10): Número de procesos a devolver

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "pid": 1234,
      "name": "node",
      "user": "sebss",
      "cpu_percent": 25.5,
      "memory_percent": 15.3,
      "rss_mb": 128,
      "command": "node /app/index.js"
    },
    {
      "pid": 5678,
      "name": "python3",
      "user": "sebss",
      "cpu_percent": 10.2,
      "memory_percent": 8.5,
      "rss_mb": 64,
      "command": "python3 /app/script.py"
    }
  ]
}
```

**Status Code**: 200

---

### GET /api/resources/network
Obtiene estadísticas de interfaces de red y conexiones. **NEW en v1.0.1**

**Response**:
```json
{
  "success": true,
  "data": {
    "interfaces": [
      {
        "name": "eth0",
        "ipv4": "192.168.1.100",
        "ipv6": "2001:db8::1",
        "bytesIn": 1048576,
        "bytesOut": 2097152,
        "packetsIn": 1024,
        "packetsOut": 2048,
        "errors": 0,
        "dropped": 0
      },
      {
        "name": "lo",
        "bytesIn": 0,
        "bytesOut": 0,
        "packetsIn": 0,
        "packetsOut": 0,
        "errors": 0,
        "dropped": 0
      }
    ],
    "connections": {
      "established": 15,
      "timeWait": 2,
      "listening": 8,
      "other": 5
    },
    "timestamp": "2025-12-06T22:02:49.890Z"
  }
}
```

**Status Code**: 200

---

### POST /api/resources/process/:pid/priority
Cambia la prioridad (nice value) de un proceso. **Requiere ser dueño del proceso o tener permisos sudo**.

**URL Parameters**:
- `pid` (requerido): Process ID

**Request**:
```json
{
  "priority": 5
}
```

**Priority range**: `-20` (máxima prioridad) a `19` (mínima prioridad). Valores negativos requieren sudo.

**Response**:
```json
{
  "success": true,
  "message": "Process 3877173 priority changed to 5",
  "currentPriority": 5
}
```

**Status Codes**:
- `200`: Prioridad cambiada exitosamente
- `400`: PID inválido, prioridad fuera de rango, o proceso no encontrado
- `500`: Error al cambiar prioridad

**Ejemplos**:
```bash
# Bajar prioridad (proceso usará menos CPU)
curl -X POST http://localhost:3000/api/resources/process/1234/priority \
  -H "Content-Type: application/json" \
  -d '{"priority": 10}'

# Aumentar prioridad (requiere sudo si < 0)
curl -X POST http://localhost:3000/api/resources/process/1234/priority \
  -H "Content-Type: application/json" \
  -d '{"priority": -5}'
```

---

### DELETE /api/resources/process/:pid
Termina un proceso por su PID.

**URL Parameters**:
- `pid` (requerido): Process ID a terminar

**Response**:
```json
{
  "success": true,
  "message": "Process 1234 terminated successfully"
}
```

**Status Codes**:
- `200`: Proceso terminado
- `404`: Proceso no encontrado
- `500`: Error al terminar proceso

---

## 🔧 Salud de Servicios Systemd

### GET /api/services
Lista todos los servicios systemd activos del sistema.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "name": "ssh",
      "status": "active"
    },
    {
      "name": "docker",
      "status": "active"
    },
    ...
  ]
}
```

**Status Code**: 200

**Ejemplo de uso**:
```bash
curl -s http://localhost:3000/api/services | jq .
```

---

### GET /api/services/:name/health
Obtiene información detallada del estado de salud de un servicio systemd específico. **NEW en v1.0.3**

**URL Parameters**:
- `name` (requerido): Nombre del servicio (ej: `ssh`, `docker`, `mysql`)

**Response**:
```json
{
  "success": true,
  "data": {
    "name": "ssh",
    "active": true,
    "enabled": true,
    "status": "running",
    "uptime": "4d 12h 30m",
    "memoryUsage": "7.6M",
    "cpuUsage": "0.2%"
  }
}
```

**Campos opcionales**: `uptime`, `memoryUsage`, `cpuUsage` pueden no estar disponibles dependiendo del servicio.

**Status Codes**:
- `200`: Información del servicio obtenida
- `400`: Nombre de servicio no proporcionado
- `500`: Error al obtener estado del servicio

**Ejemplo de uso**:
```bash
# Verificar estado de SSH
curl -s http://localhost:3000/api/services/ssh/health | jq .

# Verificar estado de Docker
curl -s http://localhost:3000/api/services/docker/health | jq .
```

---

## 📋 Auditoría de Logs

### GET /api/logs
Obtiene los logs de auditoría registrados en el sistema. **NEW en v1.0.4**

**Query Parameters**:
- `limit` (opcional): Número máximo de logs a retornar. Default: 100

**Response**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "timestamp": "2025-12-06T21:00:00.000Z",
      "action": "process_kill",
      "details": {
        "pid": 1234
      },
      "status": "success"
    },
    {
      "timestamp": "2025-12-06T20:10:00.000Z",
      "action": "command_execute",
      "details": {
        "command": "invalid"
      },
      "status": "failure",
      "errorMessage": "Command not found"
    }
  ]
}
```

**Status Code**: 200

**Ejemplo de uso**:
```bash
# Obtener últimos 50 logs
curl -s "http://localhost:3000/api/logs?limit=50" | jq .

# Obtener todos los logs (máx 100)
curl -s http://localhost:3000/api/logs | jq .
```

---

### POST /api/logs/search
Busca logs de auditoría por criterios específicos. **NEW en v1.0.4**

**Request Body**:
```json
{
  "action": "command_execute",
  "status": "success",
  "startDate": "2025-12-06T00:00:00Z",
  "endDate": "2025-12-06T23:59:59Z",
  "limit": 50
}
```

**Body Parameters** (todos opcionales):
- `action` (string): Filtrar por tipo de acción (búsqueda parcial, case-insensitive)
- `status` (string): Filtrar por estado: `success` o `failure`
- `startDate` (ISO string): Fecha mínima
- `endDate` (ISO string): Fecha máxima
- `limit` (number): Número máximo de resultados. Default: 100

**Response**:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "timestamp": "2025-12-06T20:10:00.000Z",
      "action": "command_execute",
      "details": {
        "command": "invalid"
      },
      "status": "failure",
      "errorMessage": "Command not found"
    }
  ]
}
```

**Status Codes**:
- `200`: Búsqueda completada
- `400`: Parámetros inválidos (ej: startDate > endDate)
- `500`: Error en el servidor

**Ejemplo de uso**:
```bash
# Buscar logs de fallos
curl -X POST http://localhost:3000/api/logs/search \
  -H "Content-Type: application/json" \
  -d '{"status":"failure"}'

# Buscar logs de servicio en rango de fechas
curl -X POST http://localhost:3000/api/logs/search \
  -H "Content-Type: application/json" \
  -d '{
    "action": "service",
    "startDate": "2025-12-06T00:00:00Z",
    "endDate": "2025-12-07T00:00:00Z",
    "limit": 20
  }'

# Buscar todos los comandos que fueron exitosos
curl -X POST http://localhost:3000/api/logs/search \
  -H "Content-Type: application/json" \
  -d '{"action":"command","status":"success"}' | jq .
```

---

## 📁 Operaciones de Archivos

### GET /api/files?path=<path>
Lee un archivo o lista contenido de un directorio. **Requiere autenticación**. **NEW en v1.1.0**

**Query Parameters**:
- `path` (requerido): Ruta del archivo o directorio

**Response (lectura de archivo)**:
```json
{
  "success": true,
  "data": {
    "path": "/tmp/test.txt",
    "content": "Contenido del archivo",
    "size": 22,
    "type": "text"
  }
}
```

**Response (listado de directorio)**:
```json
{
  "success": true,
  "data": {
    "path": "/tmp",
    "files": [
      {
        "name": "test.txt",
        "path": "/tmp/test.txt",
        "type": "file",
        "size": 22,
        "modified": "2025-12-06T21:00:00.000Z",
        "permissions": "644"
      }
    ]
  }
}
```

**Status Codes**:
- `200`: Archivo/directorio encontrado
- `400`: path no proporcionado
- `404`: Archivo/directorio no encontrado
- `500`: Error al leer

**Rutas permitidas**: `/home/*`, `/tmp/*`, `/var/log/*`, `/var/tmp/*`

**Ejemplo de uso**:
```bash
# Leer archivo
curl -s http://localhost:3000/api/files?path=/tmp/test.txt \
  -H "Authorization: Bearer tu-token-secreto-aqui" | jq .

# Listar directorio
curl -s http://localhost:3000/api/files?path=/tmp \
  -H "Authorization: Bearer tu-token-secreto-aqui" | jq .data.files
```

---

### POST /api/files
Escribe contenido en un archivo. **Requiere autenticación**. **NEW en v1.1.0**

**Request Body**:
```json
{
  "path": "/tmp/newfile.txt",
  "content": "contenido del archivo",
  "append": false
}
```

**Body Parameters**:
- `path` (requerido): Ruta del archivo
- `content` (requerido): Contenido a escribir (string)
- `append` (opcional): Si es `true`, agrega al final. Default: `false`

**Response**:
```json
{
  "success": true,
  "data": {
    "path": "/tmp/newfile.txt",
    "size": 22,
    "written": 22
  }
}
```

**Status Codes**:
- `201`: Archivo creado/actualizado
- `400`: Parámetros inválidos
- `500`: Error al escribir

**Ejemplo de uso**:
```bash
# Crear archivo
curl -X POST http://localhost:3000/api/files \
  -H "Authorization: Bearer tu-token-secreto-aqui" \
  -H "Content-Type: application/json" \
  -d '{"path":"/tmp/test.txt","content":"Hello World"}'

# Agregar contenido al final
curl -X POST http://localhost:3000/api/files \
  -H "Authorization: Bearer tu-token-secreto-aqui" \
  -H "Content-Type: application/json" \
  -d '{"path":"/tmp/test.txt","content":"\nAñadida nueva línea","append":true}'
```

---

### DELETE /api/files?path=<path>
Elimina un archivo. **Requiere autenticación**. **NEW en v1.1.0**

**Query Parameters**:
- `path` (requerido): Ruta del archivo a eliminar

**Response**:
```json
{
  "success": true,
  "data": {
    "path": "/tmp/test.txt",
    "deleted": true
  }
}
```

**Status Codes**:
- `200`: Archivo eliminado
- `400`: path no proporcionado
- `404`: Archivo no encontrado
- `500`: Error al eliminar

**Ejemplo de uso**:
```bash
curl -X DELETE "http://localhost:3000/api/files?path=/tmp/test.txt" \
  -H "Authorization: Bearer tu-token-secreto-aqui"
```

---

### POST /api/files/mkdir
Crea un directorio. **Requiere autenticación**. **NEW en v1.1.0**

**Request Body**:
```json
{
  "path": "/tmp/newdir"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "path": "/tmp/newdir",
    "created": true
  }
}
```

**Status Codes**:
- `201`: Directorio creado
- `400`: path no proporcionado
- `500`: Error al crear

**Ejemplo de uso**:
```bash
curl -X POST http://localhost:3000/api/files/mkdir \
  -H "Authorization: Bearer tu-token-secreto-aqui" \
  -H "Content-Type: application/json" \
  -d '{"path":"/tmp/newdir"}'
```

---

### DELETE /api/files/rmdir?path=<path>
Elimina un directorio vacío. **Requiere autenticación**. **NEW en v1.1.0**

**Query Parameters**:
- `path` (requerido): Ruta del directorio a eliminar

**Response**:
```json
{
  "success": true,
  "data": {
    "path": "/tmp/emptydir",
    "deleted": true
  }
}
```

**Status Codes**:
- `200`: Directorio eliminado
- `400`: path no proporcionado
- `404`: Directorio no encontrado
- `500`: Error al eliminar (puede estar no vacío)

**Ejemplo de uso**:
```bash
curl -X DELETE "http://localhost:3000/api/files/rmdir?path=/tmp/emptydir" \
  -H "Authorization: Bearer tu-token-secreto-aqui"
```

---

## 🔒 Gestión de Secretos (AES-256-GCM)

Requiere autenticación en todos los endpoints. Los valores se almacenan cifrados con AES-256-GCM usando la clave `SECRET_KEY` (base64, 32 bytes). La lista nunca expone el `value`.

### POST /api/secrets
Creación de un secreto. **NEW en v1.3.0**

**Body**:
```json
{
  "name": "github-token",
  "value": "ghp_xxx",
  "tags": ["prod", "github"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4e5f6a7b8",
    "name": "github-token",
    "tags": ["prod", "github"],
    "createdAt": "2025-12-06T23:58:00.000Z",
    "updatedAt": "2025-12-06T23:58:00.000Z"
  }
}
```

### GET /api/secrets
Lista metadatos de secretos (sin value).

**Response**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "a1b2c3d4e5f6a7b8",
      "name": "github-token",
      "tags": ["prod"],
      "createdAt": "2025-12-06T23:58:00.000Z",
      "updatedAt": "2025-12-06T23:58:00.000Z"
    }
  ]
}
```

### GET /api/secrets/:id
Obtiene un secreto y devuelve su `value` descifrado.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4e5f6a7b8",
    "name": "github-token",
    "tags": ["prod"],
    "createdAt": "2025-12-06T23:58:00.000Z",
    "updatedAt": "2025-12-06T23:59:10.000Z",
    "value": "ghp_xxx"
  }
}
```

### PATCH /api/secrets/:id
Actualiza `name`, `value` (rota) y/o `tags`.

**Body (ejemplo)**:
```json
{
  "value": "ghp_rotated",
  "tags": ["prod", "rotated"]
}
```

**Response**: Igual que GET /:id con valores actualizados.

### DELETE /api/secrets/:id
Elimina un secreto.

**Response**:
```json
{
  "success": true,
  "data": { "deleted": true }
}
```

---

## 💾 Backups Básicos (tar.gz)

Requiere autenticación. Respeta la validación de paths (solo `/home`, `/tmp`, `/var/log`, `/var/tmp`).

### POST /api/backups
Crea un backup `.tar.gz` a partir de rutas permitidas. **NEW en v1.4.0**

**Body**:
```json
{
  "paths": ["/home/sebss/apps/VPSLocalOrchestrator/logs", "/tmp/test.txt"],
  "name": "opcional-nombre"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "name": "backup-2025-12-07T00-20-00-000Z.tar.gz",
    "path": "/home/sebss/apps/VPSLocalOrchestrator/api/backups/backup-2025-12-07T00-20-00-000Z.tar.gz",
    "size": 12345,
    "createdAt": "2025-12-07T00:20:00.000Z"
  }
}
```

### GET /api/backups
Lista los backups disponibles.

**Response**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "name": "backup-2025-12-07T00-20-00-000Z.tar.gz",
      "path": "/home/sebss/apps/VPSLocalOrchestrator/api/backups/backup-2025-12-07T00-20-00-000Z.tar.gz",
      "size": 12345,
      "createdAt": "2025-12-07T00:20:00.000Z"
    }
  ]
}
```

### GET /api/backups/:name
Descarga el backup especificado. Si se pasa `?info=true`, devuelve solo metadatos.

**Ejemplos**:
```bash
# Descargar
curl -s -X GET "http://localhost:3000/api/backups/backup-2025-12-07T00-20-00-000Z.tar.gz" \
  -H "Authorization: Bearer tu-token-secreto-aqui" -o backup.tar.gz

# Solo metadatos
curl -s -X GET "http://localhost:3000/api/backups/backup-2025-12-07T00-20-00-000Z.tar.gz?info=true" \
  -H "Authorization: Bearer tu-token-secreto-aqui" | jq .
```

### DELETE /api/backups/:name
Elimina un backup.

**Response**:
```json
{
  "success": true,
  "data": { "deleted": true }
}
```

### POST /api/backups/:name/restore
Restaura un backup `.tar.gz` a un destino permitido. **NEW en v2.0.0**

**Body**:
```json
{
  "destination": "/tmp/restore-target"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "name": "backup-2025-12-07T00-18-07-524Z.tar.gz",
    "destination": "/tmp/restore-target",
    "restoredAt": "2025-12-07T01:05:00.000Z"
  }
}
```

**Notas**:
- Valida rutas igual que backups: solo `/home`, `/tmp`, `/var/log`, `/var/tmp`.
- Crea el directorio destino si no existe.
- Usa `tar -xzf` para extraer; requiere binario `tar` disponible.

---

## ⚙️ Workflow Engine (MVP)

Requiere autenticación. Workflows se almacenan en disco (`api/workflows/workflows.json`) y los historiales de ejecución en `api/workflows/workflow-runs.json` (se conservan los últimos 50 por workflow). Tipos de paso soportados: `command`, `wait`, `webhook`.

### POST /api/workflows
Crea un workflow. **NEW en v2.0.1**

**Body**:
```json
{
  "name": "deploy-sequence",
  "steps": [
    { "type": "command", "command": "echo step1" },
    { "type": "wait", "waitMs": 2000 },
    { "type": "webhook", "url": "http://example.com/hook", "method": "POST", "body": { "ok": true } }
  ]
}
```

**Response**: workflow con `id`, `steps` con `id` asignado, `active` por defecto `true`.

### GET /api/workflows
Lista workflows.

### GET /api/workflows/:id
Obtiene detalle de un workflow.

### PATCH /api/workflows/:id
Actualiza `name`, `active` y/o `steps`.

### DELETE /api/workflows/:id
Elimina un workflow.

### POST /api/workflows/:id/run
Ejecuta secuencialmente los pasos. Detiene en el primer fallo.

**Response (ejemplo)**:
```json
{
  "success": true,
  "data": {
    "runId": "01JDN4K9R0HHD20W9F1Z",
    "workflowId": "abc123",
    "startedAt": "2025-12-07T01:25:00.000Z",
    "finishedAt": "2025-12-07T01:25:02.100Z",
    "status": "success",
    "steps": [
      { "stepId": "s1", "type": "command", "status": "success", "durationMs": 10, "output": { "exitCode": 0, "stdout": "ok", "stderr": "" } },
      { "stepId": "s2", "type": "wait", "status": "success", "durationMs": 2000 },
      { "stepId": "s3", "type": "webhook", "status": "success", "durationMs": 50, "output": { "status": 200, "body": "OK" } }
    ]
  }
}
```

**Notas**:
- `command`: usa el ejecutor existente; devuelve exitCode/stdout/stderr.
- `wait`: `waitMs` 0-300000 ms.
- `webhook`: se envía JSON con `fetch`; `method` default `POST`; retorna status/body.
- Corte en primer fallo: `status` global será `partial` si hubo pasos previos exitosos.

### GET /api/workflows/:id/history
Obtiene el historial de ejecuciones (más reciente primero). Máximo 50 entradas por workflow.

**Query params**:
- `limit` (opcional): número de resultados a devolver (1-50). Default: `20`.

**Response (ejemplo)**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "runId": "01JDN4K9R0HHD20W9F1Z",
      "workflowId": "abc123",
      "startedAt": "2025-12-07T01:25:00.000Z",
      "finishedAt": "2025-12-07T01:25:02.100Z",
      "status": "success",
      "steps": [
        { "stepId": "s1", "type": "command", "status": "success", "durationMs": 10 },
        { "stepId": "s2", "type": "wait", "status": "success", "durationMs": 2000 }
      ]
    }
  ]
}
```

---

## 📈 Métricas Personalizadas

Requiere autenticación. Las métricas se almacenan en `api/metrics/metrics.json`. Máximo 500 resultados por consulta, default 100.

### POST /api/metrics/custom
Registra una métrica puntual.

**Body**:
```json
{
  "name": "app.requests_per_second",
  "value": 150,
  "tags": { "service": "api", "endpoint": "/users" },
  "timestamp": "2025-12-07T01:30:00.000Z" // opcional; default ahora
}
```

**Response**: métrica persistida con `id` y `timestamp` ISO.

### GET /api/metrics
Consulta métricas con filtros opcionales.

**Query params**:
- `name` (opcional): filtra por nombre exacto.
- `from` (opcional): ISO date desde.
- `to` (opcional): ISO date hasta.
- `limit` (opcional): 1-500 resultados. Default 100.

**Response (ejemplo)**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "01JDN4T2W76S7HKMHYN5",
      "name": "app.requests_per_second",
      "value": 150,
      "tags": { "service": "api", "endpoint": "/users" },
      "timestamp": "2025-12-07T01:30:00.000Z"
    }
  ]
}
```

---

## 🐳 Integración Docker

Requiere autenticación. Usa el binario `docker` local, por lo que debes tener permisos para ejecutarlo (ej: en el grupo `docker`). Errores del CLI se devuelven en `error`.

### GET /api/docker/containers
Lista contenedores en ejecución (`docker ps`).

**Response (ejemplo)**:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "4d2f3c6d1b1e",
      "image": "nginx:latest",
      "command": "\"nginx -g 'daemon off;'\"",
      "createdAt": "2025-12-07 10:00:00 +0000 UTC",
      "runningFor": "2 hours",
      "status": "Up 2 hours",
      "ports": "0.0.0.0:80->80/tcp",
      "names": "web"
    }
  ]
}
```

### GET /api/docker/images
Lista imágenes locales (`docker images`).

**Response (ejemplo)**:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "sha256:abcd...",
      "repository": "nginx",
      "tag": "latest",
      "createdSince": "2 weeks ago",
      "size": "142MB"
    }
  ]
}
```

### POST /api/docker/containers/:id/start
Inicia un contenedor por ID o nombre (`docker start`).

**Response**:
```json
{ "success": true, "data": { "id": "web", "action": "start", "output": "web" } }
```

### POST /api/docker/containers/:id/stop
Detiene un contenedor (`docker stop`).

**Response**:
```json
{ "success": true, "data": { "id": "web", "action": "stop", "output": "web" } }
```

**Notas**:
- Requiere que Docker esté instalado y accesible por el usuario que ejecuta la API.
- Errores de permisos (ej: falta de grupo docker) se devuelven como `error`.

---

## 🗄️ Integración de Bases de Datos (PostgreSQL)

Requiere autenticación. Usa utilidades locales `pg_dump` y `pg_isready`; asegúrate de que estén instaladas y que el usuario de la API tenga permisos/variables de entorno apropiadas.

### GET /api/databases/status
Chequea el estado de conexión usando `pg_isready`.

**Query params**:
- `type` (opcional): solo `postgresql` soportado. Default: `postgresql`.
- `name` (opcional): nombre de la base. Default: `postgres`.

**Response (ejemplo)**:
```json
{
  "success": true,
  "data": {
    "type": "postgresql",
    "name": "postgres",
    "status": "ready",
    "exitCode": 0,
    "output": "localhost:5432 - accepting connections"
  }
}
```

### POST /api/databases/backup
Crea un dump lógico con `pg_dump` en un directorio permitido.

**Body**:
```json
{
  "type": "postgresql",
  "name": "app_db",
  "destination": "/tmp/db-backups" // opcional, default /tmp/db-backups
}
```

**Response (ejemplo)**:
```json
{
  "success": true,
  "data": {
    "type": "postgresql",
    "name": "app_db",
    "path": "/tmp/db-backups/app_db-2025-12-07T11-05-00-000Z.sql",
    "createdAt": "2025-12-07T11:05:00.000Z",
    "durationMs": 1200,
    "command": "pg_dump app_db -f /tmp/db-backups/app_db-2025-12-07T11-05-00-000Z.sql"
  }
}
```

**Notas**:
- Destino permitido: home del usuario, `/tmp`, `/var/tmp`.
- Si `pg_dump` falla (credenciales/rol/host), se devuelve el stderr del comando.

---

## ⚖️ Control de Load Balancer

Requiere autenticación. Mantiene un registro simple de backends en disco (`api/loadbalancer/backends.json`). Pensado para orquestar cambios y luego aplicarlos a tu LB real o scripts externos.

### GET /api/loadbalancer/backends
Lista los backends registrados.

### POST /api/loadbalancer/backends
Crea un backend con estado `enabled`.

**Body**:
```json
{ "address": "web-1:8080" }
```

### POST /api/loadbalancer/backends/:id/drain
Marca un backend como `draining` (útil para retirar tráfico gradualmente).

### POST /api/loadbalancer/backends/:id/enable
Devuelve el backend a estado `enabled`.

### DELETE /api/loadbalancer/backends/:id
Elimina un backend del registro.

**Notas**:
- `address` acepta formato `host:port` o URL.
- Este registro no aplica cambios a HAProxy/Nginx automáticamente; úsalo como fuente de verdad ligera para automatizaciones.

---

## 📊 Analytics Avanzado

Requiere autenticación. Analiza métricas en ventanas de tiempo para detectar tendencias, agregaciones y snapshots.

### GET /api/analytics/snapshot
Foto actual de todas las métricas (último valor por métrica).

### GET /api/analytics/aggregate
Agregación de una métrica en ventana de tiempo.

**Query params**:
- `metric` (requerido): nombre de la métrica.
- `type` (opcional): `sum|avg|count|min|max`. Default: `avg`.
- `period` (opcional): `1h|24h|7d`. Default: `1h`.

**Response (ejemplo)**:
```json
{
  "success": true,
  "data": {
    "metric": "app.requests_per_second",
    "type": "avg",
    "value": 125.5,
    "periodStart": "2025-12-07T10:00:00.000Z",
    "periodEnd": "2025-12-07T11:00:00.000Z",
    "samplesCount": 60
  }
}
```

### GET /api/analytics/trend
Detecta si una métrica sube/baja/estable en la ventana.

**Query params**:
- `metric` (requerido): nombre de la métrica.
- `period` (opcional): `1h|24h|7d`. Default: `1h`.

**Response (ejemplo)**:
```json
{
  "success": true,
  "data": {
    "metric": "system.cpu_usage",
    "direction": "up",
    "changePercent": 15.5,
    "periodStart": "2025-12-07T10:00:00.000Z",
    "periodEnd": "2025-12-07T11:00:00.000Z"
  }
}
```

**Notas**:
- `direction` es `up` si cambio > 5%, `down` si < -5%, `stable` en otro caso.
- `changePercent` es relativo al primer valor de la ventana.

---

## 🔗 Webhooks y Eventos

### GET /api/webhooks
Lista todos los webhooks registrados. **Requiere autenticación**. **NEW en v1.2.0**

**Response**:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "e1361cbf15433a1b",
      "url": "https://example.com/webhook",
      "events": ["command_execute", "service_status"],
      "active": true,
      "createdAt": "2025-12-06T23:43:42.922Z",
      "secret": "webhook-secret-key"
    }
  ]
}
```

**Status Code**: 200

**Ejemplo de uso**:
```bash
curl -s http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer tu-token-secreto-aqui" | jq .
```

---

### POST /api/webhooks
Registra un nuevo webhook. **Requiere autenticación**. **NEW en v1.2.0**

**Request Body**:
```json
{
  "url": "https://example.com/webhook",
  "events": ["command_execute", "service_status"],
  "secret": "optional-secret-for-signature"
}
```

**Body Parameters**:
- `url` (requerido): URL HTTPS del webhook
- `events` (requerido): Array de eventos a escuchar
- `secret` (opcional): Clave secreta para firmar requests (HMAC-SHA256)

**Available Events**:
- `command_execute` - Cuando se ejecuta un comando
- `service_status` - Cuando cambia el estado de un servicio
- `file_write` - Cuando se escribe un archivo
- `file_delete` - Cuando se elimina un archivo
- `process_priority` - Cuando cambia la prioridad de un proceso
- `test` - Evento de prueba

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "e1361cbf15433a1b",
    "url": "https://example.com/webhook",
    "events": ["command_execute", "service_status"],
    "active": true,
    "createdAt": "2025-12-06T23:43:42.922Z",
    "secret": "webhook-secret-key"
  }
}
```

**Status Codes**:
- `201`: Webhook registrado
- `400`: Parámetros inválidos
- `500`: Error al registrar

**Webhook Payload** (lo que recibe tu servidor):
```json
{
  "event": "command_execute",
  "timestamp": "2025-12-06T23:45:00.000Z",
  "data": {
    "command": "ls -la",
    "exitCode": 0,
    "duration": 150
  }
}
```

**Headers recibidos**:
- `Content-Type: application/json`
- `User-Agent: VPS-Orchestrator-Webhook/1.0`
- `X-Webhook-Signature: <HMAC-SHA256>` (si se configuró secret)

**Ejemplo de uso**:
```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer tu-token-secreto-aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/webhook",
    "events": ["command_execute", "service_status"],
    "secret": "mi-clave-secreta"
  }'
```

---

### GET /api/webhooks/:id
Obtiene un webhook específico. **Requiere autenticación**. **NEW en v1.2.0**

**URL Parameters**:
- `id` (requerido): ID del webhook

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "e1361cbf15433a1b",
    "url": "https://example.com/webhook",
    "events": ["command_execute"],
    "active": true,
    "createdAt": "2025-12-06T23:43:42.922Z",
    "lastTriggeredAt": "2025-12-06T23:45:10.000Z"
  }
}
```

**Status Codes**:
- `200`: Webhook encontrado
- `404`: Webhook no encontrado
- `500`: Error

---

### PATCH /api/webhooks/:id
Actualiza un webhook (activa/desactiva o cambia eventos). **Requiere autenticación**. **NEW en v1.2.0**

**Request Body**:
```json
{
  "active": false,
  "events": ["command_execute"]
}
```

**Body Parameters** (al menos uno requerido):
- `active` (boolean): Activar/desactivar webhook
- `events` (array): Nuevos eventos a escuchar

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "e1361cbf15433a1b",
    "url": "https://example.com/webhook",
    "events": ["command_execute"],
    "active": false,
    "createdAt": "2025-12-06T23:43:42.922Z"
  }
}
```

**Ejemplo de uso**:
```bash
# Desactivar un webhook
curl -X PATCH http://localhost:3000/api/webhooks/e1361cbf15433a1b \
  -H "Authorization: Bearer tu-token-secreto-aqui" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'

# Cambiar eventos
curl -X PATCH http://localhost:3000/api/webhooks/e1361cbf15433a1b \
  -H "Authorization: Bearer tu-token-secreto-aqui" \
  -H "Content-Type: application/json" \
  -d '{"events": ["command_execute", "file_write"]}'
```

---

### DELETE /api/webhooks/:id
Elimina un webhook. **Requiere autenticación**. **NEW en v1.2.0**

**URL Parameters**:
- `id` (requerido): ID del webhook

**Response**:
```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

**Status Codes**:
- `200`: Webhook eliminado
- `404`: Webhook no encontrado
- `500`: Error

**Ejemplo de uso**:
```bash
curl -X DELETE http://localhost:3000/api/webhooks/e1361cbf15433a1b \
  -H "Authorization: Bearer tu-token-secreto-aqui"
```

---

### POST /api/webhooks/:id/test
Envía un evento de prueba al webhook. **Requiere autenticación**. **NEW en v1.2.0**

**URL Parameters**:
- `id` (requerido): ID del webhook

**Response**:
```json
{
  "success": true,
  "message": "Test webhook sent successfully"
}
```

**Status Codes**:
- `200`: Webhook de prueba enviado
- `404`: Webhook no encontrado
- `500`: Error al enviar

**Ejemplo de uso**:
```bash
curl -X POST http://localhost:3000/api/webhooks/e1361cbf15433a1b/test \
  -H "Authorization: Bearer tu-token-secreto-aqui"
```

---

## ⚠️ Errores Comunes

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}
```

**Solución**: Incluir header `Authorization: Bearer <token>` en la request.

---

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "The requested endpoint does not exist"
}
```

**Solución**: Verificar que el endpoint existe en la documentación.

---

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Error message here"
}
```

**Solución**: Revisar los logs del servidor para más detalles.

---

## 🧪 Ejemplos de Uso con cURL

### Obtener recursos del sistema
```bash
curl -s http://localhost:3000/api/resources | jq .
```

### Ejecutar comando con autenticación
```bash
curl -X POST http://localhost:3000/api/command/execute \
  -H "Authorization: Bearer tu-token-secreto-aqui" \
  -H "Content-Type: application/json" \
  -d '{"command": "ps aux"}'
```

### Obtener estadísticas de red
```bash
curl -s http://localhost:3000/api/resources/network | jq .
```

### Ejecutar lote de comandos
```bash
curl -X POST http://localhost:3000/api/command/batch \
  -H "Authorization: Bearer tu-token-secreto-aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": ["pwd", "whoami", "uname -a"]
  }' | jq .
```

---

## 📈 Ciclo de Vida de Versiones

- **v1.0.0**: API base con ejecución de comandos y monitoreo básico
- **v1.0.1**: Agregado monitoreo de interfaces de red y conexiones (GET /api/resources/network)
- **v1.0.2**: Control de prioridad de procesos (POST /api/resources/process/:pid/priority)
- **v1.0.3**: Verificación de salud de servicios systemd (GET /api/services/:name/health)
- **v1.0.4**: Logging de auditoría básico (GET /api/logs, POST /api/logs/search)
- **v1.1.0**: Operaciones de archivos (GET/POST/DELETE /api/files, mkdir, rmdir)
- **v1.2.0**: Webhooks y eventos (GET/POST/DELETE /api/webhooks, test)
 - **v1.3.0**: Gestión de secretos (CRUD cifrado con AES-256-GCM)
- **v1.4.0**: Backup básico (tar.gz de rutas permitidas)
- **v2.0.0**: Backup avanzado (restore a destino validado)
- **v2.0.1**: Workflow engine (MVP comandos/wait/webhook)
- **v2.0.2**: Historial de ejecuciones de workflows (GET /api/workflows/:id/history, runId)
- **v2.0.3**: Métricas personalizadas (POST /api/metrics/custom, GET /api/metrics)
- **v2.0.4**: Integración Docker (listar contenedores/imágenes, start/stop contenedores)
- **v3.0.0**: Integración de bases de datos (PostgreSQL status/backup)
- **v3.1.0**: Control de load balancer (registro de backends, drain/enable/delete)
- **v3.2.0**: Analytics avanzado (snapshots, agregaciones, detección de tendencias)

---

**Última actualización**: 2025-12-07  
**Mantenido por**: VPS Local Orchestrator Team
