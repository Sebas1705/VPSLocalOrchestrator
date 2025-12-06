# 📡 Documentación de Endpoints

Guía completa de todos los endpoints disponibles en la VPS Local Orchestrator API.

**Versión actual**: v1.0.1

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
- **v1.2.0**: Fase 1 completada (Enhanced Service Status, Audit Logging, Process Priority Control)
- **v1.3.0**: Fase 2 completada
- **v2.0.0**: Fase 3 completada

---

**Última actualización**: 2025-12-06  
**Mantenido por**: VPS Local Orchestrator Team
