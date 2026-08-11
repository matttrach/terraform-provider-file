// verify-pr-requirements.mjs - Read-only validation script for a single Pull Request.
// Conforms to github-script.instructions.md guidelines.

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

  const prNumber = process.env.PR_NUMBER || context.payload.pull_request?.number || context.issue.number;
  if (!prNumber) {
    throw new Error('Could not determine pull request number. Please specify PR_NUMBER environment variable.');
  }

  core.info(`Running read-only requirements validation for PR #${prNumber}...`);

  const { data: pr } = await withRetry(core, () => github.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  }));

  if (pr.draft) {
    core.setFailed(`PR #${prNumber} is currently in draft mode. Verification cannot proceed until the PR is marked as ready for review.`);
    return;
  }

  const { success, reasons, ciPending } = await verifyPullRequest({ github, context, core, pr, owner, repo, checkCI: true });

  // Set outputs for the workflow to orchestrate next steps
  core.setOutput("success", success ? "true" : "false");
  core.setOutput("ci_pending", ciPending ? "true" : "false");
  core.setOutput("reasons", reasons.join('\n'));

  if (!success) {
    core.setFailed(`PR #${prNumber} does not meet all verification requirements:\n${reasons.join('\n')}`);
  } else {
    core.info(`PR #${prNumber} meets all verification requirements and is ready to merge!`);
  }
};

/**
 * Performs read-only verification on a single Pull Request.
 */
