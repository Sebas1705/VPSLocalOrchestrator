# 🔒 AI Model Data Protection Guide

## Overview

This document outlines security measures to prevent unauthorized data sharing with external AI models and services. As this project contains proprietary code and sensitive infrastructure details, it's critical that all team members follow these guidelines.

---

## 🎯 Protection Strategies

### 1. Use Local AI Models (Recommended)

**Advantages:**
- Data never leaves your infrastructure
- Complete control over model behavior
- No external API costs
- Zero data leakage risk

**Tools:**
- **Ollama** - Easy local model deployment
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ollama run codellama
  ```
- **LM Studio** - GUI for local models
- **LocalAI** - OpenAI-compatible local API

**Models:**
- CodeLlama (7B, 13B, 34B)
- Mistral (7B)
- WizardCoder
- StarCoder

---

### 2. Cloud API Data Protection

If you must use cloud APIs:

#### OpenAI
```bash
# Organization settings
# 1. Go to: https://platform.openai.com/account/org-settings
# 2. Enable "Opt out of training" for entire organization
# 3. Set data retention to minimum (30 days)

# API configuration
export OPENAI_API_ORG="org-YOUR_ORG_ID"
export OPENAI_OPT_OUT=1
```

**Best practices:**
- Use organization account (not personal)
- Enable opt-out before any API calls
- Review data usage policy quarterly

#### Anthropic Claude
```bash
# Claude API (Enterprise)
# By default, Anthropic does NOT train on API data
# https://www.anthropic.com/legal/privacy

export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

**Notes:**
- Enterprise API has data protection by default
- Data retention: 90 days
- No training on customer data

#### GitHub Copilot
```json
// .vscode/settings.json
{
  "github.copilot.enable": true,
  "github.copilot.advanced": {
    "inlineSuggestCount": 3,
    "filterSensitiveData": true
  }
}
```

**Configuration:**
1. Use GitHub Business/Enterprise account
2. Enable "Content exclusions" in org settings
3. Add repository to exclusion list if needed

---

### 3. File Protection with `.aiignore`

The `.aiignore` file (in project root) lists files that should NEVER be shared:

```bash
# Check if file exists
ls -la .aiignore

# Verify protection
cat .aiignore
```

**Protected patterns:**
- `.env*` - Environment variables
- `*.key`, `*.pem` - Cryptographic keys
- `*.db`, `*.sqlite` - Databases
- `logs/*.log` - Application logs
- `config/production.*` - Production configs

---

### 4. Code Review Checklist

Before committing AI-generated code:

- [ ] Remove all hardcoded credentials
- [ ] Replace real IPs with placeholders (e.g., `192.168.1.100` → `YOUR_SERVER_IP`)
- [ ] Remove internal domain names
- [ ] Sanitize example data (no real user data)
- [ ] Check for exposed secrets with git-secrets
- [ ] Verify no production configurations included

**Tools:**
```bash
# Install git-secrets
git clone https://github.com/awslabs/git-secrets
cd git-secrets
sudo make install

# Setup in repository
cd /home/sebss/apps/VPSLocalOrchestrator
git secrets --install
git secrets --register-aws
git secrets --add 'password|token|secret|key'
```

---

### 5. Environment Variables

Never commit or share with AI:

```bash
# Good practice: Load from secure vault
export API_TOKEN=$(pass show vps-orchestrator/api-token)

# Bad practice: Hardcoded in code
const token = "tu-token-secreto-aqui"; // ❌ NEVER DO THIS
```

**Secure storage options:**
- **pass** - Unix password manager
- **HashiCorp Vault** - Enterprise secrets management
- **AWS Secrets Manager** - Cloud secrets
- **Azure Key Vault** - Azure secrets

---

### 6. Audit Trail

Log all AI interactions:

```bash
# Create audit log
mkdir -p logs/ai-interactions

# Log AI session
cat > logs/ai-interactions/$(date +%Y%m%d-%H%M%S).log << EOF
Date: $(date)
User: $(whoami)
AI Tool: GitHub Copilot
Task: Refactored authentication middleware
Files Accessed: api/src/middleware/auth.ts
Sensitive Data: None
EOF
```

---

## 🚨 Incident Response

If you suspect data leakage:

1. **Immediate Actions:**
   - Rotate all API keys and tokens
   - Change database passwords
   - Revoke compromised credentials
   - Document the incident

2. **Investigation:**
   - Review AI tool logs
   - Check git history for leaked secrets
   - Scan codebase with `git-secrets`
   - Notify security team

3. **Prevention:**
   - Update `.aiignore` patterns
   - Add pre-commit hooks
   - Train team on policies
   - Review AI tool permissions

---

## 📋 Compliance Checklist

- [ ] Team trained on data protection policies
- [ ] Local AI models configured (optional)
- [ ] Cloud API data opt-out enabled
- [ ] `.aiignore` file created and configured
- [ ] `git-secrets` installed and active
- [ ] Environment variables in secure vault
- [ ] Code review process includes AI checks
- [ ] Audit logging enabled
- [ ] Incident response plan documented
- [ ] Quarterly policy review scheduled

---

## 📚 Additional Resources

- [AGENTS.md - AI Model Data Protection Policy](/AGENTS.md#-ai-model-data-protection-policy)
- [OpenAI Data Usage Policy](https://openai.com/policies/usage-policies)
- [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)
- [GitHub Copilot Privacy](https://docs.github.com/en/copilot/overview-of-github-copilot/about-github-copilot-for-business#data-privacy)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

**Last Updated**: December 8, 2025  
**Policy Owner**: Development Team  
**Review Cycle**: Quarterly
