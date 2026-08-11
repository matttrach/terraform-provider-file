// merge-pr.js - Decoupled script to execute squash-merge on a Pull Request.
// Conforms to github-script.instructions.md guidelines.

import { execSync } from 'child_process';
import fs from 'fs';

const COMMENT_SIGNATURE = '<!-- scheduled-pr-verification-signature -->';

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

  if (!process.env.MERGE_TOKEN) {
    throw new Error('MERGE_TOKEN environment variable is required to execute a PR merge.');
  }

  core.info(`Fetching PR #${prNumber} details to execute merge...`);
  const { data: pr } = await withRetry(core, () => github.rest.pulls.get({
    owner,
    repo,
    pull_number: parseInt(prNumber, 10),
  }));

  const sha = pr.head.sha;
  const isFork = pr.head.repo?.full_name !== pr.base.repo?.full_name;

  core.info(`Fetching PR #${prNumber} changed files list to evaluate product scope...`);
  const files = await withRetry(core, () => github.paginate(github.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: parseInt(prNumber, 10),
  }));

  const affectsProduct = files.some(f => f.filename.startsWith('internal/'));
  core.info(`PR #${prNumber} affects product (contains changes inside 'internal/'): ${affectsProduct}`);

  core.info(`Fetching PR #${prNumber} commits to craft squash message...`);
  const commits = await withRetry(core, () => github.paginate(github.rest.pulls.listCommits, {
    owner,
    repo,
    pull_number: parseInt(prNumber, 10),
  }));

  const commitsList = commits.map(c => `- ${c.commit.message}`).join('\n');
  
  const mergeParams = {
    owner,
    repo,
    pull_number: parseInt(prNumber, 10),
    merge_method: 'squash',
    sha,
  };

  let conventionalMsg = null;
  let validationError = "";
  let isValid = false;
  const maxTries = 3;

  for (let attempt = 1; attempt <= maxTries; attempt++) {
    core.info(`Generating Conventional Commit squash message (Attempt ${attempt}/${maxTries})...`);
    conventionalMsg = await craftSquashCommitMessage({
      core,
      commitsList,
      affectsProduct,
      process,
      feedback: validationError
    });

    if (!conventionalMsg) {
      validationError = "Failed to generate any response from Copilot.";
      core.warning(`Attempt ${attempt}/${maxTries} failed to obtain response from Copilot.`);
      continue;
    }

    const { valid, reason } = validateCommitTitle(conventionalMsg.commitTitle, affectsProduct);
    if (valid) {
      isValid = true;
      break;
    } else {
      core.warning(`Attempt ${attempt}/${maxTries} generated INVALID title "${conventionalMsg.commitTitle}". Reason: ${reason}`);
      validationError = `The title you generated ("${conventionalMsg.commitTitle}") was rejected for the following reason:\n${reason}\n\nPlease regenerate the commit message. Ensure you strictly adhere to the rules and fix the error above.`;
    }
  }

  if (isValid && conventionalMsg) {
    mergeParams.commit_title = conventionalMsg.commitTitle;
    mergeParams.commit_message = conventionalMsg.commitMessage;
    core.info(`Generated AI Conventional Squash Message is VALID:\nTitle: ${mergeParams.commit_title}\nBody:\n${mergeParams.commit_message}`);
  } else {
    // Fallback: Default to the initial commit message, appending "fix: " if it doesn't already have a type
    const initialMsgFull = commits[0]?.commit?.message || `squash PR #${prNumber}`;
    const msgLines = initialMsgFull.split('\n');
    let defaultTitle = msgLines[0].trim();
    const defaultBodyLines = msgLines.slice(1);

    defaultBodyLines.push('');
    defaultBodyLines.push('Original Commits:');
    defaultBodyLines.push(commitsList);
    const defaultBody = defaultBodyLines.join('\n').trim();

    const CONVENTIONAL_COMMIT_REGEXP = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([^)]+\))?(!?): .+/i;
    const hasType = CONVENTIONAL_COMMIT_REGEXP.test(defaultTitle);
    if (!hasType) {
      defaultTitle = `fix: ${defaultTitle}`;
    } else if (!affectsProduct) {
      const typeMatch = defaultTitle.match(/^([a-z]+)(?:\([^)]+\))?(!?):/i);
      if (typeMatch) {
        const type = typeMatch[1].toLowerCase();
        const hasExclamation = typeMatch[2] === '!';

        if (type === 'feat' || type === 'refactor' || hasExclamation) {
          defaultTitle = defaultTitle.replace(/^([a-z]+)/i, 'chore').replace('!:', ':');
          core.warning(`Downgraded fallback commit title to "${defaultTitle}" to prevent incorrect SemVer bump on non-product change.`);
        }
      }
    }

    mergeParams.commit_title = defaultTitle;
    mergeParams.commit_message = defaultBody;
    core.info(`Using safe, initial-commit conventional fallback message:\nTitle: ${mergeParams.commit_title}\nBody:\n${mergeParams.commit_message}`);
  }

  // Delete warning comments before merging
  await deleteBotCommentIfExists({ github, core, owner, repo, prNumber: parseInt(prNumber, 10) });

  core.info(`🚀 Merging PR #${prNumber} with Squash method...`);
  // Use GitHub CLI with --auto to leverage GitHub's native auto-merge backend.
  // This bypasses the REST API GITHUB_TOKEN merge restriction for fork PRs!
  try {
    const mergeCmd = `gh pr merge ${prNumber} --auto --squash --subject ${JSON.stringify(mergeParams.commit_title)} --body ${JSON.stringify(mergeParams.commit_message)}`;
    execSync(mergeCmd, { env: { ...process.env, GH_TOKEN: process.env.MERGE_TOKEN } });
    core.info(`PR #${prNumber} auto-merge enabled/merged successfully via GitHub CLI!`);
  } catch (autoError) {
    core.warning(`Failed to enable auto-merge via gh CLI: ${autoError.message}. Retrying direct merge via gh CLI...`);
    try {
      const directMergeCmd = `gh pr merge ${prNumber} --squash --subject ${JSON.stringify(mergeParams.commit_title)} --body ${JSON.stringify(mergeParams.commit_message)}`;
      execSync(directMergeCmd, { env: { ...process.env, GH_TOKEN: process.env.MERGE_TOKEN } });
      core.info(`PR #${prNumber} merged directly via gh CLI successfully!`);
    } catch (directError) {
      core.warning(`Failed direct merge via gh CLI: ${directError.message}. Retrying REST API merge with merge token...`);
      try {
        await withRetry(core, () => github.rest.pulls.merge(mergeParams));
        core.info(`PR #${prNumber} merged via REST API successfully!`);
      } catch (restError) {
        core.error(`All merge attempts failed for PR #${prNumber}: ${restError.message}`);
        throw restError;
      }
    }
  }
};

