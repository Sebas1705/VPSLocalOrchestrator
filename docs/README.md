# 📚 Documentación Completa

Bienvenido a la documentación del **VPS Local Orchestrator API**. Aquí encontrarás todo lo que necesitas para instalar, configurar, usar e integrar la API.

## 🗺️ Mapa de Documentación

### 🚀 **Inicio Rápido**
| Página | Contenido |
|--------|----------|
| [`docs/setup/INSTALLATION.md`](setup/INSTALLATION.md) | Instalación paso a paso |
| [`docs/guides/CONFIGURATION.md`](guides/CONFIGURATION.md) | Sistema de configuración privada |
| [`docs/guides/ENVIRONMENT.md`](guides/ENVIRONMENT.md) | Variables de entorno |

### 🔐 **Seguridad & Autenticación**
| Página | Contenido |
|--------|----------|
| [`docs/guides/AUTHENTICATION.md`](guides/AUTHENTICATION.md) | Token Bearer y privilegios |
| [`docs/api/ENDPOINTS.md`](api/ENDPOINTS.md) | Referencia de endpoints |

### 📡 **API & Ejemplos**
| Página | Contenido |
|--------|----------|
| [`docs/api/ENDPOINTS.md`](api/ENDPOINTS.md) | Documentación completa de endpoints |
| [`docs/examples/CURL.md`](examples/CURL.md) | 20+ ejemplos con curl |
| [`docs/examples/N8N.md`](examples/N8N.md) | Integración con n8n |

### 👨‍💻 **Desarrollo**
| Página | Contenido |
|--------|----------|
| [`docs/CONTRIBUTING.md`](CONTRIBUTING.md) | Guía de contribución |
| [`docs/setup/DEVELOPMENT.md`](setup/DEVELOPMENT.md) | Setup de desarrollo |

### 📋 **Referencia**
| Página | Contenido |
|--------|----------|
| [`docs/TROUBLESHOOTING.md`](TROUBLESHOOTING.md) | Solución de problemas |
| [`docs/FAQ.md`](FAQ.md) | Preguntas frecuentes |

---

## 🎯 ¿Por Dónde Empiezo?

### 👶 Si es mi primera vez
1. Leer [`README.md`](../README.md) para visión general
2. Ver [`docs/setup/INSTALLATION.md`](setup/INSTALLATION.md) para instalar
3. Seguir [`docs/examples/CURL.md`](examples/CURL.md) para primeros tests

### 🔑 Si necesito autenticación
1. Ir a [`docs/guides/AUTHENTICATION.md`](guides/AUTHENTICATION.md)
2. Generar token seguro
3. Usar en peticiones con `Authorization: Bearer TOKEN`

### ⚙️ Si necesito configurar
1. Leer [`docs/guides/CONFIGURATION.md`](guides/CONFIGURATION.md)
2. Revisar [`docs/guides/ENVIRONMENT.md`](guides/ENVIRONMENT.md)
3. Crear `.env` basado en `.env.example`

### 🔗 Si integro con n8n
1. Ir a [`docs/examples/N8N.md`](examples/N8N.md)
2. Copiar workflow examples
3. Ajustar URLs y tokens

### 👨‍💻 Si quiero contribuir
1. Clonar repositorio
2. Seguir [`docs/CONTRIBUTING.md`](CONTRIBUTING.md)
3. Crear feature en rama develop

### 🆘 Si tengo problemas
1. Revisar [`docs/TROUBLESHOOTING.md`](TROUBLESHOOTING.md)
2. Buscar en [`docs/FAQ.md`](FAQ.md)
3. Abrir issue en GitHub

---

## 📖 Estructura de la Documentación

