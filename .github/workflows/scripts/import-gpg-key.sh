#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  # clear history just in case
  history -c
}
trap cleanup EXIT TERM

# Validate GPG input variables
if [[ -z "${GPG_PASSPHRASE:-}" ]]; then echo "Error: GPG_PASSPHRASE is empty" >&2; exit 1; fi
if [[ -z "${GPG_KEY_ID:-}" ]]; then echo "Error: GPG_KEY_ID is empty" >&2; exit 1; fi
if [[ -z "${GPG_KEY:-}" ]]; then echo "Error: GPG_KEY is empty" >&2; exit 1; fi

echo "Importing GPG key..."
echo "${GPG_KEY}" | gpg --import --batch > /dev/null || { echo "Error: Failed to import GPG key" >&2; exit 1; }
