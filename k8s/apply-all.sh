#!/usr/bin/env bash
set -euo pipefail

# Usage: ./apply-all.sh [namespace]
# If a namespace is provided, the manifests are applied to that namespace.

NAMESPACE=${1:-}
KUBECTL="kubectl"

if command -v kubectl >/dev/null 2>&1; then
  echo "Using kubectl from PATH"
else
  echo "Error: kubectl is not installed or not found in PATH" >&2
  exit 1
fi

apply_manifest() {
  local manifest="$1"
  if [[ -n "$NAMESPACE" ]]; then
    echo "Applying $manifest to namespace $NAMESPACE"
    "$KUBECTL" apply -f "$manifest" -n "$NAMESPACE"
  else
    echo "Applying $manifest"
    "$KUBECTL" apply -f "$manifest"
  fi
}

# db has no runtime dependencies
DB_MANIFESTS=(
  "db/db-pvc.yaml"
  "db/db-deployment.yaml"
  "db/db-svc.yaml"
)

# backend depends on db
BACKEND_MANIFESTS=(
  "backend/be-config.yaml"
  "backend/be-deployement.yaml"
  "backend/be-svc.yaml"
)

# frontend depends on backend
FRONTEND_MANIFESTS=(
  "frontend/fe-deployement.yaml"
  "frontend/fe-svc.yaml"
)

for manifest in "${DB_MANIFESTS[@]}"; do
  apply_manifest "$manifest"
done

for manifest in "${BACKEND_MANIFESTS[@]}"; do
  apply_manifest "$manifest"
done

for manifest in "${FRONTEND_MANIFESTS[@]}"; do
  apply_manifest "$manifest"
done

echo "All manifests applied successfully."
