# Plan: Fix GoReleaser GPG Key Mismatch

**Executed Date:** 2026-07-29
**Purpose:** Resolve the release workflow failure (`gpg: error reading key: No secret key`) caused by GPG_KEY_ID pointing to an encryption-only subkey or being mismatched with the imported primary secret signing key.

## Background & Motivation
In the latest Release workflow run (`30459585521`), the step `Run GoReleaser` failed with `gpg: error reading key: No secret key` when validating the key ID using `gpg --batch --list-secret-keys --keyid-format LONG "${GPG_KEY_ID}"`.

The imported key has the following structure:
* Primary key: `sec rsa4096/6D5B085066648C32 [SC]` (valid for signing and certifying)
* Encryption subkey: `ssb rsa4096/8F23FF49FE2CA462 [E]` (valid for encryption only)

If Vault's `GPG_KEY_ID` is configured to the subkey ID `8F23FF49FE2CA462`, `gpg --list-secret-keys` fails because it is an encryption-only subkey, and GnuPG (2.4.x) fails to list or sign with it. To make the release process self-healing and robust against Vault key ID misconfigurations, we should automatically extract the correct primary signing key ID from the imported keyring and use it for validation and GoReleaser.

## Implementation Steps

1. **Update `goreleaser.sh` Script:**
   * Modify `.github/workflows/scripts/goreleaser.sh` to automatically detect the primary secret key ID from the imported keyring after `gpg --import` completes.
   * If a primary secret key is found, update `GPG_KEY_ID` to this detected ID.
   * Add a fallback to the existing `GPG_KEY_ID` if parsing fails.

## Verification & Testing
1. Run `shellcheck` on `.github/workflows/scripts/goreleaser.sh` to ensure no syntax or style issues are introduced.
2. Run `actionlint` on the workflows to ensure no syntax issues exist.
