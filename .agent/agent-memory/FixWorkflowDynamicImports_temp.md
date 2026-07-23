# Temporary Plan: Fix Workflow Dynamic Imports

**Executed Date:** 2026-07-23
**Purpose:** Fix the `TypeError [ERR_INVALID_MODULE_SPECIFIER]` failure in GitHub Actions by refactoring dynamic imports in workflows to use absolute paths resolved via `process.env.GITHUB_WORKSPACE`.

## Phase 1: Update Manual RC Release Workflow
**Objective**: Fix dynamic imports in `.github/workflows/manual-rc-release.yml`.

- [x] Update `check-maintainer` step (line 41): Use `process.env.GITHUB_WORKSPACE` to resolve absolute path.
- [x] Update `create-push-rc-tag` step (line 66): Use `process.env.GITHUB_WORKSPACE` to resolve absolute path.
- [x] Update `publish-rc` step (line 126): Use `process.env.GITHUB_WORKSPACE` to resolve absolute path.

## Phase 2: Update Manual Release Workflow
**Objective**: Fix dynamic imports in `.github/workflows/manual-release.yml`.

- [x] Update `check-maintainer` step (line 35): Use `process.env.GITHUB_WORKSPACE` to resolve absolute path.
- [x] Update `create-push-tag` step (line 60): Use `process.env.GITHUB_WORKSPACE` to resolve absolute path.
- [x] Update `publish-release` step (line 120): Use `process.env.GITHUB_WORKSPACE` to resolve absolute path.

## Phase 3: Update Main Release Workflow
**Objective**: Fix dynamic imports in `.github/workflows/release.yml`.

- [x] Update `post-pr-comment` step (line 99): Use `process.env.GITHUB_WORKSPACE` to resolve absolute path.
- [x] Update `post-pr-comment` step (line 132): Use `process.env.GITHUB_WORKSPACE` to resolve absolute path.
- [x] Update `post-pr-comment` step (line 148): Use `process.env.GITHUB_WORKSPACE` to resolve absolute path.
- [x] Update `create-push-rc-tag` step (line 185): Use `process.env.GITHUB_WORKSPACE` to resolve absolute path.
- [x] Update `create-push-tag` step (line 243): Use `process.env.GITHUB_WORKSPACE` to resolve absolute path.
- [x] Update `publish-release` step (line 285): Use `process.env.GITHUB_WORKSPACE` to resolve absolute path.

## Phase 4: Validation
**Objective**: Validate yaml syntax and format of the updated workflows.

- [x] Verify that all updated workflow files have valid YAML syntax.
- [x] Run linting / validation check on modified files.
