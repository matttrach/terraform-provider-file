import test from 'node:test';
import assert from 'node:assert';
import updateReleaseConfig, { calculateNextPatchVersion, updateConfigContent } from '../update-release-config.js';

test('update-release-config.js tests', async (t) => {
  await t.test('calculateNextPatchVersion correctly bumps patch numbers', () => {
    assert.strictEqual(calculateNextPatchVersion('v1.2.3'), '1.2.4');
    assert.strictEqual(calculateNextPatchVersion('v0.1.0'), '0.1.1');
    assert.strictEqual(calculateNextPatchVersion('2.0.9'), '2.0.10');
  });

  await t.test('updateConfigContent updates release-as and last-release-sha', () => {
    const original = {
      packages: {
        '.': {
          'release-type': 'simple',
        },
      },
    };

    const updated = updateConfigContent(original, '1.2.4', 'abc1234sha');
    assert.strictEqual(updated.packages['.']['release-as'], '1.2.4');
    assert.strictEqual(updated.packages['.']['last-release-sha'], 'abc1234sha');
    assert.strictEqual(updated.packages['.']['release-type'], 'simple');
  });

  await t.test('gracefully skips execution when feature is disabled', async () => {
    const logs = [];
    const core = {
      info: (msg) => logs.push(msg),
      warning: (msg) => logs.push(msg),
      setFailed: (msg) => {
        throw new Error(msg);
      },
    };

    await updateReleaseConfig({
      github: {},
      context: { ref: 'refs/heads/release/v1.0' },
      core,
      process: { env: { FEATURE_AUTOMATIC_BACKPORTING: 'false' } },
    });

    assert.ok(logs.some((l) => l.includes('Passing gracefully')));
  });

  await t.test('gracefully skips execution when target branch is not a release branch', async () => {
    const logs = [];
    const core = {
      info: (msg) => logs.push(msg),
      warning: (msg) => logs.push(msg),
      setFailed: (msg) => {
        throw new Error(msg);
      },
    };

    await updateReleaseConfig({
      github: {},
      context: { ref: 'refs/heads/main' },
      core,
      process: {
        env: {
          FEATURE_AUTOMATIC_BACKPORTING: 'true',
          TARGET_BRANCH: 'main',
          BACKPORT_BRANCHES: '["release/v1.0"]',
        },
      },
    });

    assert.ok(logs.some((l) => l.includes('not a recognized release branch')));
  });
});
