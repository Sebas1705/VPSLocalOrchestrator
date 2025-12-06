# 🚀 VPS Local Orchestrator API

**API REST para orquestar recursos del sistema y ejecutar comandos desde localhost. Diseñada para integración con n8n y automatización local de tareas críticas.**

[![Node.js](https://img.shields.io/badge/Node.js-v24.11.1-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.2.1-lightgrey)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)]()

---

## 🎯 ¿Qué es VPS Local Orchestrator?

Una **API REST** minimalista pero potente que permite:
- ✨ **Ejecutar comandos del sistema** desde n8n (o cualquier cliente HTTP)
- 📊 **Monitorear recursos** en tiempo real (CPU, memoria, disco, procesos)
- 🔄 **Gestionar servicios** systemd (start, stop, restart, status)
- 🔐 **Acceso seguro** restringido a localhost con autenticación Bearer token
- 🌍 **Integración perfecta** con n8n para automatización de tareas locales

Es como tener un **agente de automatización** directamente en tu servidor, sin necesidad de instalaciones complejas.

---

## 📋 Contenido Rápido

| Pregunta | Respuesta |
|----------|-----------|
| **¿Qué es?** | API REST que ejecuta comandos de sistema desde localhost |
| **¿Por qué?** | Automatizar tareas locales con n8n de forma segura y simple |
| **¿Cómo empieza?** | Ver [Quick Start](#-quick-start) abajo (5 minutos) |
| **¿Documentación?** | Todo detallado en [`docs/`](docs/) |
| **¿Ejemplos?** | 20+ ejemplos en [`docs/examples/CURL.md`](docs/examples/CURL.md) |
| **¿Seguro?** | Sí, localhost-only + token Bearer + validaciones

---

## ✨ Características Principales

- ✅ **API REST** con 10+ endpoints funcionales
- ✅ **Seguridad multicapa**: localhost-only + token Bearer + validaciones
- ✅ **Ejecución de comandos** con timeout configurable (por defecto 30s)
- ✅ **Monitoreo de recursos**: CPU, memoria, disco, procesos en tiempo real
- ✅ **Gestión de servicios**: systemctl integration nativa
- ✅ **Integración n8n** lista para usar con ejemplos incluidos
- ✅ **TypeScript** con tipado completo end-to-end
- ✅ **Documentación exhaustiva** con 20+ ejemplos
- ✅ **Logs centralizados** con rotación automática
- ✅ **Manejo de errores** inteligente y environment-aware
- ✅ **Validaciones** contra DoS y ataques comunes
- ✅ **Totalmente funcional** en producción

---

## 🏃 Quick Start (5 minutos)

### 1️⃣ Clonar y Instalar
```bash
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api
npm install
```

### 2️⃣ Configurar
```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Generar token seguro
openssl rand -hex 32  # Copiar este valor en API_TOKEN del .env

# Editar configuración si es necesario
nano .env
```

Variables principales en `.env`:
```bash
NODE_ENV=development          # development o production
API_PORT=3000                 # Puerto donde corre la API
API_TOKEN=tu-token-aqui       # Token Bearer para endpoints privilegiados
```

### 3️⃣ Ejecutar
```bash
# Desarrollo (con hot reload)
npm run dev

# Producción
npm run build && npm start
```

### 4️⃣ Verificar que funciona
```bash
curl http://127.0.0.1:3000/health
```

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "2025-12-06T10:30:45.123Z",
  "uptime": 5.234
}
```

🎉 **¡Listo!** Tu API está corriendo.

---

## 📡 API Endpoints - Resumen Rápido

### ✅ Públicos (sin autenticación)

```bash
# Health check
GET /health

# Obtener información del sistema
GET /api/resources

# Listar procesos activos
GET /api/resources/processes

# Ejecutar comando simple
POST /api/command/execute
Content-Type: application/json
{ "command": "whoami" }

# Obtener info de proceso específico
GET /api/resources/process/:pid

# Terminar proceso
DELETE /api/resources/process/:pid
```

### 🔒 Privilegiados (requieren token)

```bash
# Ejecutar comando con permisos
POST /api/privileged/execute
Authorization: Bearer YOUR_TOKEN_HERE
{ "command": "systemctl status nginx" }

# Gestionar servicios systemd
POST /api/privileged/service
Authorization: Bearer YOUR_TOKEN_HERE
{ "service": "nginx", "action": "restart" }
```

**Cómo usar el token:**
```bash
# En header HTTP
Authorization: Bearer YOUR_TOKEN_HERE
```

Para documentación completa: [`docs/api/ENDPOINTS.md`](docs/api/ENDPOINTS.md)

---

## 🔐 Seguridad - Lo que Necesitas Saber

| Aspecto | Implementación | Estado |
|---------|---|---|
| **Acceso remoto** | ❌ Solo localhost (127.0.0.1, ::1) | ✅ Bloqueado |
| **Autenticación** | ✅ Token Bearer (crypto.timingSafeEqual) | ✅ Implementado |
| **Credenciales** | ✅ `.env` privado en `.gitignore` | ✅ Protegido |
| **Comandos sensibles** | ✅ Requieren token Bearer | ✅ Implementado |
| **Validación de entrada** | ✅ Longitud de comando (máx 10KB) | ✅ Implementado |
| **DoS Protection** | ✅ Límites de tamaño de payload | ✅ Implementado |
| **Error logging** | ✅ Environment-aware (prod vs dev) | ✅ Implementado |
| **Timeout en comandos** | ✅ Por defecto 30 segundos | ✅ Implementado |

### Principios de Seguridad

1. **Localhost-only**: La API SOLO responde desde 127.0.0.1 (tunel SSH para acceso remoto)
2. **Token Bearer**: Endpoints sensibles requieren `Authorization: Bearer TOKEN`
3. **Validaciones estrictas**: Longitud máxima de comandos, tipos de datos, formato de JSON
4. **Error handling seguro**: En producción, los errores NO exponen stacktraces
5. **No credenciales en código**: Todo en `.env.example` (plantilla segura)

---

## 🔗 Integración n8n - Ejemplo Práctico

### Caso: Ejecutar comando cada 5 minutos

En n8n, crea un workflow con **HTTP Request**:

**Configuración del nodo:**
```json
{
  "method": "POST",
  "url": "http://127.0.0.1:3000/api/privileged/execute",
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN_HERE",
    "Content-Type": "application/json"
  },
  "body": {
    "command": "df -h | grep /dev/"
  }
}
```

**Respuesta típica:**
```json
{
  "success": true,
  "stdout": "/dev/sda1       100G   45G   55G  45%  /\n",
  "stderr": "",
  "exitCode": 0,
  "executionTime": 234
}
```

Luego, procesa con otros nodos: filtrar, alertar, guardar en BD, etc.

Para 20+ ejemplos más: [`docs/examples/N8N.md`](docs/examples/N8N.md)

---

## 📚 Documentación Completa (Índice)

Toda la documentación está organizada en la carpeta [`docs/`](docs/):

### 🚀 **Empezar**
| Archivo | Contenido |
|---------|----------|
| [`docs/INDEX.md`](docs/INDEX.md) | 📍 Índice y guía de navegación |
| [`docs/setup/INSTALLATION.md`](docs/setup/INSTALLATION.md) | Instalación paso a paso |
| [`docs/setup/DEVELOPMENT.md`](docs/setup/DEVELOPMENT.md) | Setup del entorno de desarrollo |

### 🔐 **Seguridad & Configuración**
| Archivo | Contenido |
|---------|----------|
| [`docs/guides/AUTHENTICATION.md`](docs/guides/AUTHENTICATION.md) | Token Bearer, privilegios, seguridad |
| [`docs/guides/CONFIGURATION.md`](docs/guides/CONFIGURATION.md) | Sistema de configuración `.env` |
| [`docs/guides/ENVIRONMENT.md`](docs/guides/ENVIRONMENT.md) | Referencia completa de variables |

### 📡 **API & Ejemplos**
| Archivo | Contenido |
|---------|----------|
| [`docs/api/ENDPOINTS.md`](docs/api/ENDPOINTS.md) | Documentación técnica de todos los endpoints |
| [`docs/examples/CURL.md`](docs/examples/CURL.md) | 20+ ejemplos con curl |
| [`docs/examples/N8N.md`](docs/examples/N8N.md) | Workflows de integración n8n |

### 👨‍💻 **Desarrollo & Soporte**
| Archivo | Contenido |
|---------|----------|
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) | Guía de contribución |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Solución de problemas comunes |
| [`docs/FAQ.md`](docs/FAQ.md) | Preguntas frecuentes |

### 📊 **Análisis & Roadmap**
| Archivo | Contenido |
|---------|----------|
| [`FEATURE_ROADMAP.md`](FEATURE_ROADMAP.md) | 12 categorías de features futuras |
| [`ANALYSIS_SUMMARY.md`](ANALYSIS_SUMMARY.md) | Análisis pre-merge de seguridad |
| [`MERGE_INSTRUCTIONS.md`](MERGE_INSTRUCTIONS.md) | Instrucciones para merge a main |

---

## 💻 Requisitos del Sistema

| Requisito | Mínimo | Recomendado | Probado |
|-----------|--------|-------------|---------|
| **Node.js** | 18.0 | 20.x+ | 24.11.1 |
| **npm** | 9.0 | 10.x+ | 10.8.3 |
| **OS** | Linux | Linux/Mac | Linux |
| **RAM** | 256 MB | 512 MB | 1 GB+ |
| **Disco** | 50 MB | 100 MB | 500 MB |

**Windows**: Soportado vía WSL2

---

## 🚀 Modos de Ejecución

### Modo Desarrollo
```bash
npm run dev
```
**Perfecto para:**
- 🔨 Desarrollo local
- 🐛 Debugging
- 📝 Edición de código

**Características:**
- Hot reload automático
- Logs detallados con colores
- Errores con stack trace completo
- TypeScript compilado en memoria

### Modo Producción
```bash
npm run build      # Compilar TypeScript
npm start          # Ejecutar
```

**Perfecto para:**
- 🌍 Servidores en vivo
- 📊 Entornos críticos
- ⚡ Performance máxima

**Características:**
- Binarios pre-compilados
- Logs comprimidos
- Error handling minimal
- Monitoreo de recursos optimizado

---

## 💡 Casos de Uso Reales

### 1️⃣ Monitoreo de Sistema (cada 5 min)
```
n8n (Time trigger)
  → POST /api/resources
  → CPU > 80%?
  → Enviar alerta Slack
```

### 2️⃣ Backup Automático (cada noche)
```
n8n (Cron: 2 AM)
  → POST /api/privileged/execute
  → Comando: ./backup.sh
  → Guardar resultado en BD
```

### 3️⃣ Gestión de Servicios (cuando falla)
```
n8n (Webhook)
  → GET /api/resources/process/:nginx-pid
  → Status = dead?
  → POST /api/privileged/service (restart)
  → Notificar en Teams
```

### 4️⃣ Limpieza de Archivos (semanalmente)
```
n8n (Time trigger)
  → POST /api/privileged/execute
  → find /tmp -mtime +7 -delete
  → Log resultados
```

### 5️⃣ Sincronización de Config (cuando actualiza BD)
```
n8n (Database change trigger)
  → POST /api/privileged/execute
  → systemctl reload nginx
  → Verificar con GET /health
```

---

## 🧪 Estado del Proyecto

| Aspecto | Estado | Notas |
|---------|--------|-------|
| **Funcionalidad** | ✅ Completo | 10+ endpoints, todos operativos |
| **Autenticación** | ✅ Seguro | Token Bearer con validaciones |
| **Documentación** | ✅ Exhaustiva | 15+ archivos, 20+ ejemplos |
| **TypeScript** | ✅ Tipado | 100% end-to-end, no `any` |
| **Seguridad** | ✅ Auditado | 3 vulnerabilidades identificadas y corregidas |
| **Testing** | ⏳ Pending | Tests unitarios en roadmap |
| **CI/CD** | ⏳ Pending | GitHub Actions en roadmap |
| **Producción** | ✅ Listo | Usado actualmente en servidores |

### Mejoras Implementadas Recientemente

✅ Validación de longitud de comando (DoS protection)
✅ Error handler environment-aware
✅ Documentación reorganizada en `/docs`
✅ 20+ ejemplos prácticos con curl
✅ Guías de seguridad y autenticación
✅ Feature roadmap con 12 categorías

---

## 🆘 Necesitas Ayuda?

### 👶 **Soy nuevo, ¿por dónde empiezo?**
1. Lee esta sección "Quick Start" arriba ⬆️
2. Ve a [`docs/setup/INSTALLATION.md`](docs/setup/INSTALLATION.md) para detalles
3. Prueba los ejemplos en [`docs/examples/CURL.md`](docs/examples/CURL.md)

### 🔑 **Necesito autenticación/tokens**
→ [`docs/guides/AUTHENTICATION.md`](docs/guides/AUTHENTICATION.md)

### ⚙️ **Necesito configurar variables de entorno**
→ [`docs/guides/CONFIGURATION.md`](docs/guides/CONFIGURATION.md) + [`docs/guides/ENVIRONMENT.md`](docs/guides/ENVIRONMENT.md)

### 🔗 **Quiero integrar con n8n**
→ [`docs/examples/N8N.md`](docs/examples/N8N.md)

### 🐛 **Algo no funciona**
1. Checa [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
2. Busca en [`docs/FAQ.md`](docs/FAQ.md)
3. Abre issue: [GitHub Issues](https://github.com/Sebas1705/VPSLocalOrchestrator/issues)

### 👨‍💻 **Quiero contribuir/hacer cambios**
→ [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)

---

## 📊 Roadmap Futuro

Tenemos planeadas estas mejoras para los próximos meses:

### Tier 1 (Próximas 4-6 semanas) - Alta Prioridad
- 📡 Network Monitoring (estadísticas de red)
- 🏥 Service Health Checks (detección automática de problemas)
- 📊 Advanced Logging (logs centralizados)
- ⚙️ Process Priority Control (nice, affinity, pause/resume)

### Tier 2 (Siguientes 6-8 semanas)
- 📁 File Operations (upload, delete, move)
- 💾 Backup/Restore automático
- 🔐 Secrets Manager
- 🔗 Webhooks/Events

### Tier 3 (Q2 2026)
- 🔄 Workflow Engine
- 🐳 Docker Integration
- 📈 Custom Metrics
- 🔔 Advanced Notifications

Ver detalles completos: [`FEATURE_ROADMAP.md`](FEATURE_ROADMAP.md)

---

## 📝 Licencia

MIT License - Eres libre de usar, modificar y distribuir este proyecto.
Ver [`LICENSE`](LICENSE) para detalles.

---

## 👨‍💻 Autor & Contacto

**Creado por:** [@Sebas1705](https://github.com/Sebas1705)

**Enlaces:**
- 🏠 [GitHub Repository](https://github.com/Sebas1705/VPSLocalOrchestrator)
- 🐛 [Reportar bugs](https://github.com/Sebas1705/VPSLocalOrchestrator/issues)
- 💡 [Sugerencias](https://github.com/Sebas1705/VPSLocalOrchestrator/discussions)
- 🔄 [Pull Requests](https://github.com/Sebas1705/VPSLocalOrchestrator/pulls)

---

## 🎯 Próximos Pasos

### Si es tu primera vez:
1. ✅ Completa el [Quick Start](#-quick-start) arriba (5 min)
2. ✅ Lee [`docs/guides/AUTHENTICATION.md`](docs/guides/AUTHENTICATION.md) (10 min)
3. ✅ Prueba ejemplos de [`docs/examples/CURL.md`](docs/examples/CURL.md) (15 min)
4. ✅ Integra con n8n usando [`docs/examples/N8N.md`](docs/examples/N8N.md) (20 min)

### Si quieres entender todo:
→ Consulta el [`docs/INDEX.md`](docs/INDEX.md) para una guía completa de navegación

### Si tienes problemas:
→ [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) + [`docs/FAQ.md`](docs/FAQ.md)

---

**🚀 ¿Listo para empezar? Ve al [Quick Start](#-quick-start) arriba y crea tu primer comando en 5 minutos.**

---

*Última actualización: Diciembre 6, 2025*
*Versión: 1.1.0 (pre-release)*
*Estado: Production Ready*
