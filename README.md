# VPS Local Orchestrator API

API REST para orquestar recursos del sistema y ejecutar comandos. Solo accesible desde localhost para máxima seguridad.

## 🚀 Inicio Rápido

### Instalación
```bash
cd api
npm install
```

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm run build
npm start
```

La API estará disponible en `http://127.0.0.1:3000`

## 🔒 Seguridad

- **Solo localhost**: La API únicamente acepta conexiones desde `127.0.0.1`, `::1` o `localhost`
- **Sin autenticación externa**: Diseñada para ser consumida por servicios locales como n8n
- Todas las peticiones desde IPs externas son rechazadas con código 403

## 📡 Endpoints

### Health Check
```bash
GET /health
```

Verifica el estado del servidor.

**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-06T10:30:00.000Z",
  "uptime": 123.45
}
```

### Ejecutar Comando

```bash
POST /api/command/execute
```

Ejecuta un comando del sistema.

**Body:**
```json
{
  "command": "ls -la /home",
  "timeout": 30000,
  "cwd": "/home/user",
  "env": {
    "CUSTOM_VAR": "value"
  }
}
```

**Respuesta:**
```json
{
  "success": true,
  "result": {
    "stdout": "output del comando",
    "stderr": "",
    "exitCode": 0,
    "duration": 125
  }
}
```

### Ejecutar Comandos en Lote

```bash
POST /api/command/batch
```

Ejecuta múltiples comandos secuencialmente.

**Body:**
```json
{
  "commands": [
    "echo 'Primero'",
    {
      "command": "ls -la",
      "timeout": 5000,
      "cwd": "/tmp"
    },
    "date"
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "results": [
    {
      "command": "echo 'Primero'",
      "stdout": "Primero",
      "stderr": "",
      "exitCode": 0,
      "duration": 50
    }
  ]
}
```

### Recursos del Sistema

```bash
GET /api/resources
```

Obtiene información sobre CPU, memoria, disco y sistema.

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "cpu": {
      "usage": 45.2,
      "cores": 8,
      "model": "Intel(R) Core(TM) i7-9700K"
    },
    "memory": {
      "total": 16777216000,
      "free": 8388608000,
      "used": 8388608000,
      "usagePercent": 50.0
    },
    "disk": {
      "total": 500000000000,
      "free": 250000000000,
      "used": 250000000000,
      "usagePercent": 50.0
    },
    "uptime": 86400,
    "platform": "linux"
  }
}
```

### Lista de Procesos

```bash
GET /api/resources/processes?limit=10
```

Obtiene los procesos más activos por uso de CPU.

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "pid": 1234,
      "name": "node",
      "cpu": 15.5,
      "memory": 2.3
    }
  ]
}
```

### Eliminar Proceso

```bash
DELETE /api/resources/process/:pid?signal=TERM
```

Envía una señal a un proceso.

**Parámetros:**
- `pid`: ID del proceso (requerido)
- `signal`: Señal a enviar (opcional, por defecto: TERM)

**Respuesta:**
```json
{
  "success": true,
  "message": "Process 1234 killed successfully"
}
```

## 🔌 Integración con n8n

### Ejemplo: Ejecutar comando desde n8n

1. Usa el nodo **HTTP Request**
2. Configura:
   - Method: `POST`
   - URL: `http://127.0.0.1:3000/api/command/execute`
   - Body: JSON
   ```json
   {
     "command": "df -h"
   }
   ```

### Ejemplo: Monitorear recursos

1. Usa el nodo **HTTP Request**
2. Configura:
   - Method: `GET`
   - URL: `http://127.0.0.1:3000/api/resources`

### Ejemplo: Workflow de monitoreo

```json
{
  "nodes": [
    {
      "name": "Monitorear Sistema",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "http://127.0.0.1:3000/api/resources"
      }
    },
    {
      "name": "Alerta si CPU alta",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{$json.data.cpu.usage}}",
              "operation": "larger",
              "value2": 80
            }
          ]
        }
      }
    }
  ]
}
```

## 🛠️ Casos de Uso

### 1. Backup Automatizado
```bash
POST /api/command/execute
{
  "command": "tar -czf /backup/app-$(date +%Y%m%d).tar.gz /app",
  "timeout": 300000
}
```

### 2. Reiniciar Servicios
```bash
POST /api/command/batch
{
  "commands": [
    "systemctl stop myapp",
    "sleep 2",
    "systemctl start myapp",
    "systemctl status myapp"
  ]
}
```

### 3. Limpieza de Disco
```bash
POST /api/command/execute
{
  "command": "find /tmp -type f -mtime +7 -delete"
}
```

### 4. Monitoreo Continuo desde n8n
Crea un workflow con intervalo que:
1. Obtiene recursos del sistema cada 5 minutos
2. Si CPU > 80% o Memoria > 90%, envía alerta
3. Si disco > 85%, ejecuta limpieza automática

## 📋 Estructura del Proyecto

```
api/
├── src/
│   ├── index.ts                    # Servidor principal
│   ├── middleware/
│   │   └── security.ts             # Seguridad y validaciones
│   ├── routes/
│   │   ├── command.routes.ts       # Rutas de comandos
│   │   └── resources.routes.ts     # Rutas de recursos
│   └── services/
│       ├── commandExecutor.ts      # Ejecución de comandos
│       └── resourceMonitor.ts      # Monitoreo de recursos
├── package.json
└── tsconfig.json
```

## ⚠️ Consideraciones de Seguridad

1. **Solo localhost**: La API rechaza todas las conexiones que no provengan de localhost
2. **Sin autenticación**: Confía en el aislamiento de red local
3. **Comandos peligrosos**: Ten cuidado con comandos como `rm -rf`, `dd`, etc.
4. **Timeout**: Todos los comandos tienen timeout de 30 segundos por defecto
5. **Buffer límite**: Salida máxima de 10MB por comando

## 🐛 Troubleshooting

### Error: ECONNREFUSED
- Verifica que el servidor esté corriendo
- Asegúrate de usar `127.0.0.1` o `localhost`

### Error: 403 Forbidden
- Solo puedes acceder desde la misma máquina
- Verifica que n8n esté corriendo en el mismo host

### Comando timeout
- Aumenta el valor de `timeout` en el request
- Para comandos muy largos, considera usar scripts externos

## 📝 Logs

Los logs se imprimen en stdout:
```
[2025-12-06T10:30:00.000Z] POST /api/command/execute - 127.0.0.1
```

## 🔄 Próximas Mejoras

- [ ] WebSocket para streaming de comandos en tiempo real
- [ ] Historial de comandos ejecutados
- [ ] Límite de rate por endpoint
- [ ] Métricas y estadísticas de uso
- [ ] Soporte para scripts predefinidos

## 📄 Licencia

ISC
