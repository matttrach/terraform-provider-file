// merge-pr.js - Decoupled script to execute squash-merge on a Pull Request.
// Conforms to github-script.instructions.md guidelines.

import { execFileSync } from 'child_process';
import { loadComponents, resolveHighestComponent } from './component-resolver.js';

const COMMENT_SIGNATURE = '<!-- auto-merge-verification-signature -->';

async function withRetry(core, fn, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) {
        throw err;
      }
      core.warning(`API call failed (Attempt ${i + 1}/${retries}): ${err.message}. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
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

  if (!process.env.MERGE_TOKEN) {
    throw new Error('MERGE_TOKEN environment variable is required to execute a PR merge.');
  }

  core.info(`Fetching PR #${prNumber} details to execute merge...`);
  const { data: pr } = await withRetry(core, () =>
    github.rest.pulls.get({
      owner,
      repo,
      pull_number: parseInt(prNumber, 10),
    }),
  );

  const sha = pr.head.sha;

  core.info(`Fetching PR #${prNumber} changed files list to evaluate product scope...`);
  const files = await withRetry(core, () =>
    github.paginate(github.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: parseInt(prNumber, 10),
    }),
  );

  const components = loadComponents();
  const filePaths = files.map((f) => f.filename);
  const { highestComponent } = resolveHighestComponent(filePaths, components);
  core.info(
    `PR #${prNumber} highest component in hierarchy: ${highestComponent.name} (allowed types: ${highestComponent.allowed_types.join(', ')})`,
  );

  core.info(`Fetching PR #${prNumber} commits to craft squash message...`);
  const commits = await withRetry(core, () =>
    github.paginate(github.rest.pulls.listCommits, {
      owner,
      repo,
      pull_number: parseInt(prNumber, 10),
    }),
  );

  const commitsList = commits.map((c) => `- ${c.commit.message}`).join('\n');

  const mergeParams = {
    owner,
    repo,
    pull_number: parseInt(prNumber, 10),
    merge_method: 'squash',
    sha,
  };

  // Build conventional squash commit title and message without Copilot
  let titleCandidate = pr.title ? pr.title.trim() : '';
  const initialMsg = commits[0]?.commit?.message?.split('\n')[0].trim();
  if (!titleCandidate && initialMsg) {
    titleCandidate = initialMsg;
  }
  if (!titleCandidate) {
    titleCandidate = `squash PR #${prNumber}`;
  }

  let commitTitle = titleCandidate;
  const match = commitTitle.match(/^([a-z0-9_-]+)(?:\([^)]+\))?(!?):/i);
  const allowedTypes = (highestComponent.allowed_types || []).map((t) => t.toLowerCase());

  if (!match) {
    commitTitle = `${allowedTypes[0]}: ${commitTitle}`;
  } else {
    const type = match[1].toLowerCase();
    const hasExclamation = match[2] === '!';

    if (!allowedTypes.includes(type)) {
      commitTitle = commitTitle.replace(/^([a-z0-9_-]+)/i, allowedTypes[0]);
      core.warning(
        `Adjusted commit title prefix to "${allowedTypes[0]}" to match highest component "${highestComponent.name}".`,
      );
    }
    if (!highestComponent.is_product && hasExclamation) {
      commitTitle = commitTitle.replace('!:', ':');
      core.warning(
        `Removed breaking change "!" from commit title on non-product component "${highestComponent.name}".`,
      );
    }
  }

  // Construct commit message body
  const bodyParts = [];
  if (pr.body && pr.body.trim()) {
    bodyParts.push(pr.body.trim());
  }
  if (commits.length > 1) {
    bodyParts.push('');
    bodyParts.push('Original Commits:');
    bodyParts.push(commitsList);
  }
  const commitMessage = bodyParts.join('\n').trim();

  mergeParams.commit_title = commitTitle;
  mergeParams.commit_message = commitMessage;

  core.info(
    `Conventional Squash Commit Message:\nTitle: ${mergeParams.commit_title}\nBody:\n${mergeParams.commit_message}`,
  );

  // Delete warning comments before merging
  await deleteBotCommentIfExists({ github, core, owner, repo, prNumber: parseInt(prNumber, 10) });

  core.info(`🚀 Merging PR #${prNumber} with Squash method...`);
  // Use GitHub CLI with --auto to leverage GitHub's native auto-merge backend.
  // This bypasses the REST API GITHUB_TOKEN merge restriction for fork PRs!
  try {
    const args = [
      'pr',
      'merge',
      prNumber,
      '--auto',
      '--squash',
      '--subject',
      mergeParams.commit_title,
      '--body',
      mergeParams.commit_message,
    ];
    execFileSync('gh', args, { env: { ...process.env, GH_TOKEN: process.env.MERGE_TOKEN } });
    core.info(`PR #${prNumber} auto-merge enabled/merged successfully via GitHub CLI!`);
  } catch (err) {
    core.warning(`Failed to enable auto-merge via gh CLI: ${err.message}. Retrying direct merge via gh CLI...`);
    try {
      const args = [
        'pr',
        'merge',
        prNumber,
        '--squash',
        '--subject',
        mergeParams.commit_title,
        '--body',
        mergeParams.commit_message,
      ];
      execFileSync('gh', args, { env: { ...process.env, GH_TOKEN: process.env.MERGE_TOKEN } });
      core.info(`PR #${prNumber} merged directly via gh CLI successfully!`);
    } catch (directErr) {
      core.warning(`Failed direct merge via gh CLI: ${directErr.message}. Retrying REST API merge with merge token...`);
      try {
        await withRetry(core, () => github.rest.pulls.merge(mergeParams));
        core.info(`PR #${prNumber} merged via REST API successfully!`);
      } catch (apiErr) {
        core.error(`All merge attempts failed for PR #${prNumber}: ${apiErr.message}`);
        throw apiErr;
      }
    }
  }
};

/**
 * Deletes the warning comment if it exists.
 */
async function deleteBotCommentIfExists({ github, core, owner, repo, prNumber }) {
  const comments = await withRetry(core, () =>
    github.paginate(github.rest.issues.listComments, {
      owner,
      repo,
      issue_number: prNumber,
    }),
  );

  const botComment = comments.find((c) => c.body && c.body.includes(COMMENT_SIGNATURE));
  if (botComment) {
    core.info(`Deleting old auto-merge warning comment on PR #${prNumber} before merging`);
    try {
      await withRetry(core, () =>
        github.rest.issues.deleteComment({
          owner,
          repo,
          comment_id: botComment.id,
        }),
      );
    } catch (err) {
      core.warning(`Could not delete comment ${botComment.id}: ${err.message}`);
    }
  }
}
