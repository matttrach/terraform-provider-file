import test from 'node:test';
import assert from 'node:assert';
import generateRcTag from '../generate-rc-tag.js';

test('generate-rc-tag.js tests', async (t) => {
  await t.test('generates valid RC tag output', async () => {
    let outputTag = '';
    const core = {
      info: () => {},
      warning: () => {},
      setOutput: (key, val) => {
        if (key === 'tag') {
          outputTag = val;
        }
      },
      setFailed: (msg) => {
        throw new Error(msg);
      },
    };

    await generateRcTag({
      github: {},
      context: { ref: 'refs/heads/main' },
      core,
      process: { env: { BRANCH: 'main' } },
    });

    assert.ok(outputTag.startsWith('v'));
    assert.ok(outputTag.includes('-rc.'));
  });
});
