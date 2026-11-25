import test from 'node:test';
import assert from 'node:assert';
import proxyApprovePr from '../proxy-approve-pr.js';

test('proxy-approve-pr.js tests', async (t) => {
  await t.test('gracefully skips execution when feature is disabled', async () => {
    const logs = [];
    const core = {
      info: (msg) => logs.push(msg),
      warning: (msg) => logs.push(msg),
      setFailed: (msg) => {
        throw new Error(msg);
      },
    };

    await proxyApprovePr({
      github: {},
      context: { repo: { owner: 'rancher', repo: 'test' } },
      core,
      process: { env: { FEATURE_PR_APPROVAL_PROXY: 'false', PR_NUMBER: '42' } },
    });

    assert.ok(logs.some((l) => l.includes('Passing gracefully')));
  });

  await t.test('submits review and enables automerge when open', async () => {
    const logs = [];
    let reviewSubmitted = false;
    let autoMergeEnabled = false;

    const core = {
      info: (msg) => logs.push(msg),
      warning: (msg) => logs.push(msg),
      setFailed: (msg) => {
        throw new Error(msg);
      },
    };

    const github = {
      rest: {
        pulls: {
          get: async () => ({
            data: { state: 'open', node_id: 'PR_kwD123' },
          }),
          createReview: async (params) => {
            if (params.event === 'APPROVE') {
              reviewSubmitted = true;
            }
            return { data: {} };
          },
        },
      },
      graphql: async (mutation) => {
        if (mutation.includes('enablePullRequestAutoMerge')) {
          autoMergeEnabled = true;
        }
        return {};
      },
    };

    await proxyApprovePr({
      github,
      context: { repo: { owner: 'rancher', repo: 'test' } },
      core,
      process: { env: { FEATURE_PR_APPROVAL_PROXY: 'true', PR_NUMBER: '42' } },
    });

    assert.strictEqual(reviewSubmitted, true);
    assert.strictEqual(autoMergeEnabled, true);
    assert.ok(logs.some((l) => l.includes('Successfully submitted approving review')));
  });
});
