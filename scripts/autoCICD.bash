#!/bin/bash

###############################################################
##                                                           ##
## Portfolio CICD Deployment Script for webhooks from GitHub ##
##                                                           ##
###############################################################

# Fail fast and safer bash
set -euo pipefail

# Ensure a writable HOME for git inside containers (nodeapp has /nonexistent)
export HOME="/tmp/orchestrator-home"
if [[ ! -d "$HOME" ]]; then
	mkdir -p "$HOME"
fi

# 1. Define variables (tuned for my-portfolio)
APP_DIR="/home/sebss/apps/my-portfolio"
COMPOSE_DIR="/home/sebss/apps/my-portfolio"
CONTAINER_NAME="my-portfolio_web1"
IMAGE_NAME="my-portfolio_app:latest"
REPO_DIR="/home/sebss/apps/my-portfolio"
BREF="release"  # preferred branch; fallback to main if not present

# 2. Navigate to the application directory
echo "[autoCICD] Starting my-portfolio deployment at $APP_DIR"
cd $APP_DIR

# 3. Pull the code
echo "[autoCICD] Updating code from Git (fetch + checkout ${BREF})"
git config --global --add safe.directory "$REPO_DIR"
git config --global --add safe.directory "$REPO_DIR/portfolio"

# Optional: use token if defined (for private repos)
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
	git config --global url."https://${GITHUB_TOKEN}:x-oauth-basic@github.com/".insteadOf "https://github.com/"
fi

git fetch --all --prune

# Switch to preferred branch (prefer remote if exists), or fallback to main
if git show-ref --verify --quiet "refs/remotes/origin/${BREF}"; then
	# Create/force local branch based on remote
	git checkout -B "${BREF}" "origin/${BREF}"
elif git show-ref --verify --quiet "refs/heads/${BREF}"; then
	git checkout "${BREF}"
else
	# Prefer origin/main if it exists, otherwise local main
	if git show-ref --verify --quiet "refs/remotes/origin/main"; then
		git checkout -B main origin/main
	else
		git checkout main
	fi
fi

# Fast-forward update current branch from its remote if it exists
git pull --ff-only || true

echo "[autoCICD] Code updated on branch $(git rev-parse --abbrev-ref HEAD)"

# 4. Rebuild the Docker image (The build is done by 'docker-compose')
# 4. Navigate to the Docker Compose directory
echo "[autoCICD] Switching to docker compose directory: $COMPOSE_DIR"
cd "$COMPOSE_DIR"

# 5. Ensure repo safety (for CI runners)
git config --global --add safe.directory "$REPO_DIR"

# 6. Build and deploy using docker compose (rebuild and recreate containers)
# Prefer docker compose v2 (plugin) sharing the same environment as on the host
export DOCKER_CONFIG="/root/.docker"

echo "[autoCICD] Detecting docker compose binary inside the container"

# Detect docker-compose variant (prefer docker compose v2, fallback to docker-compose)
if docker compose version >/dev/null 2>&1; then
	COMPOSE_BIN="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
	COMPOSE_BIN="docker-compose"
else
	echo "[autoCICD][ERROR] neither 'docker compose' nor 'docker-compose' are available" >&2
	exit 1
fi

echo "[autoCICD] Using compose command: $COMPOSE_BIN"

# 6.1. Safely stop and clean previous stack (to avoid name conflicts)
echo "[autoCICD] Running down for my-portfolio stack (remove-orphans)"
$COMPOSE_BIN -f "$COMPOSE_DIR/docker-compose.yml" down --remove-orphans || \
	echo "[autoCICD] Warning: could not run down (maybe no previous stack), continuing..." >&2

# 6.2. Rebuild + recreate containers
echo "[autoCICD] Running stack build (DOCKER_BUILDKIT=1, --parallel)"
DOCKER_BUILDKIT=1 $COMPOSE_BIN -f "$COMPOSE_DIR/docker-compose.yml" build --parallel
echo "[autoCICD] Running stack up (recreate + remove-orphans)"
$COMPOSE_BIN -f "$COMPOSE_DIR/docker-compose.yml" up -d --force-recreate --remove-orphans

# 7. Optional cleanup of unused images (safe: does not touch running containers)
echo "[autoCICD] Running cleanup of unused images (docker image prune -f)"
docker image prune -f >/dev/null 2>&1 || \
	echo "[autoCICD] Warning: docker image prune failed, continuing..." >&2

echo "[autoCICD] Deployment finished successfully"

# Optional: prune unused images to save disk (uncomment if desired)
# docker image prune -f