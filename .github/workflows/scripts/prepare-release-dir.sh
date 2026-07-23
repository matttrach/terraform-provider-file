#!/usr/bin/env bash
set -euo pipefail

# Cache starting directory
START_DIR="$(pwd)"

cd "${WORKSPACE}/tags/${TAG}"

# Remove local tags except for the targeted release tag to avoid GoReleaser confusion
tags_to_delete=$(git tag | grep -v -e "^${TAG}$" || true)
if [[ -n "${tags_to_delete}" ]]; then
  echo "${tags_to_delete}" | xargs git tag -d
fi

# Ensure manifest exists for the registry
if [[ ! -f "terraform-registry-manifest.json" ]]; then
  echo "terraform-registry-manifest.json not found, creating a default one."
  cat <<EOF > terraform-registry-manifest.json
{
    "version": 1,
    "metadata": {
        "protocol_versions": ["4.0", "5.0", "6.0"]
    }
}
EOF
fi

cd "${START_DIR}"
