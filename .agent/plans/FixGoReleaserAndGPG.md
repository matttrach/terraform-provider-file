# Plan: Fix GoReleaser GPG Error and Clean Up Workflow Script References

**Executed Date:** 2026-07-28
**Purpose:** Fix the GoReleaser release workflow failure caused by an invalid `GPG_KEY_ID` lookup and remove broken references to deleted `.sh` files in the GitHub Actions workflows.

## Background & Motivation
The `Release` workflow is failing at the `Run GoReleaser` step. The specific error is `gpg: error reading key: No secret key`. Investigation revealed that the `GPG_KEY_ID` retrieved from Vault contains a trailing newline or whitespace, causing `gpg --batch --list-secret-keys "${GPG_KEY_ID}"` to fail.

Additionally, while investigating the fix, it was discovered that `import-gpg-key.sh` and `run-goreleaser.sh` were previously consolidated into `goreleaser.sh`, but the workflows (`release.yml`, `manual-release.yml`, and `manual-rc-release.yml`) were not fully updated. Several jobs still attempt to call the deleted scripts.

## Implementation Steps

1. **Fix `goreleaser.sh` Script:**
   - Update `.github/workflows/scripts/goreleaser.sh` to defensively trim whitespace/newlines from `GPG_KEY_ID` before it is used.
   - Example: `GPG_KEY_ID="$(echo -e "${GPG_KEY_ID}" | tr -d '[:space:]')"`
   - Ensure `goreleaser.sh` respects the `GORELEASER_CONFIG` environment variable (defaulting to `.goreleaser.yml` if not set) and `WORKING_DIR` variable to support the workflows that require custom configuration or paths (like the RC tagging).

2. **Update Workflow Script References:**
   - **File `release.yml`**: In the `rc-release` job, consolidate the `Import GPG Key` and `Run GoReleaser` steps. Replace references to `import-gpg-key.sh` and `run-goreleaser.sh` with a single call to `goreleaser.sh`.
   - **File `manual-release.yml`**: Consolidate `Import GPG Key` and `Run GoReleaser` steps. Replace references with `goreleaser.sh`.
   - **File `manual-rc-release.yml`**: Consolidate `Import GPG Key` and `Run GoReleaser` steps. Replace references with `goreleaser.sh`.

## Verification & Testing
1. Ensure all shell script updates pass `shellcheck`.
2. Ensure the workflows are valid by running `actionlint`.