```
docs/
├── README.md                          # (Este archivo) Guía de documentación
├── CONTRIBUTING.md                    # Guía de contribución
├── TROUBLESHOOTING.md                 # Solución de problemas
├── FAQ.md                             # Preguntas frecuentes
├── guides/
│   ├── AUTHENTICATION.md              # Autenticación con token
│   ├── CONFIGURATION.md               # Sistema de configuración
│   └── ENVIRONMENT.md                 # Variables de entorno
├── api/
│   ├── ENDPOINTS.md                   # Referencia de endpoints
│   └── EXAMPLES.md                    # Ejemplos avanzados
├── examples/
│   ├── CURL.md                        # 20+ ejemplos con curl
│   └── N8N.md                         # Integración n8n
└── setup/
    ├── INSTALLATION.md                # Instalación
    └── DEVELOPMENT.md                 # Setup de desarrollo
```

---

## 🌟 Funcionalidades Principales

### 📡 **API REST**
- 10+ endpoints para ejecutar comandos y monitorear recursos
- Health checks y status endpoints
- Batch execution de múltiples comandos

### 🔐 **Seguridad**
- Acceso solo desde localhost (127.0.0.1)
- Autenticación por token Bearer
- Validación timing-safe contra timing attacks
- Comandos sensibles requieren token

### 💻 **Ejecución de Comandos**
- Ejecutar comandos del sistema
- Timeout configurable
- Streaming para comandos largos
- Manejo de stderr/stdout

### 📊 **Monitoreo de Recursos**
- CPU, memoria, disco
- Listado de procesos
- Terminación de procesos
- Uptime del sistema

### ⚙️ **Gestión de Servicios**
- Controlar servicios systemctl
- Start, stop, restart, enable, disable
- Verificar status
- Requiere token

### 🔑 **Configuración**
- Variables de entorno con validación
- Archivo `.env` privado
- Plantilla `.env.example` pública
- Protección con `.gitignore`

### 📝 **Logging**
- Niveles configurables (debug, info, warn, error)
- Logging centralizado
- Seguro (no expone credenciales)

---

## 🚀 Quick Commands

```bash
# Instalación
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api
npm install && cp .env.example .env

# Generar token
openssl rand -hex 32

# Iniciar desarrollo
npm run dev

# Iniciar producción
npm run build && npm start

# Test básico
curl http://127.0.0.1:3000/health
```

---

## 🔗 Enlaces Importantes

- 🏠 [GitHub Repository](https://github.com/Sebas1705/VPSLocalOrchestrator)
- 📖 [README Principal](../README.md)
- 🐛 [Issues](https://github.com/Sebas1705/VPSLocalOrchestrator/issues)
- 🔄 [Pull Requests](https://github.com/Sebas1705/VPSLocalOrchestrator/pulls)

---

## ✅ Checklist de Setup Completo

- [ ] Clonar repositorio
- [ ] Instalar dependencias: `npm install`
- [ ] Copiar `.env.example` a `.env`
- [ ] Generar token: `openssl rand -hex 32`
- [ ] Editar `.env` con token y puerto
- [ ] Iniciar servidor: `npm run dev`
- [ ] Probar health: `curl http://127.0.0.1:3000/health`
- [ ] Leer documentación según necesidad

---

## 💡 Tips Útiles

1. **No encontraste lo que buscas?** Usa Ctrl+F para buscar en la documentación
2. **¿Es tu primer commit?** Revisa [`docs/CONTRIBUTING.md`](CONTRIBUTING.md)
3. **¿Token expirado?** Generar nuevo con `openssl rand -hex 32`
4. **¿Problemas en instalación?** Ver [`docs/TROUBLESHOOTING.md`](TROUBLESHOOTING.md)
5. **¿Preguntas frecuentes?** Revisar [`docs/FAQ.md`](FAQ.md)

---

## 📞 Soporte

- 📖 Documentación: Estás aquí
- 🐛 Bugs: [Issues en GitHub](https://github.com/Sebas1705/VPSLocalOrchestrator/issues)
- 💬 Preguntas: Abre una discusión
- 📧 Email: Contactar al autor

---

**Última actualización**: Diciembre 2025
**Versión**: 1.0.0
**Estado**: Producción ✅