/**
 * Invokes the Copilot CLI inside the Nix environment to consolidate commit history into a high-quality Conventional Commit.
 */
async function craftSquashCommitMessage({ core, commitsList, affectsProduct, process, feedback }) {
  core.info('Invoking Copilot Agent CLI to craft Conventional Squash Commit Message...');

  let safetyDirective = '';
  if (!affectsProduct) {
    safetyDirective = `CRITICAL REGULATORY CONSTRAINT: None of the files modified in this PR are inside the 'internal/' folder. This is a non-product change (e.g. docs, tests, CI workflows).
Therefore, you MUST NOT use the 'feat' or 'refactor' commit types, and you MUST NOT use the '!' breaking-change indicator (which incorrectly trigger minor/major semver bumps on release-please).
Instead, you MUST use 'chore', 'ci', 'docs', 'style', 'test', or 'fix' as the commit type (e.g. 'chore: update workflows' or 'test: add unit coverage').`;
  } else {
    safetyDirective = `Allowed types include: 'fix', 'feat', 'refactor', 'chore', 'docs', 'style', 'test'.
Use 'feat' for new features, 'fix' for bug fixes, and 'refactor' for code restructurings. Use '!' (e.g. 'feat!:') if there is a breaking change.`;
  }

  let feedbackSection = '';
  if (feedback) {
    feedbackSection = `\n\n⚠️ PREVIOUS ATTEMPT FEEDBACK:\n${feedback}\n\nPlease correct your formatting and try again.`;
  }

  const prompt = `You are an expert Conventional Commits writer.
Given the following list of commits from a pull request, draft a clean, high-quality, consolidated Conventional Commit title and body for the final squash merge commit on main.

The first line of your response MUST be exactly the subject line matching the Conventional Commits format: 'type: description' (e.g. 'feat: support dynamic login').

${safetyDirective}${feedbackSection}

Don't use component scopes, just use 'type: description' or 'type!: description'.
Subject lines must not exceed 70 characters due to a GitHub limitation.
The rest of your response must be a clean, bulleted explanation of the detailed changes, separated from the title by a blank line. Do not output any markdown code blocks, prefixes like "Commit message:", or other conversational filler. Just the direct title and body.

Commits in PR:
${commitsList}
`;

  try {
    const promptFile = '.copilot-prompt.txt';
    fs.writeFileSync(promptFile, prompt);

    const cmd = `${process.env.GITHUB_WORKSPACE}/.github/workflows/scripts/nix-run.sh GITHUB_TOKEN='${process.env.GITHUB_TOKEN}' COPILOT_GITHUB_TOKEN='${process.env.GITHUB_TOKEN}' copilot -s --yolo -p '"$(cat ${promptFile})"'`;
    const output = execSync(cmd, { env: { ...process.env, GITHUB_TOKEN: process.env.GITHUB_TOKEN } }).toString().trim();

    try {
      fs.unlinkSync(promptFile);
    } catch (cleanupError) {
      core.warning(`Temporary prompt file cleanup failed: ${cleanupError.message}`);
    }

    if (!output) {
      throw new Error('Copilot returned an empty response');
    }

    const lines = output.split('\n');
    const commitTitle = lines[0].trim();
    const commitMessage = lines.slice(1).join('\n').trim();

    return { commitTitle, commitMessage };
  } catch (error) {
    core.warning(`Copilot message generation failed: ${error.message}. Falling back to default.`);
    return null;
  }
}

