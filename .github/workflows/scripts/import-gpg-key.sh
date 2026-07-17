#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  # clear history just in case
  history -c
}
trap cleanup EXIT TERM

# sanitize variables
if [ -z "${GPG_PASSPHRASE:-}" ]; then echo "gpg passphrase empty"; exit 1; fi
if [ -z "${GPG_KEY_ID:-}" ]; then echo "key id empty"; exit 1; fi
if [ -z "${GPG_KEY:-}" ]; then echo "key contents empty"; exit 1; fi

echo "Importing gpg key"
echo "${GPG_KEY}" | gpg --import --batch > /dev/null || { echo "Failed to import GPG key"; exit 1; }
