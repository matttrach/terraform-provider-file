#!/usr/bin/env bash
#
# Helper: rc.sh
# Description: Sources environment variables, functions, and aliases for the development shell.

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
DEV_DIR="${REPO_ROOT}/.dev"

if [[ -f "${DEV_DIR}/variables.sh" ]]; then
  # shellcheck source=/dev/null
  source "${DEV_DIR}/variables.sh"
fi

if [[ -f "${DEV_DIR}/functions.sh" ]]; then
  # shellcheck source=/dev/null
  source "${DEV_DIR}/functions.sh"
fi

if [[ -f "${DEV_DIR}/aliases.sh" ]]; then
  # shellcheck source=/dev/null
  source "${DEV_DIR}/aliases.sh"
fi

# Optionally source personal overrides if they exist
for personal_rc in \
  "${HOME}/.config/functions/default" \
  "${HOME}/.config/alias/default" \
  "${HOME}/.config/github/default" \
  "${HOME}/.config/aws/default" \
  "${HOME}/.config/gemini/default" \
  "${DEV_DIR}/rc.local.sh"; do
  if [[ -f "${personal_rc}" ]]; then
    # shellcheck source=/dev/null
    source "${personal_rc}"
  fi
done
