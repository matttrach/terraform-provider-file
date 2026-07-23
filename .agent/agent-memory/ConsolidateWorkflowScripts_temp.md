# Temporary Plan: Workflow Scripts Consolidation and Normalization Progress

This is a temporary plan to track detailed step-by-step progress for the consolidation and normalization of GitHub workflow scripts.

## Step 1: Create New/Consolidated Scripts
- [x] Write consolidated `create-push-tag.sh` (Obsolete in Phase 2)
- [x] Write consolidated `post-pr-comment.js`
- [x] Write unified `create-push-tag.js` (Phase 2)
- [x] Write unified `lint.sh` (Phase 3)
- [x] Write unified `test.sh` (Phase 3)

## Step 2: Delete Redundant Scripts
- [x] Delete `manual-create-push-tag.sh`
- [x] Delete `report-tests.js`
- [x] Delete `wait-for-e2e.js`
- [x] Delete `create-push-tag.sh` (Phase 2)
- [x] Delete `create-push-rc-tag.js` (Phase 2)
- [x] Delete `actionlint.sh` (Phase 3)
- [x] Delete `gitleaks.sh` (Phase 3)
- [x] Delete `lint-terraform.sh` (Phase 3)
- [x] Delete `lint-tests.sh` (Phase 3)
- [x] Delete `shellcheck.sh` (Phase 3)
- [x] Delete `test-compile-check.sh` (Phase 3)
- [x] Delete `run-unit-tests.sh` (Phase 3)
- [x] Delete `run-acc-tests.sh` (Phase 3)

## Step 3: Refactor/Normalize Remaining Bash Scripts (Double brackets `[[ ]]`, set -euo pipefail, stderr)
- [x] Refactor `nix-run.sh`
- [x] Refactor `prepare-release-dir.sh`
- [x] Refactor `run-goreleaser.sh`
- [x] Refactor `import-gpg-key.sh`
- [x] Refactor `validate-commit-message.sh`
- [x] Refactor `validate-tag.sh`
- [x] Refactor `lint-tests.sh` (Obsolete in Phase 3)
- [x] Refactor `shellcheck.sh` (Obsolete in Phase 3)

## Step 4: Refactor/Normalize Remaining JavaScript Scripts (try/catch, core.setFailed, paginate)
- [x] Refactor `check-maintainer.js`
- [x] Refactor `create-push-rc-tag.js` (Obsolete in Phase 2)
- [x] Refactor `publish-release.js`

## Step 5: Update Workflows to Reference Correct Scripts & Fix Bugs
- [x] Fix `pull_request.yaml` to run `run-unit-tests.sh` and update other references
- [x] Update `release.yml` references
- [x] Update `manual-release.yml` references
- [x] Update `manual-rc-release.yml` references
- [x] Update workflows (`release.yml`, `manual-release.yml`, `manual-rc-release.yml`) to invoke unified `create-push-tag.js` (Phase 2)
- [x] Update workflows (`pull_request.yaml`, `release.yml`) to call unified `lint.sh` and `test.sh` (Phase 3)

## Step 6: Phase 4 Execution
- [x] Update `GNUmakefile` with separated `testacc` / `testaccrelay` targets
- [x] Update `test.sh` script to support `acc-relay` mode
- [x] Add `acceptance-tests` job in `pull_request.yaml` to run non-relay acceptance tests

## Step 7: Validation
- [x] Run shellcheck via `nix develop`
- [x] Run actionlint via `nix develop`
- [x] Rerun shellcheck/actionlint (Phase 2)
- [x] Rerun shellcheck/actionlint (Phase 3)
- [x] Rerun shellcheck/actionlint (Phase 4)
