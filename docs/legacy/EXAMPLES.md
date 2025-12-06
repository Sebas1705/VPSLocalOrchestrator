# Ejemplos de uso con cURL

## 1. Health Check
```bash
curl http://127.0.0.1:3000/health
```

## 2. Ejecutar un comando simple
```bash
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Content-Type: application/json" \
  -d '{
    "command": "ls -la /home"
  }'
```

## 3. Ejecutar comando con timeout personalizado
```bash
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Content-Type: application/json" \
  -d '{
    "command": "find /var/log -name \"*.log\"",
    "timeout": 60000
  }'
```

## 4. Ejecutar comando en directorio específico
```bash
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Content-Type: application/json" \
  -d '{
    "command": "ls -la",
    "cwd": "/tmp"
  }'
```

## 5. Ejecutar múltiples comandos secuencialmente
```bash
curl -X POST http://127.0.0.1:3000/api/command/batch \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      "whoami",
      "pwd",
      "date",
      "df -h",
      "free -h"
    ]
  }'
```

## 6. Obtener recursos del sistema
```bash
curl http://127.0.0.1:3000/api/resources
```

## 7. Obtener lista de procesos (top 10)
```bash
curl "http://127.0.0.1:3000/api/resources/processes?limit=10"
```

## 8. Backup de directorio
```bash
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Content-Type: application/json" \
  -d '{
    "command": "tar -czf /backup/myapp-$(date +%Y%m%d-%H%M%S).tar.gz /app/myapp",
    "timeout": 300000
  }'
```

## 9. Reiniciar un servicio
```bash
curl -X POST http://127.0.0.1:3000/api/command/batch \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      "sudo systemctl stop nginx",
      "sleep 2",
      "sudo systemctl start nginx",
      "sudo systemctl status nginx"
    ]
  }'
```

## 10. Limpiar archivos temporales
```bash
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Content-Type: application/json" \
  -d '{
    "command": "find /tmp -type f -mtime +7 -delete"
  }'
```

## 11. Verificar espacio en disco
```bash
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Content-Type: application/json" \
  -d '{
    "command": "df -h | grep -E \"^/dev/\""
  }'
```

## 12. Monitorear logs en tiempo real (último 100 líneas)
```bash
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Content-Type: application/json" \
  -d '{
    "command": "tail -n 100 /var/log/syslog"
  }'
```

## 13. Verificar puertos en uso
```bash
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Content-Type: application/json" \
  -d '{
    "command": "netstat -tuln | grep LISTEN"
  }'
```

## 14. Información del sistema
```bash
curl -X POST http://127.0.0.1:3000/api/command/batch \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      "uname -a",
      "cat /etc/os-release | head -n 5",
      "uptime",
      "lscpu | grep \"Model name\"",
      "free -h"
    ]
  }'
```

## 15. Verificar servicios activos
```bash
curl -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Content-Type: application/json" \
  -d '{
    "command": "systemctl list-units --type=service --state=running"
  }'
```

## Con jq (formato bonito)

### Recursos con formato
```bash
curl -s http://127.0.0.1:3000/api/resources | jq '{
  cpu: .data.cpu.usage,
  memory: .data.memory.usagePercent,
  disk: .data.disk.usagePercent,
  uptime: .data.uptime
}'
```

### Top 5 procesos por CPU
```bash
curl -s "http://127.0.0.1:3000/api/resources/processes?limit=5" | \
  jq '.data[] | {pid, name, cpu}'
```

### Solo ver salida de comandos
```bash
curl -s -X POST http://127.0.0.1:3000/api/command/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "date"}' | \
  jq -r '.result.stdout'
```
