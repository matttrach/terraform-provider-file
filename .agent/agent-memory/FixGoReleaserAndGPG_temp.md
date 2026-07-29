# Temporary Plan: Fix GoReleaser GPG Error and Clean Up Workflow Script References Progress

This is a temporary plan to track detailed step-by-step progress for the GoReleaser GPG fix and script references consolidation.

## File Progress

- [x] **`.github/workflows/scripts/goreleaser.sh`** (Defensive whitespace trimming, `WORKING_DIR` and `GORELEASER_CONFIG` support)
- [x] **`.github/workflows/release.yml`** (Consolidate RC Release steps and use unified `goreleaser.sh`)
- [x] **`.github/workflows/manual-release.yml`** (Consolidate steps and use unified `goreleaser.sh`)
- [x] **`.github/workflows/manual-rc-release.yml`** (Consolidate steps and use unified `goreleaser.sh`)

## Implementation Progress

### Step 1: Update `.github/workflows/scripts/goreleaser.sh`
- [x] Trim leading/trailing whitespace and newlines from `GPG_KEY_ID`.
- [x] Respect `WORKING_DIR` environment variable to support custom directory execution.
- [x] Respect `GORELEASER_CONFIG` environment variable to support custom configuration files.
- [x] Support `SKIP_VALIDATE` flag mapping to GoReleaser bypass arguments.

### Step 2: Update Workflows to use `goreleaser.sh`
- [x] Refactor `release.yml` (`rc-release` job) to call `goreleaser.sh` instead of `import-gpg-key.sh` and `run-goreleaser.sh`.
- [x] Refactor `manual-release.yml` (`release` job) to call `goreleaser.sh` instead of `import-gpg-key.sh` and `run-goreleaser.sh`.
- [x] Refactor `manual-rc-release.yml` (`rc-release` job) to call `goreleaser.sh` instead of `import-gpg-key.sh` and `run-goreleaser.sh`.

### Step 3: Verification & Testing
- [x] Run `shellcheck` via `nix develop` on `.github/workflows/scripts/goreleaser.sh`.
- [x] Run `actionlint` via `nix develop` on all modified workflows.
