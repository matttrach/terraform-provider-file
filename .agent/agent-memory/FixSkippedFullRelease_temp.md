# Temporary Plan: Fix Skipped Full Release CI Failure

**Executed Date:** 2026-07-29
**Purpose:** Ensure the Full Release job triggers properly when a release pull request is merged by correctly capturing the `release_created` output from the `release-please` action in manifest mode.

## Checklist

- [x] Update `release_created` output mapping in `.github/workflows/release.yml`'s `release-please` job to check `steps.release-please.outputs['.--release_created']` as a fallback.
- [x] Run `actionlint` locally to verify the updated workflow YAML syntax.
