// backport.js - Automatically cherry-picks merged commits to configured backport branches and opens PRs.
// Conforms to github-script.instructions.md guidelines.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export default async ({ github, context, core, process }) => {
  const enabled = process.env.FEATURE_AUTOMATIC_BACKPORTING;
  if (enabled !== 'true') {
    core.info('Automatic backporting feature is disabled in .github/repo-config.yml. Passing gracefully.');
    return;
  }

  const branchesStr = process.env.BACKPORT_BRANCHES || '[]';
  let targetBranches = [];
  try {
    targetBranches = JSON.parse(branchesStr);
  } catch (err) {
    core.warning(`Notice: Failed to parse BACKPORT_BRANCHES: ${err.message}`);
  }

  if (!Array.isArray(targetBranches) || targetBranches.length === 0) {
    core.info('No target branches configured for backporting. Passing gracefully.');
    return;
  }

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const sha = context.sha;
  const prNumber = process.env.PR_NUMBER || context.payload?.pull_request?.number;

  core.info(
    `==> Starting automatic backporting for commit ${sha} (PR #${prNumber || 'N/A'}) to branches: ${targetBranches.join(', ')}`,
  );

  // Configure git identity
  await execFileAsync('git', ['config', 'user.name', 'github-actions[bot]']);
  await execFileAsync('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);

  for (const branch of targetBranches) {
    core.info(`Processing backport to target branch: ${branch}...`);
    const backportBranch = `backport/${branch}/${sha.slice(0, 8)}`;

    try {
      // Fetch latest base branch
      await execFileAsync('git', ['fetch', 'origin', branch]);
      await execFileAsync('git', ['checkout', '-b', backportBranch, `origin/${branch}`]);

      // Cherry-pick commit
      await execFileAsync('git', ['cherry-pick', '-x', sha]);

      // Push backport branch
      await execFileAsync('git', ['push', 'origin', backportBranch]);

      // Create PR
      const { data: newPr } = await github.rest.pulls.create({
        owner,
        repo,
        title: `[Backport ${branch}] PR #${prNumber || sha.slice(0, 8)}`,
        head: backportBranch,
        base: branch,
        body: `Automated backport of commit ${sha} to \`${branch}\`.`,
      });

      core.info(`🟢 Created backport PR #${newPr.number} targeting ${branch}.`);
    } catch (err) {
      core.warning(`Failed to cleanly backport commit ${sha} to ${branch}: ${err.message}`);
      await execFileAsync('git', ['cherry-pick', '--abort']).catch(() => {});
      await execFileAsync('git', ['checkout', 'main']).catch(() => {});
    }
  }
};
