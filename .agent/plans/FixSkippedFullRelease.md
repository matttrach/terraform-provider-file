# Plan: Fix Skipped Full Release CI Failure

**Executed Date:** 2026-07-29
**Purpose:** Ensure the Full Release job triggers properly when a release pull request is merged by correctly capturing the `release_created` output from the `release-please` action in manifest mode.

## Background & Motivation
The `Full Release` job in the `Release` workflow was being skipped because the `needs.release-please.outputs.release_created` condition was evaluating to false or empty. When `release-please-action` operates in manifest mode (with a `.packages` configuration block in `release-please-config.json`), it prefixes its step outputs with the path. As a result, it exports `.--release_created` rather than `release_created`. The job outputs configuration mapped `version` and `body` with path fallbacks, but missed `release_created`. Because the Full Release never ran, tags were not created on GitHub, causing `release-please` to not see the release and to continually try to re-release the same versions.

## Implementation Steps

1. **Update Workflow Outputs:**
   * Modify the `outputs` block of the `release-please` job in `.github/workflows/release.yml`.
   * Change `release_created: ${{ steps.release-please.outputs.release_created }}` to `release_created: ${{ steps.release-please.outputs.release_created || steps.release-please.outputs['.--release_created'] }}`.

## Verification & Testing
1. Run `actionlint` locally to ensure no YAML syntax errors are introduced.
2. Confirm the syntax aligns with how `version` and `body` are handled in the same block.
