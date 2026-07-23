# Plan: Consolidate and Normalize Workflow Scripts

**Executed Date:** 2026-07-22
**Purpose:** Consolidate redundant workflow scripts (such as tag creation and commenting), fix a critical unit-testing script naming bug in the PR workflow, and normalize all bash and javascript files to comply with repository standard styles (using double brackets `[[ ]]`, `set -euo pipefail`, explicit error redirection to stderr, `try/catch` wrapping, and paginate).

## Goals
1. Consolidate `manual-create-push-tag.sh` and `create-push-tag.sh` into `create-push-tag.sh`.
2. Consolidate `report-tests.js` and `wait-for-e2e.js` into `post-pr-comment.js`.
3. Fix the `pull_request.yaml` workflow to invoke `run-unit-tests.sh` instead of the non-existent `unit-tests.sh`.
4. Normalize all Bash scripts under `.github/workflows/scripts` to use double brackets `[[ ]]` instead of single brackets `[ ]`, fail-fast with `set -euo pipefail`, and route errors to stderr.
5. Normalize JavaScript scripts to use `try/catch` error blocks with `core.setFailed()` and utilize `github.paginate` for REST arrays (like listReleases).
6. Update all workflow YAML files to call the consolidated scripts correctly.
7. Run `actionlint` and `shellcheck` validations to ensure complete behavioral and structural correctness.

## Phase 2 Goals: Consolidating Tag Creation completely into Octokit API (JavaScript)
8. Merge `create-push-tag.sh` and `create-push-rc-tag.js` into a single, unified `create-push-tag.js` GitHub script.
9. Delete `create-push-tag.sh` and `create-push-rc-tag.js` completely.
10. Update `release.yml`, `manual-release.yml`, and `manual-rc-release.yml` to call `create-push-tag.js` via `actions/github-script` instead of shell runners or separate scripts.

## Phase 3 Goals: Consolidating Lint and Test Scripts into Unified Entrypoints
11. Merge `actionlint.sh`, `gitleaks.sh`, `lint-terraform.sh`, `lint-tests.sh`, and `shellcheck.sh` into a single `lint.sh` script.
12. Merge `test-compile-check.sh`, `run-unit-tests.sh`, and `run-acc-tests.sh` into a single `test.sh` script.
13. Delete the individual lint and test scripts.
14. Update `pull_request.yaml` and `release.yml` workflows to invoke `lint.sh` and `test.sh` with specific arguments (preserving CI modularity and parallel jobs).

## Phase 4 Goals: Differentiate AWS Test Relay and Local Acceptance Tests
15. Establish the `//go:build relay` constraint standard to isolate AWS Test Relay acceptance tests from standard local-workstation acceptance tests.
16. Update `GNUmakefile` to define `testacc` (running standard local acceptance tests, excluding relay) and `testaccrelay` (explicitly running relay-using acceptance tests).
17. Update `.github/workflows/scripts/test.sh` to support the new `acc-relay` mode.
18. Add an `acceptance-tests` job to `pull_request.yaml` to execute all non-relay acceptance tests on every pull request.
