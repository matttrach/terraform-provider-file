// proxy-approve-pr.js - Submits an approving review via GitHub App and enables auto-merge.
// Conforms to github-script.instructions.md guidelines.

export default async ({ github, context, core, process }) => {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const prNumber = process.env.PR_NUMBER || context.payload?.pull_request?.number || context.payload?.issue?.number;

  if (!prNumber) {
    core.setFailed('Error: PR_NUMBER could not be determined from context or environment.');
    return;
  }

  const enabled = process.env.FEATURE_PR_APPROVAL_PROXY;
  if (enabled !== 'true') {
    core.info('PR Approval Proxy feature is disabled in .github/repo-config.yml. Passing gracefully.');
    return;
  }

  core.info(`==> Processing proxy approval for PR #${prNumber} in ${owner}/${repo}...`);

  const { data: pr } = await github.rest.pulls.get({
    owner,
    repo,
    pull_number: parseInt(prNumber, 10),
  });

  if (pr.state !== 'open') {
    core.info(`PR #${prNumber} is not open (state: ${pr.state}). Skipping approval.`);
    return;
  }

  // 1. Submit approving review using the App token
  core.info(`Submitting proxy approving review on PR #${prNumber}...`);
  try {
    await github.rest.pulls.createReview({
      owner,
      repo,
      pull_number: parseInt(prNumber, 10),
      event: 'APPROVE',
      body: 'Automated proxy approval from authorized stakeholder via GitHub App.',
    });
    core.info(`🟢 Successfully submitted approving review for PR #${prNumber}.`);
  } catch (err) {
    core.warning(`Notice: Failed to submit review (may already be approved by App or author): ${err.message}`);
  }

  // 2. Enable Auto-Merge via GraphQL
  core.info(`Enabling auto-merge for PR #${prNumber} (Node ID: ${pr.node_id})...`);
  const enableAutoMergeMutation = `
    mutation($pullRequestId: ID!) {
      enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: SQUASH }) {
        pullRequest {
          autoMergeRequest {
            enabledAt
          }
        }
      }
    }
  `;

  try {
    await github.graphql(enableAutoMergeMutation, {
      pullRequestId: pr.node_id,
    });
    core.info(`🟢 Successfully enabled auto-merge for PR #${prNumber}.`);
  } catch (err) {
    core.warning(
      `Notice: Could not enable auto-merge (repository auto-merge might be disabled or branch already up to date): ${err.message}`,
    );
  }
};
