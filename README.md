# VPS Local Orchestrator

**Version**: v1.0.0  
**Status**: Production Ready 🚀

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-18%2B-green)
![TypeScript](https://img.shields.io/badge/typescript-5%2B-blue)

A lightweight, production-ready API for orchestrating VPS resources and executing commands locally with enterprise-grade features including RBAC, encryption, event sourcing, and distributed tracing.

## ⚡ Quick Start

```bash
# 1. Clone and setup
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api

# 2. Install and configure
npm install
cp docs/examples/.env.example .env
# Edit .env and set API_TOKEN

# 3. Build and run
npm run build
npm start
```

Server runs at: `http://localhost:3000`

## 📚 Documentation

| Document | Purpose | Time |
|----------|---------|------|
| **[Getting Started](./docs/GETTING_STARTED.md)** | Setup guide + first steps | 5 min |
| **[Architecture](./docs/ARCHITECTURE.md)** | How it's built internally | 15 min |
| **[API Endpoints](./docs/core/ENDPOINTS.md)** | Complete API reference | 10 min |
| **[Examples](./docs/EXAMPLES.md)** | Real usage examples | 5 min |
| **[Feature Roadmap](./docs/core/FEATURE_ROADMAP.md)** | What's built, what's next | 10 min |
| **[Security](./docs/guides/SECURITY.md)** | Security best practices | 10 min |

## 🎯 Key Features

### Core Capabilities
- ✅ **Command Execution** - Single and batch command execution with full output capture
- ✅ **Authentication** - Token-based authentication with timing-safe validation
- ✅ **Service Management** - Start, stop, restart system services
- ✅ **Resource Monitoring** - CPU, memory, disk, network, process monitoring

### Advanced Features
- ✅ **Secure Secrets** - AES-256-GCM encrypted secret vault
- ✅ **Role-Based Access** - Fine-grained RBAC with configurable permissions
- ✅ **Event Sourcing** - Complete audit trail of all operations
- ✅ **Job Queue** - Async job processing with retry logic
- ✅ **Rate Limiting** - Distributed rate limiting per token
- ✅ **Observability** - Prometheus metrics, structured logging, distributed tracing
- ✅ **Circuit Breakers** - Resilience patterns for external calls
- ✅ **Encryption** - Optional end-to-end data encryption

### Enterprise Features
- ✅ **Horizontal Scaling** - Stateless design with distributed cache support
- ✅ **Threat Detection** - Intrusion prevention and anomaly detection
- ✅ **Health Checks** - Kubernetes-ready liveness/readiness probes
- ✅ **OpenAPI** - Auto-generated API documentation

## 🏛️ Architecture

**Layered Architecture** with clean separation of concerns:

```
Presentation (Controllers)
    ↓
Application (Use Cases)
    ↓
Domain (Core Business Logic)
    ↓
Infrastructure (Adapters & Services)
```

- **Clean Architecture**: Domain-driven design with ports & adapters
- **Dependency Injection**: Loose coupling between components
- **Repository Pattern**: Abstract data access
- **Event-Driven**: Event bus for component communication

See [Architecture](./docs/ARCHITECTURE.md) for details.

## 🔒 Security

- **Authentication**: Token-based (Bearer scheme)
- **Authorization**: Role-based access control (RBAC)
- **Encryption**: Optional AES-256-GCM for sensitive data
- **Audit Logging**: Complete operation audit trail
- **Threat Detection**: Real-time intrusion detection

See [Security Guide](./docs/guides/SECURITY.md) for best practices.

## 📊 What's Included (v1.0.0)

42 production-ready features across 8 development phases:

| Phase | Features | Version |
|-------|----------|---------|
| 1. Foundations | Auth, commands, networking | v0.1-v0.6 |
| 2. File & Events | Files, secrets, backups, webhooks | v0.7-v0.12 |
| 3. Analytics | Database, analytics, load balancer | v0.13-v0.18 |
| 4. Clean Architecture | DI, validation, layered architecture | v0.19-v0.24 |
| 5. Observability | Logging, tracing, metrics, health | v0.25-v0.30 |
| 6. Data & Schema | OpenAPI, migrations, audit stream | v0.31-v0.35 |
| 7. Events & Sourcing | Event bus, event sourcing, sagas | v0.36-v0.38 |
| 8. Security | Encryption, RBAC, threat detection | v0.39-v0.40 |

See [Feature Roadmap](./docs/core/FEATURE_ROADMAP.md) for complete list.

## 🚀 Deployment

### Docker
```bash
docker build -t vps-orchestrator .
docker run -e API_TOKEN=your-token -p 3000:3000 vps-orchestrator
```

### Systemd Service
```bash
sudo cp vps-orchestrator.service /etc/systemd/system/
sudo systemctl enable vps-orchestrator
sudo systemctl start vps-orchestrator
```

### Kubernetes
Ready for Kubernetes with:
- Health checks (liveness, readiness, startup probes)
- Configurable resources
- Stateless design for horizontal scaling

## 📦 Tech Stack

- **Node.js** 18+
- **TypeScript** 5+
- **Express.js** 4+
- **Jest** for testing
- **Zod** for validation
- **Prometheus** for metrics
- **OpenTelemetry** for tracing

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

Test coverage: >80% of codebase

## 📈 Performance

- **Latency**: <100ms average (local commands)
- **Throughput**: 1000+ req/s typical
- **Memory**: ~50-100 MB idle
- **Concurrency**: Configurable (default: 100)

## 🛣️ Roadmap (Post v1.0)

**v1.1.0+**: Additional features per roadmap  
**v2.0.0**: Major architecture improvements  

See [Feature Roadmap](./docs/core/FEATURE_ROADMAP.md) for details.

## 🤝 Contributing

We welcome contributions! See [Contributing Guide](./docs/core/CONTRIBUTING.md).

## 📄 License

MIT - See LICENSE file

## 🆘 Support

- 📖 **Documentation**: Check [docs/](./docs/)
- 🐛 **Issues**: Open on [GitHub](https://github.com/Sebas1705/VPSLocalOrchestrator/issues)
- 💬 **Questions**: Check [FAQ](./docs/guides/FAQ.md)

## 🎓 Learn More

1. **First Time?** → [Getting Started](./docs/GETTING_STARTED.md)
2. **Understand Design?** → [Architecture](./docs/ARCHITECTURE.md)
3. **Use API?** → [Endpoints](./docs/core/ENDPOINTS.md)
4. **See Examples?** → [Examples](./docs/EXAMPLES.md)
5. **Deploy?** → [Security](./docs/guides/SECURITY.md)

---

**Made with ❤️ by Sebas1705**

Happy orchestrating! 🚀
