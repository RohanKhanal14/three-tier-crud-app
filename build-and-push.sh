#!/usr/bin/env bash
# =============================================================================
# build-and-push.sh
# Builds a Docker image, applies version + git SHA tags, pushes to Docker Hub.
#
# Usage:
#   APP_VERSION=v1.2.0 DOCKERHUB_USERNAME=yourname ./build-and-push.sh
#
# Required environment variables:
#   DOCKERHUB_USERNAME  — your Docker Hub username
#   APP_VERSION         — semantic version, e.g. v1.2.0
#
# Optional:
#   IMAGE_NAME          — repo name (default: registry-lab)
#   DOCKERFILE          — path to Dockerfile (default: ./Dockerfile)
#   BUILD_CONTEXT       — build context path (default: .)
# =============================================================================

set -euo pipefail
# set -e  → exit immediately if any command fails
# set -u  → treat unset variables as errors
# set -o pipefail → catch failures inside pipelines (e.g. cmd1 | cmd2)

# ── Color output ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }

# ── Load .env if it exists ────────────────────────────────────────────────────
if [[ -f .env ]]; then
  info "Loading .env file"
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

# ── Validate required variables ───────────────────────────────────────────────
[[ -z "${DOCKERHUB_USERNAME:-}" ]] && error "DOCKERHUB_USERNAME is not set."
[[ -z "${APP_VERSION:-}" ]]        && error "APP_VERSION is not set. Example: APP_VERSION=v1.0.0"

# Validate version format: must start with 'v' followed by semver
if ! echo "${APP_VERSION}" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
  error "APP_VERSION '${APP_VERSION}' is not valid semver. Use format: v1.2.3"
fi

# ── Configuration ─────────────────────────────────────────────────────────────
IMAGE_NAME="${IMAGE_NAME:-three-tier-crud-app-backend}"
DOCKERFILE="${DOCKERFILE:-backend/Dockerfile}"
BUILD_CONTEXT="${BUILD_CONTEXT:-.}"
FULL_IMAGE="${DOCKERHUB_USERNAME}/${IMAGE_NAME}"

# ── Get git SHA ───────────────────────────────────────────────────────────────
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  error "Not inside a git repository. git SHA cannot be determined."
fi

GIT_SHA=$(git rev-parse --short HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
GIT_DIRTY=""
if ! git diff --quiet || ! git diff --cached --quiet; then
  GIT_DIRTY="-dirty"
  warn "Working directory has uncommitted changes. SHA will be marked as ${GIT_SHA}${GIT_DIRTY}"
fi

# ── Print build summary ───────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Docker Build & Push                         ${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════${RESET}"
echo -e "  Image      : ${FULL_IMAGE}"
echo -e "  Version    : ${APP_VERSION}"
echo -e "  Git SHA    : ${GIT_SHA}${GIT_DIRTY}"
echo -e "  Branch     : ${GIT_BRANCH}"
echo -e "  Dockerfile : ${DOCKERFILE}"
echo -e "${BOLD}══════════════════════════════════════════════${RESET}"
echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
info "Building image..."

docker build \
  --file "${DOCKERFILE}" \
  --build-arg APP_VERSION="${APP_VERSION}" \
  --build-arg GIT_SHA="${GIT_SHA}${GIT_DIRTY}" \
  --tag "${FULL_IMAGE}:local" \
  "${BUILD_CONTEXT}"

success "Build complete"

# ── Tag ───────────────────────────────────────────────────────────────────────
info "Applying tags..."

TAG_VERSION="${FULL_IMAGE}:${APP_VERSION}"
TAG_SHA="${FULL_IMAGE}:git-${GIT_SHA}${GIT_DIRTY}"
TAG_LATEST="${FULL_IMAGE}:latest"

docker tag "${FULL_IMAGE}:local" "${TAG_VERSION}"
docker tag "${FULL_IMAGE}:local" "${TAG_SHA}"
docker tag "${FULL_IMAGE}:local" "${TAG_LATEST}"

echo "  → ${TAG_VERSION}"
echo "  → ${TAG_SHA}"
echo "  → ${TAG_LATEST}"
success "Tags applied"

# ── Push ─────────────────────────────────────────────────────────────────────
info "Pushing to Docker Hub..."

docker push "${TAG_VERSION}"
docker push "${TAG_SHA}"
docker push "${TAG_LATEST}"

success "All tags pushed"

# ── Final summary ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  Build & Push Complete ✓${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════${RESET}"
echo -e "  Pushed tags:"
echo -e "    docker pull ${TAG_VERSION}"
echo -e "    docker pull ${TAG_SHA}"
echo -e "    docker pull ${TAG_LATEST}"
echo -e ""
echo -e "  Docker Hub:"
echo -e "    https://hub.docker.com/r/${DOCKERHUB_USERNAME}/${IMAGE_NAME}/tags"
echo -e "${BOLD}══════════════════════════════════════════════${RESET}"
echo ""