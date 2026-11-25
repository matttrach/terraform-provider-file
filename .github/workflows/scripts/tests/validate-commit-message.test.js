import test from 'node:test';
import assert from 'node:assert';

test('validate-commit-message.js validateCommitTitle unit tests', async (t) => {
  const { validateCommitTitle } = await import('../validate-commit-message.js');

  await t.test('allows valid conventional commit types when affecting product', async () => {
    assert.deepStrictEqual(validateCommitTitle('feat(auth): add OIDC support', true, false), { valid: true });
    assert.deepStrictEqual(validateCommitTitle('fix: correct memory leak', true, false), { valid: true });
    assert.deepStrictEqual(validateCommitTitle('chore: clean up dependencies', true, false), { valid: true });
    assert.deepStrictEqual(validateCommitTitle('refactor!: drop old support', true, false), { valid: true });
  });

  await t.test('blocks major/minor/breaking commit types for non-product changes', async () => {
    // feat is minor
    const featRes = validateCommitTitle('feat: update readme', false, false);
    assert.strictEqual(featRes.valid, false);
    assert.ok(featRes.reason.includes("'feat'"));

    // refactor is major
    const refactorRes = validateCommitTitle('refactor: simplify test loop', false, false);
    assert.strictEqual(refactorRes.valid, false);
    assert.ok(refactorRes.reason.includes("'refactor'"));

    // breaking ! is major
    const breakingRes = validateCommitTitle('chore!: delete old workflow', false, false);
    assert.strictEqual(breakingRes.valid, false);
    assert.ok(breakingRes.reason.includes("'!'"));
  });

  await t.test('allows non-bumping types for non-product changes', async () => {
    assert.deepStrictEqual(validateCommitTitle('chore: update readme', false, false), { valid: true });
    assert.deepStrictEqual(validateCommitTitle('ci: update workflows', false, false), { valid: true });
    assert.deepStrictEqual(validateCommitTitle('test: add more checks', false, false), { valid: true });
  });

  await t.test('allows standard merge commits', async () => {
    assert.deepStrictEqual(validateCommitTitle('Merge branch "main"', false, true), { valid: true, isMerge: true });
  });

  await t.test('blocks invalid conventional commit formats', async () => {
    const res = validateCommitTitle('added new feature without prefix', true, false);
    assert.strictEqual(res.valid, false);
    assert.ok(res.reason.includes('does not follow Conventional Commits format'));
  });
});

test('validate-commit-message.js runner tests', async (t) => {
  const { default: runner } = await import('../validate-commit-message.js');

  await t.test('runner passes when all commits are valid', async () => {
    const infoLogs = [];
    const core = {
      info: (msg) => infoLogs.push(msg),
      warning: () => {},
      error: (msg) => {
        throw new Error(msg);
      },
      setFailed: (msg) => {
        throw new Error(msg);
      },
    };

    const context = {
      issue: { number: 42 },
      repo: { owner: 'rancher', repo: 'terraform-provider-file' },
    };

    const localProcess = {
      env: { PR_NUMBER: '42' },
    };

    const github = {
      paginate: async (method) => {
        if (method === github.rest.pulls.listCommits) {
          return [
            { commit: { message: 'feat: add internal provider feature' }, parents: [] },
            { commit: { message: 'fix: minor updates' }, parents: [] },
          ];
        }
        if (method === github.rest.pulls.listFiles) {
          return [{ filename: 'internal/provider/provider.go' }];
        }
        return [];
      },
      rest: {
        pulls: {
          listCommits: () => {},
          listFiles: () => {},
        },
      },
    };

    await runner({ github, context, core, process: localProcess });

    assert.ok(infoLogs.includes('All commit messages successfully validated!'));
  });

  await t.test('runner fails when non-product change uses feat', async () => {
    let failedMsg = '';
    const errors = [];
    const core = {
      info: () => {},
      warning: () => {},
      error: (msg) => errors.push(msg),
      setFailed: (msg) => {
        failedMsg = msg;
      },
    };

    const context = {
      issue: { number: 42 },
      repo: { owner: 'rancher', repo: 'terraform-provider-file' },
    };

    const localProcess = {
      env: { PR_NUMBER: '42' },
    };

    const github = {
      paginate: async (method) => {
        if (method === github.rest.pulls.listCommits) {
          return [{ commit: { message: 'feat: update README' }, parents: [] }];
        }
        if (method === github.rest.pulls.listFiles) {
          return [{ filename: 'README.md' }];
        }
        return [];
      },
      rest: {
        pulls: {
          listCommits: () => {},
          listFiles: () => {},
        },
      },
    };

    await runner({ github, context, core, process: localProcess });

    assert.ok(errors.some((e) => e.includes('not allowed for component "docs"')));
    assert.ok(failedMsg.includes('Commit message validation failed'));
  });
});
