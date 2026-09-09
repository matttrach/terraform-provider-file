import test from 'node:test';
import assert from 'node:assert';

test('check-maintainer.js tests', async (t) => {
  const { default: checkMaintainer } = await import('../check-maintainer.js');

  await t.test('returns true when actor is in maintainers list', async () => {
    const coreLogs = [];
    const outputs = {};
    const core = {
      info: (msg) => coreLogs.push(msg),
      setFailed: (msg) => {
        throw new Error(msg);
      },
      setOutput: (key, val) => {
        outputs[key] = val;
      },
    };
    const context = {
      actor: 'matttrach',
    };
    const localProcess = {
      env: {
        TERRAFORM_MAINTAINERS: '["matttrach", "another_maintainer"]',
      },
    };

    await checkMaintainer({
      github: {},
      context,
      core,
      process: localProcess,
    });

    assert.strictEqual(outputs['is_maintainer'], true);
    assert.ok(coreLogs.includes('Actor: matttrach, Is Maintainer: true'));
  });

  await t.test('returns false when actor is not in maintainers list', async () => {
    const coreLogs = [];
    const outputs = {};
    const core = {
      info: (msg) => coreLogs.push(msg),
      setFailed: (msg) => {
        throw new Error(msg);
      },
      setOutput: (key, val) => {
        outputs[key] = val;
      },
    };
    const context = {
      actor: 'external_user',
    };
    const localProcess = {
      env: {
        TERRAFORM_MAINTAINERS: '["matttrach"]',
      },
    };

    await checkMaintainer({
      github: {},
      context,
      core,
      process: localProcess,
    });

    assert.strictEqual(outputs['is_maintainer'], false);
    assert.ok(coreLogs.includes('Actor: external_user, Is Maintainer: false'));
  });

  await t.test('fails when TERRAFORM_MAINTAINERS is missing', async () => {
    const failedMessages = [];
    const outputs = {};
    const core = {
      info: () => {},
      setFailed: (msg) => failedMessages.push(msg),
      setOutput: (key, val) => {
        outputs[key] = val;
      },
    };
    const context = { actor: 'matttrach' };
    const localProcess = { env: {} };

    await checkMaintainer({
      github: {},
      context,
      core,
      process: localProcess,
    });

    assert.strictEqual(outputs['is_maintainer'], false);
    assert.strictEqual(failedMessages.length, 1);
    assert.ok(failedMessages[0].includes('TERRAFORM_MAINTAINERS environment variable is not defined'));
  });
});
