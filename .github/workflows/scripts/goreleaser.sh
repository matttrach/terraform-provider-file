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

# https://www.gnupg.org/documentation/manuals/gnupg24/gpg.1.html
# https://goreleaser.com/customization/sign/sign/
# troubleshooting information
gpg --version
# this only lists UIDs no secret material
gpg --batch --list-secret-keys --keyid-format LONG
# this will fail if the secret key isn't present
gpg --batch --list-secret-keys --keyid-format LONG "${GPG_KEY_ID}" >/dev/null
# troubleshooting information
goreleaser --version

if [ -f .goreleaser.yml ]; then
  goreleaser release --clean --config .goreleaser.yml
else
  echo "Error: .goreleaser.yml not found" >&2
  exit 1
fi
