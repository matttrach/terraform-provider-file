#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${VERSION:-}" ]]; then
  echo "Error: VERSION environment variable is required." >&2
  exit 1
fi

TAG="v${VERSION#v}"
echo "Creating local tag: ${TAG}"

# Check if tag already exists locally
if git rev-parse "${TAG}" >/dev/null 2>&1; then
  echo "Local tag ${TAG} already exists."
else
  git tag "${TAG}"
fi
