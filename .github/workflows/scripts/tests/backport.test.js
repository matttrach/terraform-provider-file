import test from 'node:test';
import assert from 'node:assert';
import backport from '../backport.js';

test('backport.js tests', async (t) => {
  await t.test('gracefully skips execution when feature is disabled', async () => {
    const logs = [];
    const core = {
      info: (msg) => logs.push(msg),
      warning: (msg) => logs.push(msg),
      setFailed: (msg) => {
        throw new Error(msg);
      },
    };

    await backport({
      github: {},
      context: { repo: { owner: 'rancher', repo: 'test' }, sha: 'abc1234' },
      core,
      process: { env: { FEATURE_AUTOMATIC_BACKPORTING: 'false' } },
    });

    assert.ok(logs.some((l) => l.includes('Passing gracefully')));
  });

  await t.test('gracefully skips execution when backport_branches is empty', async () => {
    const logs = [];
    const core = {
      info: (msg) => logs.push(msg),
      warning: (msg) => logs.push(msg),
      setFailed: (msg) => {
        throw new Error(msg);
      },
    };

    await backport({
      github: {},
      context: { repo: { owner: 'rancher', repo: 'test' }, sha: 'abc1234' },
      core,
      process: {
        env: {
          FEATURE_AUTOMATIC_BACKPORTING: 'true',
          BACKPORT_BRANCHES: '[]',
        },
      },
    });

    assert.ok(logs.some((l) => l.includes('No target branches configured')));
  });
});
