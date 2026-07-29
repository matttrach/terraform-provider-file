# Plan: Fix Manual Release Workflows

**Executed Date:** 2026-07-29
**Purpose:** Resolve the `ERR_MODULE_NOT_FOUND` error in `manual-release.yml` and `manual-rc-release.yml` by ensuring the repository is checked out before any script execution steps are run.

## Background & Motivation
The `manual-release.yml` and `manual-rc-release.yml` workflows were failing immediately upon execution with an `ERR_MODULE_NOT_FOUND` error. This occurred because the `Check User In Maintainers` and `Validate Release Tag` (or `Validate RC Tag`) steps attempted to execute scripts located in `.github/workflows/scripts/` prior to the `Checkout Repository` step running.

## Implementation Steps

1. **Reorder Steps in `manual-release.yml`:**
   * Move the `actions/checkout` step (currently named "Checkout Repository") to be the first step in the `release` job's `steps:` array.
2. **Reorder Steps in `manual-rc-release.yml`:**
   * Move the `actions/checkout` step (currently named "Checkout Repository") to be the first step in the `rc-release` job's `steps:` array.

## Verification & Testing
1. Run `actionlint` locally to ensure no YAML syntax errors are introduced by reordering the steps.
