import assert from 'node:assert';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

async function runGitMessage(args, env = {}, cwd = repoRoot) {
  const functionsPath = path.join(repoRoot, '.dev/functions.sh');
  const fallbackPath = path.join(repoRoot, '.functions');
  const script = `
    if [[ -f "${functionsPath}" ]]; then
      . "${functionsPath}"
    else
      . "${fallbackPath}"
    fi
    git_message "$@"
  `;
  return execFileAsync('bash', ['-c', script, 'git_message', ...args], {
    cwd,
    env: { ...process.env, ...env },
  });
}

test('git_message conventional commit and validation rules', async (t) => {
  await t.test('prints usage and exits 0 on --help and -h', async () => {
    const { stdout: stdoutHelp } = await runGitMessage(['--help']);
    assert.match(stdoutHelp, /Usage: git_message \[-m\] <commit-message>/);

    const { stdout: stdoutH } = await runGitMessage(['-h']);
    assert.match(stdoutH, /Usage: git_message \[-m\] <commit-message>/);
  });

  await t.test('fails with error when commit message is missing or empty', async () => {
    await assert.rejects(
      async () => runGitMessage([]),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.match(err.stderr, /Error: Missing commit message\./);
        return true;
      },
    );

    await assert.rejects(
      async () => runGitMessage(['-m', '']),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.match(err.stderr, /Error: Missing commit message\./);
        return true;
      },
    );
  });

  await t.test('fails when commit title does not follow conventional commits', async () => {
    await assert.rejects(
      async () => runGitMessage(['invalid title without type']),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.match(err.stderr, /Error: Commit message does not match conventional commit format/);
        return true;
      },
    );
  });

  await t.test('fails when commit title has conventional type prefix but empty description', async () => {
    await assert.rejects(
      async () => runGitMessage(['fix: ']),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.match(err.stderr, /Error: Commit message does not match conventional commit format/);
        return true;
      },
    );
  });

  await t.test('fails when commit subject line exceeds 72 characters', async () => {
    const longSubject = `fix: ${'a'.repeat(70)}`;
    await assert.rejects(
      async () => runGitMessage([longSubject]),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.match(err.stderr, /Error: Commit subject line exceeds 72 characters/);
        return true;
      },
    );
  });

  await t.test('accepts -- option terminator and does not prepend -- to message', async () => {
    await assert.rejects(
      async () => runGitMessage(['--', 'nonconventional message']),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.match(
          err.stderr,
          /Error: Commit message does not match conventional commit format: 'nonconventional message'/,
        );
        assert.doesNotMatch(err.stderr, /'-- nonconventional message'/);
        return true;
      },
    );
  });

  await t.test('fails when commit message contains spelling errors according to cspell', async () => {
    await assert.rejects(
      async () => runGitMessage(['fix: intentionallyy misspelledd worrd']),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.match(err.stderr, /Error: Commit message contains spelling errors:/);
        return true;
      },
    );
  });
});

