import { execSync } from 'child_process';
import { loadComponents, resolveHighestComponent, validateCommitTitleAgainstComponent } from './component-resolver.js';

/**
 * Validates a single commit title against Conventional Commits and strict product-boundary semver rules.
 * This function is fully exported and modular for clean reuse across different workflows and scripts!
 */
export function validateCommitTitle(title, affectsProductOrComponent, isMerge, isReleaseBranch = false) {
  // Allow and skip standard git merge commits (which have multiple parents)
  if (isMerge) {
    return { valid: true, isMerge: true };
  }

  if (typeof affectsProductOrComponent === 'object' && affectsProductOrComponent !== null) {
    return validateCommitTitleAgainstComponent(title, affectsProductOrComponent, isMerge, isReleaseBranch);
  }

  const affectsProduct = affectsProductOrComponent === true;

  /**
   * Commit message prefixes indicate semver changes.
   * 'refactor:' prefix conveys that this is a change in the EU product and breaks a user interface, it should result in a major semver change.
   * 'feat:' prefix conveys that this is a change in the EU product and adds or updates a user interface, it should result in a minor semver change.
   * 'fix:' prefix conveys that this is a change in the EU product and resolves unwanted or bad behavior, it should result in a trivial semver change.
   * Any prefix can have '!' appended to it, such as 'fix!:', this indicates a breaking fix which should result in a major semver change.
   * Any prefix other than 'refactor', 'feat', or 'fix' represents a change that isn't in the EU product and should result in a trivial semver change.
   */
  const CONVENTIONAL_COMMIT_REGEXP =
    /^(refactor|feat|fix|docs|test|build|ci|chore|env|dev|unit|integration|e2e|product-docs)(?:\([^)]+\))?(!?): .+/i;

  if (!CONVENTIONAL_COMMIT_REGEXP.test(title)) {
    return {
      valid: false,
      reason:
        `Commit message title does not follow Conventional Commits format. ` +
        `Expected "type: description" or "type(scope): description". ` +
        `Accepted types: refactor, feat, fix, docs, test, build, ci, chore, env, dev, unit, integration, e2e, product-docs. ` +
        `Got: "${title}"`,
    };
  }

  // Extract type and exclamation indicator from title
  const match = title.match(/^([a-z0-9_-]+)(?:\([^)]+\))?(!?):/i);
  const type = match[1].toLowerCase();
  const hasExclamation = match[2] === '!';

  // Enforce strict product-boundary check for semver safety (non-product changes cannot use feat, refactor, or !)
  if (!affectsProduct) {
    if (type === 'feat' || type === 'refactor' || type === 'fix' || hasExclamation) {
      return {
        valid: false,
        reason: `Non-product change (outside 'internal/') must NOT use 'feat', 'refactor', fix, or '!' breaking-change indicators (which trigger incorrect minor/major semver bumps on release-please).`,
      };
    }
  }

  return { valid: true };
}

/**
 * Main GHA Script runner function executed inside pull_request.yaml
 */
