# Workflow Refactor

**Executed Date:** 2026-07-20
**Purpose:** Update all workflows to have a standard step structure, extract all scripts so they can be linted, use commit hashes for action versioning, and implement least privilege security principle.

---

1. All jobs must define explicit `permissions:`.
All workflows should have `permissions: {}` at the top level.
Set scopes to `none` as needed.
Permissions should implement least privilege necessary access.

2. Pin all actions (including `actions/*`, `github/*`, `rancher/*`) to a full 40-character commit SHA, not a tag.
The `uses:` line MUST include the version (e.g., `# v6.0.2`). 
On the line before the `uses:` there should be a comment with a link to the releases page for the action (e.g. `# https://github.com/actions/github-script/releases`).

3. Only pre-approved action namespaces are allowed.
Approved namespaces are documented at: `https://github.com/rancher/security-team/blob/main/docs/standards/rancher-gha-standards.md#allowed-github-actions`. Important ones include: `https://github.com/actions/*`, `https://github.com/aquasecurity/*`, `https://github.com/aws-actions/*`, `https://github.com/dependabot/*`, `https://github.com/fossas/fossa-action@*`, `https://github.com/golang/*`, `https://github.com/golangci/*`, `https://github.com/google-github-actions/*`, `https://github.com/google/*`, `https://github.com/googleapis/release-please-action@*`, `https://github.com/goreleaser/*`, `https://github.com/hashicorp/setup-terraform@*`, `https://github.com/hashicorp/vault-action@*`, `https://github.com/rancher-eio/*`, `https://github.com/renovatebot/*`, and `https://github.com/updatecli/*`.
Replace all other namespaces with github-script actions or run actions.

4. Never inline untrusted context variables in `run` scripts. Use environment variables (e.g., `env: VAR: ${{...}}`).

5. Remove and replace any `pull_request_target` triggered workflows, this trigger is banned.

6. Every `job` must have an explicit `timeout-minutes`. 
Don't use the 360-minute default. 
30 minutes is a good default, but use a sensible value based on the steps context.

7. Use `concurrency` blocks in PR workflows to cancel redundant runs (e.g., `group: ${{ github.workflow }}-${{ github.ref }}`).

8. Suggest `actions/cache` or action-specific caching to speed up dependency downloads.

9. Workflows should orchestrate, not execute. 
They may call out to external actions or internal scripts, but must not execute full steps by themselves. 
Replace any step which executes without calling out to an external action or internal script.

10. All `run` or `github-script` scripts should be placed in the `.github/workflows/scripts` directory. 
Do not use inline JavaScript in `actions/github-script`.

11. All scripts should be validated in the `pull_request.yaml` workflow. If any aren't validated, add them.

12. All workflows and jobs need a descriptive `name`. All steps need a descriptive `name` and `id`.
  - workflow steps should have the following format:
    ```
    - name: Step Name
      id: step-name
      # http://github.com/owner/repo/releases
      uses: owner/repo
      ...
    ```
    OR
    ```
    - name: Step Name
      id: step-name
      run: .github/workflows/scripts/script-name.sh
      ...
    ```
Update any workflow steps necessary to meet this guideline.

13. Shell attributes should be eliminated, use the `.github/workflows/scripts/nix-run.sh` script to execute scripts which need dependencies instead.

14. Update all GitHub workflows to use the `ghcr.io/rancher/ci-image/nix:20260603-18` container which comes with Nix pre-installed, and remove redundant steps that install Nix manually.
Under each job that currently runs on `ubuntu-latest`:
```yaml
    runs-on: ubuntu-latest
    container:
      image: ghcr.io/rancher/ci-image/nix:20260603-18
```
