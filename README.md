# 🚀 VPS Local Orchestrator API

**API REST para orquestar recursos del sistema y ejecutar comandos desde localhost. Diseñada para integración con n8n y automatización local.**

[![Node.js](https://img.shields.io/badge/Node.js-v24.11.1-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.2.1-lightgrey)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📋 Contenido Rápido

- **¿Qué es?** → API REST que ejecuta comandos de sistema desde localhost
- **¿Por qué?** → Automatizar tareas locales con n8n de forma segura
- **¿Cómo empieza?** → Ver [Quick Start](#-quick-start) abajo
- **¿Documentación?** → Todo en [`docs/`](docs/)

## ✨ Características Principales

- ✅ **API REST** con 10+ endpoints
- ✅ **Seguridad multicapa**: localhost-only + token Bearer
- ✅ **Ejecución de comandos** con timeout configurable
- ✅ **Monitoreo de recursos**: CPU, memoria, disco, procesos
- ✅ **Gestión de servicios**: systemctl integration
- ✅ **Integración n8n** lista para usar
- ✅ **TypeScript** con tipado completo
- ✅ **Documentación exhaustiva**

## 🏃 Quick Start

### 1️⃣ Clonar y Instalar
```bash
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api
npm install
```

### 2️⃣ Configurar
```bash
cp .env.example .env
nano .env  # Editar con token y puerto
```

Generar token seguro:
```bash
openssl rand -hex 32  # Copiar en API_TOKEN
```

### 3️⃣ Ejecutar
```bash
npm run dev
```

La API estará en `http://127.0.0.1:3000`

### 4️⃣ Probar
```bash
curl http://127.0.0.1:3000/health
```

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "2025-12-06T...",
  "uptime": 5.23
}
```

---

## 📡 Endpoints Principales

### Sin Autenticación 🟢

```bash
# Health check
GET /health

# Ejecutar comando
POST /api/command/execute
{"command": "whoami"}

# Monitoreo de recursos
GET /api/resources

# Listar procesos
GET /api/resources/processes

# Terminar proceso
DELETE /api/resources/process/:pid
```

### Con Token 🔴

```bash
# Comando privilegiado (requiere Authorization header)
POST /api/privileged/execute
{"command": "systemctl status nginx"}

# Gestionar servicio
POST /api/privileged/service
{"service": "nginx", "action": "restart"}
```

**Token en request:**
```bash
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 🔐 Seguridad

| Aspecto | Medida |
|--------|--------|
| **Acceso remoto** | ❌ Bloqueado (solo localhost) |
| **Autenticación** | ✅ Token Bearer |
| **Credenciales** | ✅ Archivo `.env` privado |
| **Comandos sensibles** | ✅ Requieren token |

---

## 🔗 Integración n8n

### Ejemplo Rápido

En n8n, usa nodo **HTTP Request**:

```json
{
  "method": "POST",
  "url": "http://127.0.0.1:3000/api/privileged/execute",
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN",
    "Content-Type": "application/json"
  },
  "body": {
    "command": "df -h"
  }
}
```

Para más, ver [`docs/examples/N8N.md`](docs/examples/N8N.md)

---

## 📚 Documentación Completa

Todo está documentado en la carpeta [`docs/`](docs/):

| Sección | Archivo |
|---------|---------|
| 📖 **Índice de docs** | [`docs/README.md`](docs/README.md) |
| 🚀 **Instalación** | [`docs/setup/INSTALLATION.md`](docs/setup/INSTALLATION.md) |
| 🔑 **Autenticación** | [`docs/guides/AUTHENTICATION.md`](docs/guides/AUTHENTICATION.md) |
| ⚙️ **Configuración** | [`docs/guides/CONFIGURATION.md`](docs/guides/CONFIGURATION.md) |
| 🌍 **Variables de entorno** | [`docs/guides/ENVIRONMENT.md`](docs/guides/ENVIRONMENT.md) |
| 📡 **Referencia de endpoints** | [`docs/api/ENDPOINTS.md`](docs/api/ENDPOINTS.md) |
| 📋 **Ejemplos con curl** | [`docs/examples/CURL.md`](docs/examples/CURL.md) |
| 🔗 **Integración n8n** | [`docs/examples/N8N.md`](docs/examples/N8N.md) |
| 👨‍💻 **Guía de contribución** | [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) |
| 🆘 **Troubleshooting** | [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) |

---

## 📦 Requisitos

- Node.js 18+ (probado en v24.11.1)
- npm 9+
- Linux/Mac (Windows vía WSL)

---

## 🚀 Modos de Ejecución

### Desarrollo
```bash
npm run dev
```
- Reinicia automáticamente al cambiar archivos
- Logs detallados
- Errores completos

### Producción
```bash
npm run build
npm start
```
- Optimizado
- Logs reducidos
- Error handling

---

## 💡 Casos de Uso

- 📊 **Monitoreo**: CPU/memoria cada 5 min desde n8n
- 💾 **Backups**: Scripts automatizados por horario
- 🔄 **Servicios**: Restart automático de aplicaciones
- 🧹 **Limpieza**: Purga de archivos temporales
- 🚨 **Alertas**: Notificaciones por condiciones

---

## 🧪 Estado del Proyecto

- ✅ API funcional y testada
- ✅ Autenticación segura
- ✅ Documentación completa
- ✅ Ejemplos prácticos
- ✅ Listo para producción
- ⏳ Tests automatizados (futuro)
- ⏳ CI/CD pipeline (futuro)

---

## 🆘 Necesitas Ayuda?

1. **Primeros pasos** → [`docs/setup/INSTALLATION.md`](docs/setup/INSTALLATION.md)
2. **Problemas** → [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
3. **Preguntas** → [`docs/FAQ.md`](docs/FAQ.md)
4. **Issue en GitHub** → [Reportar](https://github.com/Sebas1705/VPSLocalOrchestrator/issues)

---

## 📄 Licencia

MIT - Ver [`LICENSE`](LICENSE)

## 👨‍💻 Autor

[@Sebas1705](https://github.com/Sebas1705)

---

## 🔗 Enlaces Útiles

- 🏠 [GitHub Repository](https://github.com/Sebas1705/VPSLocalOrchestrator)
- 📖 [Documentación Completa](docs/)
- 🐛 [Reportar Bugs](https://github.com/Sebas1705/VPSLocalOrchestrator/issues)
- 🔄 [Pull Requests](https://github.com/Sebas1705/VPSLocalOrchestrator/pulls)

---

**¿Listo para empezar?** Sigue los pasos en [Quick Start](#-quick-start) arriba ⬆️
