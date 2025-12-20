#!/bin/bash

###############################################################
##                                                           ##
## Portfolio CICD Deployment Script for webhooks from GitHub ##
##                                                           ##
###############################################################

# Fail fast and safer bash
set -euo pipefail

# 1. Define variables (ajustadas a my-portfolio)
APP_DIR="/home/sebss/apps/my-portfolio"
COMPOSE_DIR="/home/sebss/apps/my-portfolio"
CONTAINER_NAME="my-portfolio_web1"
IMAGE_NAME="my-portfolio_app:latest"
REPO_DIR="/home/sebss/apps/my-portfolio"
BREF="release"  # branch preferida; cae a main si no existe

# 2. Navigate to the application directory
cd $APP_DIR

# 3. Pull the code
git config --global --add safe.directory "$REPO_DIR"
git config --global --add safe.directory "$REPO_DIR/portfolio"

# Opcional: usar token si está definido (para repos privados)
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
	git config --global url."https://${GITHUB_TOKEN}:x-oauth-basic@github.com/".insteadOf "https://github.com/"
fi

git fetch --all --prune

# Cambia a la rama preferida (prefiere rama remota si existe), o cae a main si no existe
if git show-ref --verify --quiet "refs/remotes/origin/${BREF}"; then
	# Crear/forzar rama local basada en la remota
	git checkout -B "${BREF}" "origin/${BREF}"
elif git show-ref --verify --quiet "refs/heads/${BREF}"; then
	git checkout "${BREF}"
else
	# Preferir origin/main si existe, sino local main
	if git show-ref --verify --quiet "refs/remotes/origin/main"; then
		git checkout -B main origin/main
	else
		git checkout main
	fi
fi

# Actualizar la rama actual con fast-forward desde su remoto si existe
git pull --ff-only || true

# 4. Rebuild the Docker image (The build is done by 'docker-compose')
# 4. Navigate to the Docker Compose directory
cd "$COMPOSE_DIR"

# 5. Ensure repo safety (for CI runners)
git config --global --add safe.directory "$REPO_DIR"

# 6. Build and deploy using docker compose (rebuild and recreate containers)
DOCKER_BUILDKIT=1 docker compose -f "$COMPOSE_DIR/docker-compose.yml" build --parallel
docker compose -f "$COMPOSE_DIR/docker-compose.yml" up -d --force-recreate --remove-orphans

# Optional: prune unused images to save disk (uncomment if desired)
# docker image prune -f