# Release from Main Branch

**Executed Date:** July 16, 2026
**Purpose:** Update the release workflows and scripts so that the repository releases directly from the `main` branch instead of relying on `release/v*` branches. This simplifies the release strategy and aligns with a trunk-based development approach.

---

## Phase 1: Update the Release Workflow
**Objective**: Ensure the automated release pipeline triggers on the `main` branch.

1. **Update `.github/workflows/release.yml`**:
   - Change the `on.push.branches` trigger from `release/v*` to `main`.
   - Add a `version` output to the `release-please-pr` job that captures the proposed version from the `release-please-action` outputs (e.g. `version: ${{ steps.release-please-pr.outputs.version || steps.release-please-pr.outputs['.--version'] }}`).
   - Update the `rc-release` job's `Create and Push RC Tag with Git` step to pass the target version to the script as an environment variable using the newly exposed output, and execute it using `actions/github-script`.
   - *Code Snippet:*
     ```yaml
           - name: Create and Push RC Tag via API
             id: create-push-rc-tag
             uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0
             env:
               TARGET_VERSION: ${{ needs.release-please-pr.outputs.version }}
             with:
               github-token: ${{secrets.GITHUB_TOKEN}}
               script: |
                 const scriptPath = `.github/workflows/scripts/create-push-rc-tag.js`;
                 const { default: script } = await import(scriptPath);
                 await script({github, context, core, process});
     ```

## Phase 2: Update the RC Tag Script
**Objective**: Adjust the tag calculation logic to work without a `release/v*` branch name and use the GitHub API to attribute the tag to a bot user.

1. **Create/Modify `.github/workflows/scripts/create-push-rc-tag.js`**:
   - Replace the bash script with a JavaScript file formatted for `actions/github-script`.
   - Accept the `TARGET_VERSION` environment variable passed from the workflow.
   - Use `github.paginate(github.rest.repos.listTags)` to fetch existing tags and dynamically calculate the next RC number based on tags matching the target version.
   - Use `github.rest.git.createRef` to create the tag via the GitHub API, tying the attribution correctly to the token used.
   - Export the new RC tag as an output.
   - *Code Snippet:*
     ```javascript
     export default async ({ github, context, core, process }) => {
       const targetVersion = process.env.TARGET_VERSION;
       if (!targetVersion) {
         core.setFailed("TARGET_VERSION is required");
         return;
       }

       const baseVersion = `v${targetVersion}`;
       core.info(`Base version from release-please is: ${baseVersion}`);

       try {
         const tags = await github.paginate(github.rest.repos.listTags, {
           owner: context.repo.owner,
           repo: context.repo.repo,
         });

         const rcPrefix = `${baseVersion}-rc.`;
         let latestRcNum = -1;

         for (const tag of tags) {
           if (tag.name.startsWith(rcPrefix)) {
             const numStr = tag.name.substring(rcPrefix.length);
             const num = parseInt(numStr, 10);
             if (!isNaN(num) && num > latestRcNum) {
               latestRcNum = num;
             }
           }
         }

         const nextRcNum = latestRcNum + 1;
         const nextRcTag = `${rcPrefix}${nextRcNum}`;
         core.info(`Calculated next RC tag: ${nextRcTag}`);

         await github.rest.git.createRef({
           owner: context.repo.owner,
           repo: context.repo.repo,
           ref: `refs/tags/${nextRcTag}`,
           sha: context.sha,
         });

         core.info(`Successfully created tag ${nextRcTag}`);
         core.setOutput("rc_tag", nextRcTag);

       } catch (error) {
         core.setFailed(`Failed to create RC tag: ${error.message}`);
       }
     };
     ```

## Phase 3: Cleanup Manual Workflows
**Objective**: Ensure manual dispatch workflows continue to work and remove outdated steps related to issue tracking.

1. **Update `.github/workflows/manual-rc-release.yml`**:
   - Remove the `Find Issues and Create Comments` step (and its dependency on `.github/workflows/scripts/rc-notify.js`). Since releases are cut directly from `main`, tracking issues and release notifications in those issues are no longer required.

2. **Update `.github/workflows/manual-release.yml` & `manual-rc-release.yml` branch inputs**:
   - Ensure the `branch` inputs (if applicable) default to or expect `main` rather than release branches.
