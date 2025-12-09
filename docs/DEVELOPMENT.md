# Development & Contribution

Version: v1.0.3

## Setup for development
```bash
git clone https://github.com/Sebas1705/VPSLocalOrchestrator.git
cd VPSLocalOrchestrator/api
git checkout develop
npm install
cp docs/examples/.env.example .env
npm run dev
```

## Git workflow
- **main**: production releases
- **develop**: active development (merge target)
- **feature/name**: new features (branch from develop)
- **bugfix/name**: bug fixes (branch from develop)

## Branch and PR process
1. Create feature branch: `git checkout -b feature/name develop`
2. Make changes, commit with semantic messages (e.g., `feat: add`, `fix:`, `docs:`, `test:`)
3. Push and open PR to `develop`
4. After review/CI pass, merge to `develop`
5. Releases merged from `develop` to `main` with tags

## Code standards
- Use TypeScript strict mode
- Follow clean architecture: domain → application → infrastructure
- Write tests for new features (Jest)
- Ensure all tests pass: `npm test`
- Run coverage: `npm run test:coverage` (target 80%)

## AI data protection
- Prefer local AI models (Ollama, LM Studio) for sensitive code
- If using cloud APIs (OpenAI, Anthropic), enable org-level data opt-out
- Never commit `.env`, keys, or real tokens to git

## Release tagging
1. Update version in `package.json` and `src/index.ts`
2. Commit: `git commit -m "bump: version X.X.X"`
3. Tag: `git tag -a vX.X.X -m "Release vX.X.X"`
4. Push tag: `git push origin vX.X.X`

## More details
See original `CONTRIBUTING.md`, `MERGE_INSTRUCTIONS.md`, `AI_DATA_PROTECTION.md` for full procedures.
