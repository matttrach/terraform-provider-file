#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  # clear history just in case
  history -c
}
trap cleanup EXIT TERM

# Support executing from a different directory (for manual/RC releases)
if [[ -n "${WORKING_DIR:-}" ]]; then
  cd "${WORKING_DIR}"
fi

# Validate GPG input variables
if [[ -z "${GPG_PASSPHRASE:-}" ]]; then echo "Error: GPG_PASSPHRASE is empty" >&2; exit 1; fi
if [[ -z "${GPG_KEY_ID:-}" ]]; then echo "Error: GPG_KEY_ID is empty" >&2; exit 1; fi
if [[ -z "${GPG_KEY:-}" ]]; then echo "Error: GPG_KEY is empty" >&2; exit 1; fi

# Trim any whitespace/newlines from GPG_KEY_ID to ensure GPG matching succeeds
export GPG_KEY_ID
GPG_KEY_ID=$(echo -n "${GPG_KEY_ID}" | tr -d '[:space:]')

echo "Importing GPG key..."
echo "${GPG_KEY}" | gpg --import --batch > /dev/null || { echo "Error: Failed to import GPG key" >&2; exit 1; }

# Automatically extract the actual imported secret primary key ID from GPG.
# This prevents mismatches where GPG_KEY_ID from Vault is configured to an encryption subkey,
# or is otherwise mismatched/misconfigured.
# We append '|| true' to avoid triggering pipefail if no keys are found.
SEC_LINE=$(gpg --batch --list-secret-keys --keyid-format LONG | grep -E '^sec' | head -n1 || true)
if [[ -n "${SEC_LINE}" ]]; then
  DETECTED_KEY_ID=$(echo "${SEC_LINE}" | awk '{print $2}' | cut -d'/' -f2)
  if [[ -n "${DETECTED_KEY_ID}" ]]; then
    echo "Successfully detected GPG key ID from imported key: ${DETECTED_KEY_ID}"
    GPG_KEY_ID="${DETECTED_KEY_ID}"
  fi
fi

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

CONFIG_FILE="${GORELEASER_CONFIG:-.goreleaser.yml}"

if [[ -f "${CONFIG_FILE}" ]]; then
  extra_args=()
  if [[ "${SKIP_VALIDATE:-false}" == "true" ]]; then
    extra_args+=("--skip=validate")
  fi
  goreleaser release --clean --config "${CONFIG_FILE}" "${extra_args[@]+"${extra_args[@]}"}"
else
  echo "Error: ${CONFIG_FILE} not found" >&2
  exit 1
fi
