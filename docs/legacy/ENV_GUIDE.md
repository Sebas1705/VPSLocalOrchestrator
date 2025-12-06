# Configuración de Entorno (.env)

## 📋 Descripción General

El archivo `.env` contiene las variables de entorno privadas y sensibles de la aplicación. **NUNCA debe ser commiteado al repositorio** (está en `.gitignore`).

## 🔐 Variables de Entorno

### API_TOKEN (Requerido)
Token de autenticación para endpoints privilegiados.

```bash
# Generar un token seguro:
openssl rand -hex 32

# Ejemplo:
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### PORT (Opcional)
Puerto en el que escucha la API. Por defecto: `3000`

```bash
PORT=3000
```

### SUDO_PASSWORD (Opcional)
Contraseña de sudo para comandos privilegiados. 

⚠️ **NOTA DE SEGURIDAD:** Es recomendable configurar sudoers sin NOPASSWD en lugar de almacenar contraseñas en texto plano.

```bash
SUDO_PASSWORD=tu-contraseña-aqui
```

### LOG_LEVEL (Opcional)
Nivel de logging de la aplicación. Opciones: `debug`, `info`, `warn`, `error`

```bash
LOG_LEVEL=info
```

### ENABLE_PRIVILEGED_ENDPOINTS (Opcional)
Habilitar o deshabilitar los endpoints privilegiados. Por defecto: `true`

```bash
ENABLE_PRIVILEGED_ENDPOINTS=true
```

### ALLOW_SUDO_COMMANDS (Opcional)
Permitir ejecución de comandos con sudo. Por defecto: `true`

```bash
ALLOW_SUDO_COMMANDS=true
```

### MAX_COMMAND_TIMEOUT (Opcional)
Máximo tiempo de ejecución para comandos en milisegundos. Por defecto: `300000` (5 minutos)

```bash
MAX_COMMAND_TIMEOUT=300000
```

### ALLOWED_SCRIPT_PATHS (Opcional)
Rutas permitidas para ejecutar scripts (separadas por coma)

```bash
ALLOWED_SCRIPT_PATHS=/home/user/scripts,/opt/orchestrator/scripts
```

### ALERT_EMAIL (Opcional)
Email para recibir alertas de operaciones críticas

```bash
ALERT_EMAIL=admin@example.com
```

### WEBHOOK_LOG_URL (Opcional)
URL de webhook para logging remoto

```bash
WEBHOOK_LOG_URL=https://logs.example.com/vps-orchestrator
```

## 🚀 Configuración Rápida

### 1. Copiar archivo de ejemplo
```bash
cd api
cp .env.example .env
```

### 2. Generar token seguro
```bash
openssl rand -hex 32
```

### 3. Editar `.env` con tu editor favorito
```bash
nano .env
```

### 4. Configurar variables
```env
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
PORT=3000
LOG_LEVEL=info
SUDO_PASSWORD=mi-contraseña
```

### 5. Iniciar la API
```bash
npm run dev
```

## 🔒 Seguridad

### Protección de Credenciales

1. **Token API**
   - Genera con: `openssl rand -hex 32`
   - Almacena en `.env` (no en repositorio)
   - Rota periódicamente
   - No lo compartas por texto plano

2. **Contraseña de Sudo**
   - Evita guardarla en `.env` cuando sea posible
   - Usa sudoers con NOPASSWD en su lugar
   - Si la usas, asegura permisos del archivo: `chmod 600 .env`

3. **Archivo `.env`**
   - Siempre con permisos: `chmod 600 api/.env`
   - Nunca commitear al repositorio
   - Usar `.env.example` como plantilla

### Checklist de Seguridad

- [ ] Archivo `.env` no commitido (verificar `.gitignore`)
- [ ] Permisos correctos: `chmod 600 api/.env`
- [ ] Token generado con cryptografía fuerte
- [ ] Contraseña no compartida en repositorios
- [ ] `.env.example` sin credenciales reales
- [ ] Diferentes tokens para dev/prod/staging

## 📚 Ejemplo `.env` Completo

```env
# API Configuration
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
PORT=3000

# Security
SUDO_PASSWORD=mi-contraseña-segura
ENABLE_PRIVILEGED_ENDPOINTS=true
ALLOW_SUDO_COMMANDS=true

# Commands
MAX_COMMAND_TIMEOUT=300000
ALLOWED_SCRIPT_PATHS=/home/sebss/apps/VPSLocalOrchestrator/scripts

# Logging
LOG_LEVEL=info

# Notifications (Opcional)
ALERT_EMAIL=admin@example.com
WEBHOOK_LOG_URL=https://logs.example.com/vps
```

## 🔄 Rotación de Token

Para cambiar el token sin downtime:

```bash
# 1. Generar nuevo token
NEW_TOKEN=$(openssl rand -hex 32)
echo $NEW_TOKEN

# 2. Guardar en .env
sed -i "s/^API_TOKEN=.*/API_TOKEN=$NEW_TOKEN/" api/.env

# 3. Reiniciar API
npm run dev

# 4. Actualizar credenciales en n8n u otros servicios
```

## 🐛 Troubleshooting

### Error: "Variables de entorno requeridas no encontradas"
```bash
# Verificar que .env existe
ls -la api/.env

# Copiar desde .env.example
cp api/.env.example api/.env

# Editar y configurar
nano api/.env
```

### Error: "Invalid API token"
- Verificar que API_TOKEN en `.env` está correctamente configurado
- No debe tener espacios extras
- Debe coincidir exactamente con el que uses en las peticiones

### Token expirado/revocado
- Cambiar API_TOKEN en `.env`
- Reiniciar la API
- Notificar a clientes que usen el nuevo token

## 📖 Variables de Entorno en Producción

### Usando systemd
```ini
# /etc/systemd/system/vps-orchestrator.service
[Service]
EnvironmentFile=/home/user/vps-orchestrator/.env
ExecStart=/usr/bin/npm run dev
```

### Usando Docker
```dockerfile
# Dockerfile
ENV API_TOKEN=${API_TOKEN}
ENV PORT=${PORT}
```

### Usando PM2
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'vps-orchestrator',
    script: 'npm',
    args: 'run dev',
    env_file: '.env',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

## ⚠️ IMPORTANTE

- **NUNCA** commitees `.env` al repositorio
- **SIEMPRE** usa `.env.example` como plantilla
- **SIEMPRE** protege el archivo con permisos: `chmod 600`
- **SIEMPRE** genera tokens fuertes con `openssl rand -hex 32`
- **SIEMPRE** rota credenciales regularmente
- **NUNCA** compartas credenciales por chat o email
