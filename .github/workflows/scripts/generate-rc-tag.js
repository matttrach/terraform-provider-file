// generate-rc-tag.js - Determines the next RC tag for automatic RC releases.
// Conforms to github-script.instructions.md guidelines.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export default async ({ context, core, process }) => {
  const branch = process.env.BRANCH || context.ref?.replace('refs/heads/', '') || 'main';
  core.info(`Determining next RC tag for branch: ${branch}...`);

  let tagsOutput = '';
  try {
    const { stdout } = await execFileAsync('git', ['tag', '--sort=-v:refname']);
    tagsOutput = stdout;
  } catch (err) {
    core.warning(`Notice: Could not fetch git tags: ${err.message}`);
  }

  const tags = tagsOutput
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);
  const rcRegex = /^v(\d+\.\d+\.\d+)-rc\.?(\d+)$/;
  const releaseRegex = /^v(\d+\.\d+\.\d+)$/;

  const latestRc = tags.find((t) => rcRegex.test(t));
  let nextTag = 'v0.1.0-rc.1';

  if (latestRc) {
    const match = latestRc.match(rcRegex);
    const base = match[1];
    const rcNum = parseInt(match[2], 10) + 1;
    nextTag = `v${base}-rc.${rcNum}`;
  } else {
    const latestRelease = tags.find((t) => releaseRegex.test(t));
    if (latestRelease) {
      const match = latestRelease.match(releaseRegex);
      const parts = match[1].split('.').map((p) => parseInt(p, 10));
      parts[2] += 1; // Bump patch version for next RC
      nextTag = `v${parts.join('.')}-rc.1`;
    }
  }

  core.info(`Generated next RC tag: ${nextTag}`);
  core.setOutput('tag', nextTag);
};
