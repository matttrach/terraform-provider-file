# Temporary Plan: Migrate Release Please to Single-Project Mode

**Executed Date:** 2026-07-22
**Purpose:** Migrate release-please from manifest-based mode (using `.release-please-manifest.json`) to standard Single-Project Mode (non-manifest mode) where release-please automatically calculates semver versions based on git tags and commit history.

## Phase 1: Convert Configuration File
**Objective**: Convert `release-please-config.json` to root-level options and remove the `packages` block, defining the release type directly at the root.

- [x] Modify `release-please-config.json` to have root-level options:
  ```json
  {
    "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
    "release-type": "go",
    "prerelease": true,
    "draft": true,
    "include-v-in-tag": true,
    "include-component-in-tag": false,
    "always-update": true,
    "initial-version": "v0.1.0"
  }
  ```

## Phase 2: Update Workflow and Clean Up Manifest File
**Objective**: Update the release-please-action jobs to explicitly specify the `release-type: go` input (disabling manifest mode) and delete the redundant `.release-please-manifest.json` file.

- [x] Modify `.github/workflows/release.yml`: Add `release-type: go` and remove `manifest-file` from both `release-please-release` and `release-please-pr` steps.
- [x] Delete `.release-please-manifest.json`.
