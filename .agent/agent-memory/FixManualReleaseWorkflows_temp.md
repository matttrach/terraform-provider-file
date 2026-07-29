# Temporary Plan: Fix Manual Release Workflows

**Executed Date:** 2026-07-29
**Purpose:** Resolve the `ERR_MODULE_NOT_FOUND` error in `manual-release.yml` and `manual-rc-release.yml` by ensuring the repository is checked out before any script execution steps are run.

## Checklist

- [x] In `.github/workflows/manual-release.yml`, move the `Checkout Repository` step to be the first step in the `release` job.
- [x] In `.github/workflows/manual-rc-release.yml`, move the `Checkout Repository` step to be the first step in the `rc-release` job.
- [x] Run `actionlint` locally to verify the updated workflow YAML syntax.
