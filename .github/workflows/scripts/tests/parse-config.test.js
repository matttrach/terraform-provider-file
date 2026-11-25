import test from 'node:test';
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

test('parse-config.sh tests', async (t) => {
  const scriptPath = path.resolve('.github/workflows/scripts/parse-config.sh');

  await t.test('successfully parses default repo-config.yml', async () => {
    const tmpOut = path.join(os.tmpdir(), `test-output-${Date.now()}.txt`);
    try {
      await execFileAsync('bash', [scriptPath, '.github/repo-config.yml'], {
        env: { ...process.env, GITHUB_OUTPUT: tmpOut },
      });

      const content = await fs.readFile(tmpOut, 'utf8');
      assert.ok(content.includes('feature_automatic_changelog_and_release=true'));
      assert.ok(content.includes('feature_testing_unit=true'));
      assert.ok(content.includes('feature_testing_integration=false'));
      assert.ok(content.includes('feature_testing_e2e=true'));
      assert.ok(content.includes('"enabled":true'));
      assert.ok(content.includes('"enabled":false'));
    } finally {
      await fs.rm(tmpOut, { force: true });
    }
  });

  await t.test('uses fallback defaults when config file is missing', async () => {
    const tmpOut = path.join(os.tmpdir(), `test-missing-${Date.now()}.txt`);
    try {
      await execFileAsync('bash', [scriptPath, 'non-existent-config.yml'], {
        env: { ...process.env, GITHUB_OUTPUT: tmpOut },
      });

      const content = await fs.readFile(tmpOut, 'utf8');
      assert.ok(content.includes('feature_automatic_changelog_and_release=false'));
      assert.ok(content.includes('feature_testing_unit=true'));
      assert.ok(content.includes('feature_testing_integration=false'));
      assert.ok(content.includes('feature_testing_e2e=false'));
    } finally {
      await fs.rm(tmpOut, { force: true });
    }
  });
});