/**
 * Validates a single commit title against Conventional Commits and strict product-boundary semver rules.
 */
function validateCommitTitle(title, affectsProduct) {
  const CONVENTIONAL_COMMIT_REGEXP = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([^)]+\))?(!?): .+/i;

  if (!CONVENTIONAL_COMMIT_REGEXP.test(title)) {
    return {
      valid: false,
      reason: 'Commit title does not follow Conventional Commits format. Expected "type: description" or "type(scope): description".'
    };
  }

  const match = title.match(/^([a-z]+)(?:\([^)]+\))?(!?):/i);
  const type = match[1].toLowerCase();
  const hasExclamation = match[2] === '!';

  if (!affectsProduct) {
    if (type === 'feat' || type === 'refactor' || hasExclamation) {
      return {
        valid: false,
        reason: `Non-product change (outside 'internal/') must NOT use 'feat', 'refactor', or '!' breaking-change indicators (which trigger incorrect minor/major semver bumps on release-please).`
      };
    }
  }

  return { valid: true };
}

/**
 * Deletes the warning comment if it exists.
 */
async function deleteBotCommentIfExists({ github, core, owner, repo, prNumber }) {
  const comments = await withRetry(core, () => github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: prNumber,
  }));

  const botComment = comments.find(c => c.body && c.body.includes(COMMENT_SIGNATURE));
  if (botComment) {
    core.info(`Deleting old auto-merge warning comment on PR #${prNumber} before merging`);
    try {
      await withRetry(core, () => github.rest.issues.deleteComment({
        owner,
        repo,
        comment_id: botComment.id,
      }));
    } catch (error) {
      core.warning(`Could not delete comment ${botComment.id}: ${error.message}`);
    }
  }
}
