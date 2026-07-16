# Temporary Plan: Workflow Standards Refactor

**Source Plan:** `.agent/plans/WorkflowStandards.md`
**Status:** Completed

## File Progress

- [x] **`pull_request.yaml`** (Permissions, Container, Timeouts, Concurrency, Script Extraction, Names/IDs)
- [x] **`fossa.yml`** (Permissions, Container, Job/Step Names and IDs)
- [x] **`release.yml`** (Permissions, Container, Job/Step Names and IDs, Script Extraction)
- [x] **`manual-release.yml`** (Permissions, Container, Job/Step Names and IDs, Script Extraction)
- [x] **`manual-rc-release.yml`** (Permissions, Container, Job/Step Names and IDs, Script Extraction)

## Global / Scripts Setup
- [x] Create `.github/workflows/scripts` directory.
- [x] Extract `lint-terraform.sh`, `actionlint.sh`, `shellcheck.sh`, `validate-commit-message.sh`, `gitleaks.sh`, `test-compile-check.sh`, `lint-tests.sh`.
- [x] Extract scripts for `release.yml`: `wait-for-e2e.js`, `run-unit-tests.sh`, `run-acc-tests.sh`, `report-tests.js`, `create-push-rc-tag.sh`, `import-gpg-key.sh`, `create-push-tag.sh`, `run-goreleaser.sh`, `publish-release.js`.
- [x] Extract scripts for manual workflows: `check-maintainer.js`, `validate-tag.sh`, `manual-create-push-tag.sh`, `prepare-release-dir.sh`, `run-goreleaser.sh`.

## Standards Checklist (To Apply Per-File)

- **1. Permissions:** Add `permissions: {}` at the top level of all workflows and explicit, least-privilege `permissions` blocks to all jobs.
- **2. Action Pinning:** Pin all actions to full 40-character commit SHAs. Add version comments (e.g., `# v6.0.2`) and release page link comments above the `uses:` line.
- **3. Allowed Namespaces:** Audit and replace unauthorized action namespaces with approved ones, or convert them to `github-script`/`run` steps.
- **4. Secure Contexts:** Replace any inline untrusted context variables in `run` scripts with environment variables (`env:`).
- **5. Trigger Audit:** Remove and replace any `pull_request_target` triggers.
- **6. Timeouts:** Add explicit `timeout-minutes` (default 30) to every job.
- **7. Concurrency:** Add `concurrency` blocks to PR workflows to cancel redundant runs.
- **8. Caching:** Implement `actions/cache` or action-specific caching for dependency downloads.
- **9. Orchestration:** Refactor workflows to orchestrate rather than execute.
- **10. Script Extraction:** Move all inline `run` or `github-script` scripts to the `.github/workflows/scripts/` directory.
- **12. Naming Conventions:** Add descriptive `name` tags to all workflows and jobs. Add `name` and `id` tags to all steps.
- **13. Shell Attributes:** Eliminate `shell:` attributes and use `.github/workflows/scripts/nix-run.sh`.
- **14. Container Runtime:** Update `ubuntu-latest` jobs to use `ghcr.io/rancher/ci-image/nix:20260603-18` and remove redundant Nix installation steps.

## Notes & Token Cut-off Tracker
*Agent must check context size before operations. If context reaches 25% or 200,000 tokens, halt execution, update progress, and request a new session.*
