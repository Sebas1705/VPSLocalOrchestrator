FROM node:20.11-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# Herramientas de sistema necesarias para los comandos del orchestrator
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates docker.io \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev
COPY tsconfig.json jest.config.js ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM base AS runner
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
ENV PORT=3000
CMD ["node", "dist/index.js"]