async function verifyPullRequest({ github, context, core, pr, owner, repo, checkCI }) {
  const reasons = [];
  let ciPending = false;

  // 1. Verify CI Check Runs
  if (checkCI) {
    core.info(`Checking CI status for PR #${pr.number} at SHA ${pr.head.sha}...`);
    const { data: checks } = await withRetry(core, () => github.rest.checks.listForRef({
      owner,
      repo,
      ref: pr.head.sha,
    }));

    core.info(`Total check runs found on GitHub: ${checks.check_runs.length}`);
    for (const r of checks.check_runs) {
      core.info(`  - [${r.status}] Name: "${r.name}", Conclusion: "${r.conclusion || 'pending'}", ID: ${r.id}`);
    }

    // Filter out requirements verification and event trigger check runs to avoid deadlock
    const relevantCheckRuns = checks.check_runs.filter(r => {
      const nameLower = r.name.toLowerCase();
      const isIgnored = r.name === 'Verify PR Requirements' ||
                        r.name === 'Trigger Executor on Event' ||
                        r.name === 'Verify and Auto-Merge PRs' ||
                        nameLower.includes('process pr #') ||
                        nameLower.includes('get open prs') ||
                        nameLower.includes('pr executor');
      if (isIgnored) {
        core.info(`  -> Ignoring status/trigger/executor check run to prevent deadlock: "${r.name}"`);
      }
      return !isIgnored;
    });

    const totalRuns = relevantCheckRuns.length;
    const completedRuns = relevantCheckRuns.filter(r => r.status === 'completed');
    const failedRuns = relevantCheckRuns.filter(r => r.status === 'completed' && r.conclusion !== 'success' && r.conclusion !== 'skipped');

    core.info(`CI check runs processed: ${completedRuns.length}/${totalRuns} completed. Failed: ${failedRuns.length}`);

    if (totalRuns === 0) {
      reasons.push('- **CI Checks**: No CI check runs have started yet.');
    } else if (completedRuns.length < totalRuns) {
      ciPending = true;
      reasons.push(`- **CI Checks**: ${totalRuns - completedRuns.length} check run(s) are still in-progress.`);
    } else if (failedRuns.length > 0) {
      reasons.push(`- **CI Checks**: Some CI check runs failed:\n` + failedRuns.map(r => `  - \`${r.name}\` (${r.conclusion})`).join('\n'));
    }
  }

  // 2. Verify Commits Signature
  core.info(`Checking commit signatures for PR #${pr.number}...`);
  const commits = await withRetry(core, () => github.paginate(github.rest.pulls.listCommits, {
    owner,
    repo,
    pull_number: pr.number,
  }));

  const unverifiedCommits = commits.filter(c => !c.commit.verification?.verified);
  if (unverifiedCommits.length > 0) {
    reasons.push(`- **Verified Commits**: The following commit(s) are not signed or verified:\n` +
      unverifiedCommits.map(c => `  - \`${c.sha.substring(0, 7)}\` - ${c.commit.message.split('\n')[0]}`).join('\n')
    );
  } else {
    core.info(`All ${commits.length} commit(s) are verified.`);
  }

  // 3. Verify Reviews & Approvals
  core.info(`Checking reviewer approvals for PR #${pr.number}...`);
  const reviews = await withRetry(core, () => github.paginate(github.rest.pulls.listReviews, {
    owner,
    repo,
    pull_number: pr.number,
  }));

  const latestReviews = {};
  for (const review of reviews) {
    if (review.user) {
      latestReviews[review.user.login] = review;
    }
  }

  const trustedApprovals = [];
  for (const review of Object.values(latestReviews)) {
    const login = review.user?.login;
    if (!login) continue;
    const isBot = review.user.type === 'Bot' ||
                  login.endsWith('[bot]') ||
                  login.toLowerCase().includes('copilot') ||
                  login.toLowerCase().includes('agent');
    if (isBot) continue;

    const assoc = review.author_association;
    let isTrusted = assoc === 'OWNER' || assoc === 'MEMBER' || assoc === 'COLLABORATOR';

    try {
      const { data: permData } = await withRetry(core, () => github.rest.repos.getCollaboratorPermissionLevel({
        owner,
        repo,
        username: login,
      }));
      const perm = permData.permission;
      isTrusted = perm === 'admin' || perm === 'write' || perm === 'maintain' || perm === 'triage';
    } catch (error) {
      core.info(`  -> Note: Could not check collaborator permission level for @${login} via API (${error.message}).`);
    }

    if (review.state === 'APPROVED' && isTrusted) {
      trustedApprovals.push(review);
    }
  }

  const isDependabot = pr.user?.login === 'dependabot[bot]';
  const aiApprovals = Object.values(latestReviews).filter(review => {
    const login = review.user?.login;
    if (!login) return false;
    const isAi = login.toLowerCase().includes('copilot') || login.toLowerCase().includes('agent');
    return isAi && (review.state === 'APPROVED' || review.state === 'COMMENTED');
  });

  if (isDependabot) {
    if (aiApprovals.length < 1) {
      reasons.push(`- **Reviews**: Requirements not met. Dependabot PR requires at least **1 AI review** (from Copilot or Agent).`);
    }
  } else {
    if (trustedApprovals.length < 1) {
      reasons.push(`- **Reviews**: Requirements not met. PR requires at least **1 human approval** from a trusted role (Collaborator, Member, or Owner).`);
    }
  }

  // 4. Verify Resolved Comments (GraphQL)
  core.info(`Checking for unresolved review comment threads for PR #${pr.number}...`);
  const gqlQuery = `
    query($owner: String!, $repo: String!, $pullNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pullNumber) {
          reviewThreads(first: 100) {
            nodes {
              isResolved
              comments(first: 1) {
                nodes {
                  body
                  author {
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const gqlResult = await withRetry(core, () => github.graphql(gqlQuery, {
    owner,
    repo,
    pullNumber: pr.number,
  }));

  const threads = gqlResult.repository?.pullRequest?.reviewThreads?.nodes || [];
  const unresolvedThreads = threads.filter(t => !t.isResolved);

  if (unresolvedThreads.length > 0) {
    reasons.push(`- **Review Comments**: All review comments must be resolved. There are currently ${unresolvedThreads.length} unresolved thread(s):\n` +
      unresolvedThreads.map(t => {
        const firstComment = t.comments?.nodes?.[0];
        const author = firstComment?.author?.login ? `@${firstComment.author.login}` : 'unknown';
        const body = firstComment?.body ? firstComment.body.replace(/\r?\n/g, ' ').substring(0, 60) + '...' : 'No comment body';
        return `  - Thread by ${author}: "${body}"`;
      }).join('\n')
    );
  }

  return {
    success: reasons.length === 0,
    reasons,
    ciPending,
  };
}