test('git_message isolated environment and product boundary rules', async (t) => {
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-msg-suite-'));
  t.after(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  await t.test('fails when remote points to upstream rancher repository', async () => {
    const repo = path.join(testDir, 'repo-upstream');
    await fs.mkdir(repo);
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.name', 'Tester'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
    await execFileAsync('git', ['remote', 'add', 'origin', 'https://github.com/rancher/terraform-provider-file.git'], {
      cwd: repo,
    });

    await assert.rejects(
      async () => runGitMessage(['fix: valid message'], {}, repo),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.match(err.stderr, /points to upstream rancher repo/);
        return true;
      },
    );
  });

  await t.test('fails when running on a detached HEAD', async () => {
    const repo = path.join(testDir, 'repo-detached');
    await fs.mkdir(repo);
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.name', 'Tester'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
    await execFileAsync('git', ['remote', 'add', 'origin', 'https://github.com/myfork/terraform-provider-file.git'], {
      cwd: repo,
    });

    await fs.writeFile(path.join(repo, 'initial.txt'), 'init');
    await execFileAsync('git', ['add', 'initial.txt'], { cwd: repo });
    await execFileAsync('git', ['commit', '-m', 'chore: initial commit'], { cwd: repo });
    await execFileAsync('git', ['checkout', '--detach'], { cwd: repo });

    await assert.rejects(
      async () => runGitMessage(['fix: valid message'], {}, repo),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.match(err.stderr, /Cannot commit on a detached HEAD\./);
        return true;
      },
    );
  });

  await t.test('enforces product boundary and blocks feat or breaking change for non-internal files', async () => {
    const repo = path.join(testDir, 'repo-boundary');
    await fs.mkdir(repo);
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.name', 'Tester'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
    await execFileAsync('git', ['remote', 'add', 'origin', 'https://github.com/myfork/terraform-provider-file.git'], {
      cwd: repo,
    });

    await fs.writeFile(path.join(repo, 'initial.txt'), 'init');
    await execFileAsync('git', ['add', 'initial.txt'], { cwd: repo });
    await execFileAsync('git', ['commit', '-m', 'chore: initial commit'], { cwd: repo });

    await fs.writeFile(path.join(repo, 'initial.txt'), 'init modified');

    // feat should fail
    await assert.rejects(
      async () => runGitMessage(['feat: add new feature'], {}, repo),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.match(
          err.stderr,
          /Non-product change \(outside 'internal\/'\) must NOT use 'feat', 'refactor', or '!' breaking-change indicators\./,
        );
        return true;
      },
    );

    // breaking change ! should fail
    await assert.rejects(
      async () => runGitMessage(['fix!: breaking fix outside internal'], {}, repo),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.match(
          err.stderr,
          /Non-product change \(outside 'internal\/'\) must NOT use 'feat', 'refactor', or '!' breaking-change indicators\./,
        );
        return true;
      },
    );
  });

  await t.test('stops cleanly on commit failure without attempting push', async () => {
    const repo = path.join(testDir, 'repo-commit-fail');
    await fs.mkdir(repo);
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.name', 'Tester'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
    await execFileAsync('git', ['remote', 'add', 'origin', 'https://github.com/myfork/terraform-provider-file.git'], {
      cwd: repo,
    });

    // Create a change in internal/ so it passes the product boundary check
    await fs.mkdir(path.join(repo, 'internal'));
    await fs.writeFile(path.join(repo, 'internal', 'file.go'), 'package file');
    await execFileAsync('git', ['add', 'internal/file.go'], { cwd: repo });
    await execFileAsync('git', ['commit', '-m', 'chore: initial internal'], { cwd: repo });

    await fs.writeFile(path.join(repo, 'internal', 'file.go'), 'package file // changed');

    // Force commit to fail reliably across all environments
    await execFileAsync('git', ['config', 'commit.gpgsign', 'true'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.signingkey', 'BOGUS_KEY_1234567890'], { cwd: repo });

    // Without a valid GPG key in test env, git commit -S fails; git_message should stop at commit without pushing
    await assert.rejects(
      async () => runGitMessage(['feat: add file feature'], {}, repo),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.match(err.stderr, /Error: Failed to create commit\./);
        assert.doesNotMatch(err.stderr, /Failed to push/);
        return true;
      },
    );
  });

  await t.test('allows personal forks whose username ends with rancher', async () => {
    const repo = path.join(testDir, 'repo-fork-rancher');
    await fs.mkdir(repo);
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.name', 'Tester'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
    await execFileAsync(
      'git',
      ['remote', 'add', 'origin', 'https://github.com/myrancher/terraform-provider-file.git'],
      {
        cwd: repo,
      },
    );

    // Should not fail with upstream repo error
    await assert.rejects(
      async () => runGitMessage(['fix: valid message on fork'], {}, repo),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.doesNotMatch(err.stderr, /points to upstream rancher repo/);
        return true;
      },
    );
  });

  await t.test('supports execution from a subdirectory and properly detects product changes in internal/', async () => {
    const repo = path.join(testDir, 'repo-subdir');
    await fs.mkdir(repo);
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.name', 'Tester'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
    await execFileAsync('git', ['remote', 'add', 'origin', 'https://github.com/myfork/terraform-provider-file.git'], {
      cwd: repo,
    });

    const internalDir = path.join(repo, 'internal');
    await fs.mkdir(internalDir);
    await fs.writeFile(path.join(internalDir, 'file.go'), 'package file');
    await execFileAsync('git', ['add', 'internal/file.go'], { cwd: repo });
    await execFileAsync('git', ['commit', '-m', 'chore: initial internal'], { cwd: repo });

    await fs.writeFile(path.join(internalDir, 'file.go'), 'package file // changed from subdir');

    // Force commit to fail reliably across all environments
    await execFileAsync('git', ['config', 'commit.gpgsign', 'true'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.signingkey', 'BOGUS_KEY_1234567890'], { cwd: repo });

    // Executing git_message with 'feat:' from inside repo/internal should NOT trigger non-product error
    await assert.rejects(
      async () => runGitMessage(['feat: product feature from subdir'], {}, internalDir),
      (err) => {
        assert.strictEqual(err.code, 1);
        assert.doesNotMatch(err.stderr, /Non-product change/);
        assert.match(err.stderr, /Error: Failed to create commit\./);
        return true;
      },
    );
  });
});