export default async ({ github, context, core, process }) => {
  const prNumber = process.env.PR_NUMBER || context.payload.pull_request?.number || context.issue.number;
  if (!prNumber) {
    throw new Error('Could not determine pull request number from context');
  }

  const owner = context.repo.owner;
  const repo = context.repo.repo;

  core.info(`Retrieving commit messages for PR #${prNumber}...`);
  const commits = await github.paginate(github.rest.pulls.listCommits, {
    owner,
    repo,
    pull_number: prNumber,
  });

  core.info(`Retrieving changed files list for PR #${prNumber}...`);
  const files = await github.paginate(github.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: prNumber,
  });

  const components = loadComponents();
  const filePaths = files.map((f) => f.filename);
  const { highestComponent, fileComponentMap } = resolveHighestComponent(filePaths, components);

  core.info(`==> Evaluated ${filePaths.length} changed file(s) across components.`);
  for (const [f, compName] of Object.entries(fileComponentMap).slice(0, 10)) {
    core.info(`  - ${f} -> [${compName}]`);
  }
  if (filePaths.length > 10) {
    core.info(`  ... and ${filePaths.length - 10} more files`);
  }
  core.info(
    `==> Highest-priority component in hierarchy: "${highestComponent.name}" (Allowed types: ${highestComponent.allowed_types.join(', ')})`,
  );

  const targetBranch = context.payload?.pull_request?.base?.ref || process.env.BASE_REF || 'main';
  const backportBranchesStr = process.env.BACKPORT_BRANCHES || '[]';
  let backportBranches;
  try {
    backportBranches = JSON.parse(backportBranchesStr);
  } catch {
    backportBranches = [];
  }

  const isReleaseBranch =
    backportBranches.includes(targetBranch) ||
    targetBranch.startsWith('release/') ||
    targetBranch.startsWith('release-');

  if (isReleaseBranch) {
    core.info(
      `ℹ️ Target branch "${targetBranch}" is a release branch. Relaxing commit prefix restrictions (prefixes only categorize changelog entries because release-as controls versioning).`,
    );
  }

  let allPassed = true;

  for (const c of commits) {
    const message = c.commit.message;
    const subjectLine = message.split('\n')[0].trim();
    core.info(`--------------------------------------------------`);
    core.info(`Checking message: "${subjectLine}"`);

    // 1. Empty Check
    if (!subjectLine) {
      core.error(
        'Error: Commit message subject line is empty.\n' +
          '❌ Problem: Commit message has no subject line.\n' +
          '💡 How to fix: Provide a concise conventional commit summary.\n' +
          `   git commit --amend -m "${highestComponent.allowed_types[0]}: description"\n` +
          '   git push --force-with-lease',
      );
      allPassed = false;
      continue;
    }

    // 2. Length Check
    if (subjectLine.length > 70) {
      core.error(
        `Error: Commit message subject line exceeds GitHub 70-character limit (${subjectLine.length} chars).\n` +
          `❌ Subject: "${subjectLine}"\n` +
          `💡 How to fix: Shorten the first line to 70 characters or less, moving detailed explanations into the commit body.\n` +
          `   git commit --amend -m "${highestComponent.allowed_types[0]}: concise summary under 70 chars"\n` +
          `   git push --force-with-lease`,
      );
      allPassed = false;
      continue;
    }

    // Determine if this is a standard git merge commit (any commit with 2 or more parent commits starting with "Merge")
    const isMergeCommit = c.parents && c.parents.length > 1;
    const isMerge = isMergeCommit && /^Merge\s+/i.test(subjectLine);

    // 3. Prefix & Component Check
    const { valid, reason } = validateCommitTitle(subjectLine, highestComponent, isMerge, isReleaseBranch);
    if (!valid) {
      core.error(`Error: ${reason}`);
      allPassed = false;
      continue;
    }

    // 4. Spell Check
    if (!isMerge) {
      try {
        const cspellCmd = `${process.env.GITHUB_WORKSPACE}/.github/workflows/scripts/nix-run.sh cspell stdin --quiet --words-only`;
        const words = execSync(cspellCmd, {
          input: subjectLine,
          stdio: ['pipe', 'pipe', 'ignore'],
        })
          .toString()
          .trim();

        if (words) {
          core.error(
            `Error: Commit message contains spelling errors on: ${words.replace(/\r?\n/g, ', ')}\n` +
              `❌ Subject: "${subjectLine}"\n` +
              `💡 How to fix: Correct the spelling, or if this is an intentional domain term, add it to custom_words.txt.\n` +
              `   git commit --amend\n` +
              `   git push --force-with-lease`,
          );
          allPassed = false;
          continue;
        }
      } catch (err) {
        core.warning(`Spell check execution skipped or failed: ${err.message}`);
      }
    }

    core.info(`✅ Message "${subjectLine}" passed all checks.`);
  }

  if (!allPassed) {
    core.setFailed(
      `Commit message validation failed.\n` +
        `📂 Highest-priority component: "${highestComponent.name}"\n` +
        `✅ Allowed commit prefix(es): [${highestComponent.allowed_types.join(', ')}]\n` +
        `Please review the error details above, amend your commit(s), and push with --force-with-lease.`,
    );
  } else {
    core.info('==================================================');
    core.info('All commit messages successfully validated!');
  }
};
