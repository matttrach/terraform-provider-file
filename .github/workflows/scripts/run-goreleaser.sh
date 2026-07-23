#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${WORKING_DIR:-}" ]]; then
  cd "${WORKING_DIR}"
fi

ARGS=("--clean")
if [[ "${SKIP_VALIDATE:-false}" == "true" ]]; then
  ARGS+=("--skip=validate")
fi

ARGS+=("--config" "${GORELEASER_CONFIG:-.goreleaser.yml}")

goreleaser release "${ARGS[@]}"
