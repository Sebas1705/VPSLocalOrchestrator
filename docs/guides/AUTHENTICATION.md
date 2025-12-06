# Guía de Autenticación

## 🔐 Sistema de Seguridad

La API incluye endpoints privilegiados que requieren autenticación mediante token Bearer para ejecutarse. Esto añade una capa adicional de seguridad para comandos sensibles.

## 🔑 Configuración del Token

### Token Seguro (Recomendado)
Generar un token aleatorio seguro de 64 caracteres:

```bash
openssl rand -hex 32
# Resultado: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

Copiar en `.env`:
```bash
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Validación de Token
El servidor valida el token usando `crypto.timingSafeEqual()` para prevenir timing attacks:

```typescript
const providedToken = Buffer.from(token, 'utf-8');
const validToken = Buffer.from(API_TOKEN, 'utf-8');
crypto.timingSafeEqual(providedToken, validToken);
```

## 📡 Usando Token en Requests

### Formato Bearer (Recomendado)
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/execute \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"command": "whoami"}'
```

### Respuesta Exitosa (200)
```json
{
  "success": true,
  "result": {
    "stdout": "root",
    "stderr": "",
    "exitCode": 0,
    "duration": 45
  }
}
```

### Sin Token (401)
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Valid API token required for privileged operations"
}
```

### Token Inválido (401)
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Valid API token required for privileged operations"
}
```

## 🔐 Comandos que Requieren Token

Los siguientes comandos requieren autenticación:

```typescript
[
  /^sudo\s+/,           # Cualquier comando con sudo
  /^systemctl\s+/,      # systemctl (servicios)
  /^service\s+/,        # service (servicios)
  /^rm\s+-rf/,          # rm -rf (eliminación recursiva)
  /^shutdown/,          # shutdown
  /^reboot/,            # reboot
  /^poweroff/,          # poweroff
  /^halt/,              # halt
  /^kill\s+-9/,         # kill -9 (fuerza)
  /^pkill/,             # pkill
  /^dd\s+/,             # dd (bajo nivel)
  /^mkfs/,              # mkfs (formato)
  /^fdisk/,             # fdisk (particiones)
  /^parted/,            # parted (particiones)
  /^chmod\s+/,          # chmod (permisos)
  /^chown\s+/,          # chown (propietario)
  /^passwd/,            # passwd (cambiar contraseña)
  /^userdel/,           # userdel (eliminar usuario)
  /^useradd/            # useradd (crear usuario)
]
```

## 🚀 Ejemplos Prácticos

### Ejecutar comando privilegiado
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/execute \
  -H "Authorization: Bearer $(cat api/.env | grep API_TOKEN | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "systemctl status nginx",
    "timeout": 5000
  }'
```

### Batch de comandos privilegiados
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/batch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      "systemctl stop nginx",
      "sleep 2",
      "systemctl start nginx",
      "systemctl status nginx"
    ]
  }'
```

### Gestionar servicios
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/service \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "nginx",
    "action": "restart"
  }'
```

Acciones disponibles: `start`, `stop`, `restart`, `status`, `enable`, `disable`

## 🛡️ Mejores Prácticas de Seguridad

1. **Token seguro**: Usar `openssl rand -hex 32` para generar
2. **Nunca commitear**: El token en `.env` nunca debe ir a git
3. **Rotar regularmente**: Cambiar el token cada 3-6 meses
4. **Único por servidor**: No reusar tokens entre servidores
5. **Environments separados**: Tokens diferentes para dev/staging/prod
6. **Logs seguros**: Nunca loguear el token completo
7. **Localhost solo**: La API rechaza IPs externas automáticamente

## 🔒 Node.js Ejemplo Programático

```javascript
const axios = require('axios');

const API_TOKEN = process.env.API_TOKEN;

async function executePrivileged(command) {
  try {
    const response = await axios.post(
      'http://127.0.0.1:3000/api/privileged/execute',
      { command },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('Token inválido o expirado');
    }
    throw error;
  }
}

// Uso
executePrivileged('systemctl restart myapp')
  .then(result => console.log(result))
  .catch(error => console.error(error));
```

## 🐍 Python Ejemplo

```python
import requests
import os

API_TOKEN = os.getenv('API_TOKEN')
API_URL = 'http://127.0.0.1:3000'

def execute_privileged(command):
    headers = {
        'Authorization': f'Bearer {API_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    response = requests.post(
        f'{API_URL}/api/privileged/execute',
        json={'command': command},
        headers=headers
    )
    
    if response.status_code == 401:
        raise Exception('Token inválido')
    
    response.raise_for_status()
    return response.json()

# Uso
result = execute_privileged('systemctl status nginx')
print(result)
```

## 🆘 Troubleshooting

**Error: "Valid API token required"**
- Verificar que el token esté en `.env`
- Verificar que se está usando `Authorization: Bearer TOKEN`
- Verificar que el token no tiene espacios extras

**Error: "This API is only accessible from localhost"**
- El request debe venir desde 127.0.0.1 o localhost
- Verificar que n8n/aplicación está corriendo en el mismo host

**Token expirado o revelado**
- Generar nuevo token: `openssl rand -hex 32`
- Actualizar en `.env`
- Reiniciar servidor
- No necesita agregar al repositorio
