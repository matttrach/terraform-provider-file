import test from 'node:test';
import assert from 'node:assert';
import manageProjectIssue, { extractIssueNumbers } from '../manage-project-issue.js';

test('manage-project-issue.js tests', async (t) => {
  await t.test('extractIssueNumbers extracts single and multiple issues', () => {
    assert.deepStrictEqual(extractIssueNumbers('Fixes #123'), [123]);
    assert.deepStrictEqual(extractIssueNumbers('Closes #45 and resolves #678'), [45, 678]);
    assert.deepStrictEqual(extractIssueNumbers('Ref #99, also issue #99'), [99]);
    assert.deepStrictEqual(extractIssueNumbers('No issue mentioned here'), []);
    assert.deepStrictEqual(extractIssueNumbers(''), []);
    assert.deepStrictEqual(extractIssueNumbers(null), []);
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

    await manageProjectIssue({
      github: {},
      context: { repo: { owner: 'rancher', repo: 'test' } },
      core,
      process: { env: { FEATURE_ISSUE_MANAGEMENT: 'false' } },
    });

    assert.ok(logs.some((l) => l.includes('Passing gracefully')));
  });

  await t.test('skips when no linked issues are found', async () => {
    const logs = [];
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
            data: { title: 'feat: regular feature', body: 'No references' },
          }),
        },
      },
    };

    await manageProjectIssue({
      github,
      context: { repo: { owner: 'rancher', repo: 'test' } },
      core,
      process: {
        env: {
          FEATURE_ISSUE_MANAGEMENT: 'true',
          TARGET_STATUS: 'In Review',
          PR_NUMBER: '10',
        },
      },
    });

    assert.ok(logs.some((l) => l.includes('No linked issue references found')));
  });
});
