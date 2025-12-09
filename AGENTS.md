# 🤖 AGENTS.md - Development Rules & Project Structure

## 🌐 Language Policy

All documentation, code comments, and project communication **must be in English**. Any new or updated documentation must be written in English. If any document is found in another language, it must be translated to English immediately.

## 🔒 AI Model Data Protection Policy

**CRITICAL**: This project contains proprietary code and sensitive infrastructure details. All AI assistants and code generation tools **MUST** comply with the following rules:

### Data Sharing Restrictions
1. **No External Training**: Project code, configurations, and documentation must NOT be used to train external AI models
2. **Local Processing Only**: When possible, use local AI models (Ollama, LM Studio) instead of cloud APIs
3. **API Data Policies**: 
   - For OpenAI: Enable organization-level data opt-out
   - For Anthropic: Use enterprise API (no training by default)
   - For GitHub Copilot: Enable business/enterprise mode with data protection

### Sensitive File Protection
Never share or process these files with external AI services:
- `.env`, `.env.*` - Environment variables and secrets
- `*.key`, `*.pem` - Cryptographic keys
- `*.db`, `*.sqlite` - Database files
- `logs/*.log` - Application logs
- `config/production.*` - Production configurations
- Any file containing API tokens, passwords, or credentials

### Compliance Requirements
- **Review Before Commit**: Always review AI-generated code before committing
- **Sanitize Examples**: Remove real tokens, IPs, and credentials from code examples
- **Audit Trail**: Log all AI interactions that process project files
- **Team Awareness**: All team members must be trained on these policies

### Enforcement
Violations of this policy may result in:
- Immediate revocation of AI tool access
- Security audit of affected code
- Potential data breach disclosure requirements

---

## 📋 Versioning Rules

### Version Numbering
Follow Semantic Versioning (SemVer): `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes or major milestones (e.g., v2.0.0)
- **MINOR**: New features, phase completions (e.g., v1.2.0)
- **PATCH**: Bug fixes, improvements, small features (e.g., v1.0.1)

### Version Update Process

1. **Update `api/package.json`**: Change `"version"` field
2. **Update `api/src/index.ts`**: Update version in GET `/` endpoint
3. **Commit**: `git commit -m "bump: version X.X.X - <description>"`
4. **Create release branch**: `git checkout -b release/vX.X.X`
5. **Tag**: `git tag -a vX.X.X -m "Release vX.X.X"`
6. **Push branch and tag**: `git push -u origin release/vX.X.X && git push origin vX.X.X`
7. **Merge to develop**: `git checkout develop && git merge release/vX.X.X`
8. **Push develop**: `git push origin develop`

---

## 📁 Project Structure

### Root Directory
```
VPSLocalOrchestrator/
├── README.md                           # Main documentation
├── AGENTS.md                           # Development rules (this file)
├── .gitignore                          # Git configuration
├── vps-orchestrator.service            # Systemd service file
├── api/                                # API application
└── docs/                               # Documentation
```

### `/api` Directory
```
api/
├── package.json                        # Dependencies and scripts
├── tsconfig.json                       # TypeScript configuration
├── .env                                # Environment variables (NOT in git)
├── src/                                # TypeScript source code
│   ├── index.ts                        # Application entry point
│   ├── config/                         # Configuration
│   ├── middleware/                     # Express middleware
│   ├── routes/                         # API routes
│   ├── services/                       # Business logic services
│   ├── application/                    # Application layer
│   ├── domain/                         # Domain layer
│   └── infrastructure/                 # Infrastructure layer
├── tests/                              # Test files
│   ├── unit/                           # Unit tests
│   └── integration/                    # Integration tests
└── dist/                               # Compiled JavaScript (generated)
```

### `/docs` Directory
```
docs/
├── README.md                           # Documentation index
├── core/                               # Core documentation
│   ├── ENDPOINTS.md                    # API endpoints reference
│   ├── FEATURE_ROADMAP.md              # Feature roadmap
│   └── TESTING.md                      # Testing guide
├── guides/                             # User guides
│   ├── INSTALLATION.md                 # Installation guide
│   ├── CONFIGURATION.md                # Configuration guide
│   └── SECURITY.md                     # Security guide
└── examples/                           # Code examples
    └── ENDPOINT_EXAMPLES.md            # Endpoint usage examples
```

---

## 🔐 Security & Authentication

### Authentication Rules
1. **Protected Endpoints**: All command execution endpoints require Bearer token authentication
2. **Public Endpoints**: Health checks and read-only resource endpoints are public
3. **Token Validation**: Use `timingSafeEqual` to prevent timing attacks
4. **Token Configuration**: Set `API_TOKEN` environment variable in `.env`

### Token Usage
```bash
Authorization: Bearer <your-api-token>
```

---

## 🚀 Build & Execution

### Development Commands
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run tests
npm test

# Run in development mode
npm run dev

# Run compiled server
cd dist && node index.js
```

### Production Deployment
```bash
# Using systemd
sudo systemctl start vps-orchestrator
sudo systemctl status vps-orchestrator
sudo systemctl restart vps-orchestrator

# View logs
sudo journalctl -u vps-orchestrator -f
```

---

## 📝 Development Checklist

When implementing new features:

- [ ] Create service logic in `api/src/services/`
- [ ] Create/update routes in `api/src/routes/`
- [ ] Apply authentication middleware if needed
- [ ] Implement input validation
- [ ] Write unit tests in `api/tests/unit/`
- [ ] Write integration tests in `api/tests/integration/`
- [ ] Update API documentation in `docs/core/ENDPOINTS.md`
- [ ] Compile: `npm run build`
- [ ] Test endpoints manually
- [ ] Run test suite: `npm test`
- [ ] Update version following SemVer
- [ ] Commit with descriptive message
- [ ] Create release tag

---

## 🧪 Testing Guidelines

### Test Structure
- **Unit Tests**: Test individual functions/classes in isolation
- **Integration Tests**: Test API endpoints end-to-end
- **Coverage Goal**: Maintain >80% code coverage

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## 🏗️ Architecture Principles

### Clean Architecture Layers
1. **Domain Layer**: Core business logic, entities, interfaces
2. **Application Layer**: Use cases, DTOs, controllers
3. **Infrastructure Layer**: External dependencies, adapters, repositories

### Dependency Rules
- Dependencies point inward (Infrastructure → Application → Domain)
- Domain layer has no external dependencies
- Use dependency injection for loose coupling

---

## ⚠️ Important Notes

- **TypeScript**: Use `import type` for type-only imports when `verbatimModuleSyntax` is enabled
- **Compilation**: Always compile with `npm run build` before testing
- **ES Modules**: Use dynamic `import()` instead of `require()` for runtime imports
- **Async/Await**: Prefer async/await over callbacks and `.then()` chains
- **Error Handling**: Always handle errors properly, use try-catch blocks
- **Logging**: Use structured logging (JSON format) for production
- **Git**: Keep `develop` as main development branch
- **Middleware**: Always call `next()` in Express middleware to avoid request hanging

---

**Last Updated**: 2025-12-08  
**Current Version**: See `api/package.json`
