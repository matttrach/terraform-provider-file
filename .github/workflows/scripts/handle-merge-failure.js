// handle-merge-failure.js - Handles PR merge failure with graceful maintainer fallbacks and prevents spam.
// Conforms to github-script.instructions.md guidelines.

const COMMENT_SIGNATURE = '<!-- fork-merge-failure-signature -->';

async function withRetry(core, fn, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      core.warning(`API call failed (Attempt ${i + 1}/${retries}): ${err.message}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export default async ({ github, context, core, process }) => {
  const owner = context.repo.owner;
  const repo = context.repo.repo;

  const prNumber = process.env.PR_NUMBER;
  if (!prNumber) {
    throw new Error('PR_NUMBER environment variable is required.');
  }

  const errorMessage = process.env.ERROR_MESSAGE || 'Unknown merge failure error.';

  core.info(`Handling merge failure for PR #${prNumber}...`);

  // Fetch PR to determine if it is a fork
  const { data: pr } = await withRetry(core, () => github.rest.pulls.get({
    owner,
    repo,
    pull_number: parseInt(prNumber, 10),
  }));

  const isFork = pr.head.repo?.full_name !== pr.base.repo?.full_name;

  if (isFork) {
    core.info(`PR #${prNumber} is a fork. Executing graceful maintainer fallback labeling and commenting.`);
    try {
      // 1. Add ready-to-merge label
      await withRetry(core, () => github.rest.issues.addLabels({
        owner,
        repo,
        issue_number: parseInt(prNumber, 10),
        labels: ['ready-to-merge'],
      }));

      // 2. Post or update detailed fork permission barrier comment
      const fallbackMsg = `### 🤖 Automated Merge Failed (Permission Barrier)

This PR has successfully passed all quality gates, but the automated merge attempt failed with the following error:
\`\`\`text
${errorMessage}
\`\`\`

**Possible Causes:**
1. Standard write-level API limitations for fork-based pull requests on GITHUB_TOKEN permissions.
2. Branch protection rules on \`main\` restricting push actions.

**How to Resolve:**
* A repository maintainer can click **Merge** manually on this PR.
* The PR is now labeled with **ready-to-merge** to alert maintainers.`;

      await updateOrPostComment({ github, core, owner, repo, prNumber: parseInt(prNumber, 10), message: fallbackMsg });

      core.info(`Graceful fork fallback comment and label handled successfully.`);
    } catch (fallbackError) {
      core.error(`Graceful fork fallback failed: ${fallbackError.message}`);
    }
  } else {
    core.error(`Merge failed for local branch PR #${prNumber}: ${errorMessage}`);
  }
};

async function updateOrPostComment({ github, core, owner, repo, prNumber, message }) {
  const comments = await withRetry(core, () => github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: prNumber,
  }));

  const botComment = comments.find(c => c.body && c.body.includes(COMMENT_SIGNATURE));
  const fullBody = `${message}\n\n${COMMENT_SIGNATURE}`;

  if (botComment) {
    if (botComment.body !== fullBody) {
      core.info(`Updating existing fork-merge-failure comment on PR #${prNumber}`);
      await withRetry(core, () => github.rest.issues.updateComment({
        owner,
        repo,
        comment_id: botComment.id,
        body: fullBody,
      }));
    } else {
      core.info(`Fork-merge-failure comment on PR #${prNumber} is already up to date`);
    }
  } else {
    core.info(`Posting new fork-merge-failure comment on PR #${prNumber}`);
    await withRetry(core, () => github.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: fullBody,
    }));
  }
}
