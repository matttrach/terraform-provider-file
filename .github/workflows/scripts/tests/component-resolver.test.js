import test from 'node:test';
import assert from 'node:assert';
import {
  globToRegexp,
  matchFileToComponent,
  resolveHighestComponent,
  validateCommitTitleAgainstComponent,
  loadComponents,
} from '../component-resolver.js';

test('component-resolver.js tests', async (t) => {
  const components = loadComponents();

  await t.test('globToRegexp matches expected path structures', () => {
    assert.ok(globToRegexp('internal/**').test('internal/provider/file_local.go'));
    assert.ok(globToRegexp('**/*_test.go').test('internal/provider/file_local_test.go'));
    assert.ok(globToRegexp('*.md').test('README.md'));
    assert.ok(!globToRegexp('*.md').test('docs/README.md'));
    assert.ok(globToRegexp('docs/**').test('docs/data-sources/local.md'));
    assert.ok(globToRegexp('.dev/**').test('.dev/envrc.sh'));
  });

  await t.test('matchFileToComponent matches files to correct component based on excludes and paths', () => {
    assert.strictEqual(matchFileToComponent('internal/provider/file_local.go', components).name, 'product');
    assert.strictEqual(matchFileToComponent('internal/provider/file_local_test.go', components).name, 'unit');
    assert.strictEqual(matchFileToComponent('docs/resources/local.md', components).name, 'product-docs');
    assert.strictEqual(matchFileToComponent('test/local/basic/main.tf', components).name, 'e2e');
    assert.strictEqual(matchFileToComponent('.github/workflows/pull_request.yaml', components).name, 'ci');
    assert.strictEqual(matchFileToComponent('README.md', components).name, 'docs');
    assert.strictEqual(matchFileToComponent('.dev/envrc.sh', components).name, 'env');
    assert.strictEqual(matchFileToComponent('GNUmakefile', components).name, 'dev');
    assert.strictEqual(matchFileToComponent('unknown_file.xyz', components).name, 'misc');
  });

  await t.test('resolveHighestComponent respects hierarchy order', () => {
    const productAndCi = resolveHighestComponent(
      ['internal/provider/file_local.go', '.github/workflows/release.yml'],
      components,
    );
    assert.strictEqual(productAndCi.highestComponent.name, 'product');

    const unitAndCi = resolveHighestComponent(
      ['internal/provider/file_local_test.go', '.github/workflows/pull_request.yaml'],
      components,
    );
    assert.strictEqual(unitAndCi.highestComponent.name, 'unit');

    const ciAndDocs = resolveHighestComponent(['.github/workflows/release.yml', 'README.md'], components);
    assert.strictEqual(ciAndDocs.highestComponent.name, 'ci');

    const docsAndEnv = resolveHighestComponent(['README.md', '.dev/variables.sh'], components);
    assert.strictEqual(docsAndEnv.highestComponent.name, 'docs');
  });

  await t.test('validateCommitTitleAgainstComponent validates allowed and disallowed prefixes', () => {
    const productComp = components.find((c) => c.name === 'product');
    const unitComp = components.find((c) => c.name === 'unit');
    const ciComp = components.find((c) => c.name === 'ci');

    // Product allows feat, fix, refactor, revert, and !
    assert.strictEqual(validateCommitTitleAgainstComponent('feat: add new resource', productComp).valid, true);
    assert.strictEqual(validateCommitTitleAgainstComponent('fix: resolve panic', productComp).valid, true);
    assert.strictEqual(validateCommitTitleAgainstComponent('refactor!: breaking interface', productComp).valid, true);
    assert.strictEqual(validateCommitTitleAgainstComponent('ci: update action', productComp).valid, false);

    // Unit requires unit or test, forbids feat/fix and !
    assert.strictEqual(validateCommitTitleAgainstComponent('unit: add coverage', unitComp).valid, true);
    assert.strictEqual(validateCommitTitleAgainstComponent('test: add coverage', unitComp).valid, true);
    assert.strictEqual(validateCommitTitleAgainstComponent('feat: add test', unitComp).valid, false);
    assert.strictEqual(validateCommitTitleAgainstComponent('unit!: breaking test', unitComp).valid, false);

    // CI requires ci, forbids feat/fix and !
    assert.strictEqual(validateCommitTitleAgainstComponent('ci: update workflows', ciComp).valid, true);
    assert.strictEqual(validateCommitTitleAgainstComponent('fix: update workflows', ciComp).valid, false);
    assert.strictEqual(validateCommitTitleAgainstComponent('ci!: breaking workflow', ciComp).valid, false);
  });

  await t.test('validation error messages provide explicit explanations, examples, and git fix commands', () => {
    const ciComp = components.find((c) => c.name === 'ci');
    const res = validateCommitTitleAgainstComponent('fix: update workflows', ciComp);
    assert.strictEqual(res.valid, false);
    assert.ok(res.reason.includes('❌ Problem: The files modified in this PR map to component "ci"'));
    assert.ok(res.reason.includes('📂 Detected Component: "ci"'));
    assert.ok(res.reason.includes('✅ Allowed Type Prefix(es): [ci]'));
    assert.ok(res.reason.includes('💡 Examples of valid commit messages for this PR:'));
    assert.ok(res.reason.includes('🔧 How to fix:'));
    assert.ok(res.reason.includes('git commit --amend -m "ci: update workflows"'));
  });

  await t.test('relaxes prefix constraints on release branches where release-as controls version', () => {
    const ciComp = components.find((c) => c.name === 'ci');
    // On main, 'fix: ...' or 'feat: ...' is blocked on CI component:
    assert.strictEqual(validateCommitTitleAgainstComponent('fix: update workflows', ciComp, false, false).valid, false);
    assert.strictEqual(
      validateCommitTitleAgainstComponent('feat: update workflows', ciComp, false, false).valid,
      false,
    );

    // On a release branch (isReleaseBranch = true), 'fix: ...' or 'feat: ...' or 'chore: ...' is allowed:
    assert.strictEqual(validateCommitTitleAgainstComponent('fix: update workflows', ciComp, false, true).valid, true);
    assert.strictEqual(validateCommitTitleAgainstComponent('feat: update workflows', ciComp, false, true).valid, true);
    assert.strictEqual(validateCommitTitleAgainstComponent('chore: update workflows', ciComp, false, true).valid, true);
    assert.strictEqual(validateCommitTitleAgainstComponent('docs: update workflows', ciComp, false, true).valid, true);
  });
});
