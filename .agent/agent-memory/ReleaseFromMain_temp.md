# Temporary Plan: Release from Main Branch

**Executed Date:** Complete
**Purpose:** Update the release workflows and scripts so that the repository releases directly from the `main` branch instead of relying on `release/v*` branches. This simplifies the release strategy and aligns with a trunk-based development approach.

## Phase 1: Update the Release Workflow
**Objective**: Ensure the automated release pipeline triggers on the `main` branch.

- [x] Update `.github/workflows/release.yml`: Change the `on.push.branches` trigger from `release/v*` to `main`.
- [x] Update `.github/workflows/release.yml`: Add a `version` output to the `release-please-pr` job that captures the proposed version from the `release-please-action` outputs (e.g. `version: ${{ steps.release-please-pr.outputs.version || steps.release-please-pr.outputs['.--version'] }}`).
- [x] Update `.github/workflows/release.yml`: Update the `rc-release` job's `Create and Push RC Tag with Git` step to pass the target version to the script as an environment variable using the newly exposed output, and execute it using `actions/github-script`.

## Phase 2: Update the RC Tag Script
**Objective**: Adjust the tag calculation logic to work without a `release/v*` branch name and use the GitHub API to attribute the tag to a bot user.

- [x] Modify `.github/workflows/scripts/create-push-rc-tag.sh` (or `.js`): Replace the bash script with a JavaScript file formatted for `actions/github-script`.
- [x] In the RC Tag Script: Accept the `TARGET_VERSION` environment variable passed from the workflow.
- [x] In the RC Tag Script: Use `github.paginate(github.rest.repos.listTags)` to fetch existing tags and dynamically calculate the next RC number based on tags matching the target version.
- [x] In the RC Tag Script: Use `github.rest.git.createRef` to create the tag via the GitHub API.
- [x] In the RC Tag Script: Export the new RC tag as an output.

## Phase 3: Cleanup Manual Workflows
**Objective**: Ensure manual dispatch workflows continue to work and remove outdated steps related to issue tracking.

- [x] Update `.github/workflows/manual-rc-release.yml`: Remove the `Find Issues and Create Comments` step (and its dependency on `.github/workflows/scripts/rc-notify.js`).
- [x] Update branch inputs: Ensure the `branch` inputs in `.github/workflows/manual-release.yml` and `.github/workflows/manual-rc-release.yml` default to or expect `main` rather than release branches.
