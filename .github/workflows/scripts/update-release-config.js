// update-release-config.js - Updates release-please-config.json with release-as and last-release-sha for release branches.
// Conforms to github-script.instructions.md guidelines.

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function calculateNextPatchVersion(tag) {
  const cleanTag = tag.replace(/^v/, '');
  const parts = cleanTag.split('.').map((p) => parseInt(p, 10));
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    parts[2] += 1;
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return `${cleanTag}.1`;
}

export function updateConfigContent(originalConfig, releaseAs, lastReleaseSha) {
  const updated = JSON.parse(JSON.stringify(originalConfig));
  if (!updated.packages) {
    updated.packages = {};
  }
  if (!updated.packages['.']) {
    updated.packages['.'] = {};
  }

  updated.packages['.']['release-as'] = releaseAs;
  updated.packages['.']['last-release-sha'] = lastReleaseSha;

  return updated;
}

export default async ({ context, core, process }) => {
  const enabled = process.env.FEATURE_AUTOMATIC_BACKPORTING;
  if (enabled !== 'true') {
    core.info(
      'Automatic backporting / release branch management is disabled in .github/repo-config.yml. Passing gracefully.',
    );
    return;
  }

  const targetBranch = process.env.TARGET_BRANCH || context.ref?.replace('refs/heads/', '');
  if (!targetBranch) {
    core.setFailed('TARGET_BRANCH could not be determined.');
    return;
  }

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

  if (!isReleaseBranch) {
    core.info(`Branch "${targetBranch}" is not a recognized release branch. Passing gracefully.`);
    return;
  }

  core.info(`==> Updating release-please configuration for release branch: ${targetBranch}...`);

  // 1. Identify latest tag on the target branch
  let latestTag = '';
  let latestSha = '';

  try {
    const { stdout: tagOut } = await execFileAsync('git', ['describe', '--tags', '--abbrev=0']);
    latestTag = tagOut.trim();
    const { stdout: shaOut } = await execFileAsync('git', ['rev-list', '-n', '1', latestTag]);
    latestSha = shaOut.trim();
  } catch (err) {
    core.warning(`Notice: Could not automatically describe tags on branch: ${err.message}`);
  }

  if (!latestTag || !latestSha) {
    core.info('No existing release tag found on branch. Skipping configuration update.');
    return;
  }

  const nextVersion = calculateNextPatchVersion(latestTag);
  core.info(`Found latest tag ${latestTag} (${latestSha.slice(0, 8)}). Next release-as version: ${nextVersion}`);

  // 2. Read and update release-please-config.json
  const configPath = path.resolve(process.env.GITHUB_WORKSPACE || '.', 'release-please-config.json');
  let config;
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    config = JSON.parse(raw);
  } catch (err) {
    core.setFailed(`Error reading ${configPath}: ${err.message}`);
    return;
  }

  const updatedConfig = updateConfigContent(config, nextVersion, latestSha);
  await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2) + '\n', 'utf8');
  core.info(
    `🟢 Successfully updated release-please-config.json with release-as: "${nextVersion}" and last-release-sha: "${latestSha}".`,
  );

  // 3. Commit and push the configuration update to the release branch
  try {
    await execFileAsync('git', ['config', 'user.name', 'github-actions[bot]']);
    await execFileAsync('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);
    await execFileAsync('git', ['add', 'release-please-config.json']);

    const { stdout: status } = await execFileAsync('git', ['status', '--porcelain']);
    if (status.trim()) {
      await execFileAsync('git', [
        'commit',
        '-m',
        `chore(release): update release-please config to release-as ${nextVersion} [skip ci]`,
      ]);
      await execFileAsync('git', ['push', 'origin', targetBranch]);
      core.info(`🟢 Pushed updated release-please config to branch "${targetBranch}".`);
    } else {
      core.info('release-please-config.json is already up to date.');
    }
  } catch (err) {
    core.warning(`Notice: Could not commit and push configuration update: ${err.message}`);
  }
};
