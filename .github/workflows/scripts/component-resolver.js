// component-resolver.js - Resolves codebase components and enforces component prefix hierarchy.
// Conforms to github-script.instructions.md guidelines.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

export function globToRegexp(glob) {
  const normalized = glob.replace(/^\.\//, '');
  let reStr = '';
  let i = 0;
  while (i < normalized.length) {
    const char = normalized[i];
    if (char === '*' && normalized[i + 1] === '*') {
      if (normalized[i + 2] === '/') {
        reStr += '(?:.*?/)?';
        i += 3;
      } else {
        reStr += '.*';
        i += 2;
      }
    } else if (char === '*') {
      reStr += '[^/]*';
      i += 1;
    } else if (char === '?') {
      reStr += '[^/]';
      i += 1;
    } else if ('[].+^$()|{}'.includes(char)) {
      reStr += `\\${char}`;
      i += 1;
    } else {
      reStr += char;
      i += 1;
    }
  }
  return new RegExp(`^${reStr}$`);
}

export function matchesAnyPattern(filePath, patterns = []) {
  const cleanPath = filePath.replace(/^\.\//, '');
  return patterns.some((p) => globToRegexp(p).test(cleanPath));
}

export function matchFileToComponent(filePath, components) {
  for (const comp of components) {
    if (comp.exclude_paths && matchesAnyPattern(filePath, comp.exclude_paths)) {
      continue;
    }
    if (comp.paths && matchesAnyPattern(filePath, comp.paths)) {
      return comp;
    }
  }
  return components[components.length - 1]; // Fallback to last component (misc)
}

export function resolveHighestComponent(filePaths, components) {
  if (!filePaths || filePaths.length === 0) {
    return {
      highestComponent: components[components.length - 1],
      fileComponentMap: {},
    };
  }

  const fileComponentMap = {};
  let highestIndex = components.length;
  let highestComp = components[components.length - 1];

  for (const file of filePaths) {
    const comp = matchFileToComponent(file, components);
    fileComponentMap[file] = comp.name;

    const idx = components.findIndex((c) => c.name === comp.name);
    if (idx !== -1 && idx < highestIndex) {
      highestIndex = idx;
      highestComp = comp;
    }
  }

  return {
    highestComponent: highestComp,
    fileComponentMap,
  };
}

export function generateExamplesForComponent(component) {
  const allowed = (component.allowed_types || []).map((t) => t.toLowerCase());
  const examples = [];
  for (const t of allowed) {
    if (t === 'feat') {
      examples.push(`${t}: add support for new feature`);
    } else if (t === 'fix') {
      examples.push(`${t}: resolve unexpected error`);
    } else if (t === 'refactor') {
      examples.push(`${t}: reorganize internal client`);
    } else if (t === 'revert') {
      examples.push(`${t}: revert previous commit`);
    } else if (t === 'unit') {
      examples.push(`${t}: add unit test coverage for resource`);
    } else if (t === 'test') {
      examples.push(`${t}: add test assertions`);
    } else if (t === 'integration') {
      examples.push(`${t}: add integration test scenario`);
    } else if (t === 'e2e') {
      examples.push(`${t}: add end-to-end acceptance test`);
    } else if (t === 'ci') {
      examples.push(`${t}: update workflow trigger and linting`);
    } else if (t === 'docs') {
      examples.push(`${t}: update documentation and usage examples`);
    } else if (t === 'product-docs') {
      examples.push(`${t}: update resource schema documentation`);
    } else if (t === 'dev') {
      examples.push(`${t}: update makefile and local tool scripts`);
    } else if (t === 'env') {
      examples.push(`${t}: update nix flake dependencies`);
    } else if (t === 'chore') {
      examples.push(`${t}: update dependencies`);
    } else {
      examples.push(`${t}: update ${component.name}`);
    }
  }
  return examples.slice(0, 3);
}

export function validateCommitTitleAgainstComponent(title, highestComponent, isMerge = false, isReleaseBranch = false) {
  if (isMerge) {
    return { valid: true, isMerge: true };
  }

  const CONVENTIONAL_COMMIT_REGEXP = /^([a-z0-9_-]+)(?:\([^)]+\))?(!?): (.+)/i;
  const match = title.match(CONVENTIONAL_COMMIT_REGEXP);
  const allowedTypes = (highestComponent.allowed_types || []).map((t) => t.toLowerCase());

  if (!match) {
    const examples = generateExamplesForComponent(highestComponent);
    return {
      valid: false,
      reason:
        `Commit message "${title}" does not follow Conventional Commits format.\n` +
        `❌ Problem: Expected format "type: description" or "type(scope): description".\n` +
        `📂 Detected Component: "${highestComponent.name}" (${highestComponent.description || 'codebase section'})\n` +
        `✅ Allowed Type Prefix(es): [${allowedTypes.join(', ')}]\n` +
        `💡 Examples of valid commit messages for this PR:\n` +
        examples.map((ex) => `   - ${ex}`).join('\n') +
        `\n🔧 How to fix:\n` +
        `   git commit --amend -m "${allowedTypes[0]}: your descriptive summary"\n` +
        `   git push --force-with-lease\n`,
    };
  }

  const type = match[1].toLowerCase();
  const hasExclamation = match[2] === '!';
  const descriptionPart = match[3];

  if (isReleaseBranch) {
    // On release/backport branches, release-as dictates the SemVer version, so commit prefixes only affect the changelog.
    // Allow any standard conventional commit prefix.
    const ALL_CONVENTIONAL_TYPES = [
      'feat',
      'fix',
      'refactor',
      'revert',
      'docs',
      'test',
      'build',
      'ci',
      'chore',
      'env',
      'dev',
      'unit',
      'integration',
      'e2e',
      'product-docs',
    ];
    if (!ALL_CONVENTIONAL_TYPES.includes(type)) {
      return {
        valid: false,
        reason:
          `Commit prefix "${type}" is not a recognized conventional commit type.\n` +
          `❌ Target branch is a release branch where prefixes only categorize changelog entries.\n` +
          `✅ Allowed commit types: [${ALL_CONVENTIONAL_TYPES.join(', ')}].\n` +
          `💡 Example: feat: descriptive summary or fix: descriptive summary`,
      };
    }
    return { valid: true };
  }

  if (!allowedTypes.includes(type)) {
    const examples = generateExamplesForComponent(highestComponent);
    return {
      valid: false,
      reason:
        `Commit prefix "${type}" is not allowed for component "${highestComponent.name}".\n` +
        `❌ Problem: The files modified in this PR map to component "${highestComponent.name}", which requires one of: [${allowedTypes.join(', ')}].\n` +
        `   Prefix "${type}" cannot be used here because ${
          highestComponent.is_product
            ? 'this PR contains product code changes and requires a release-triggering type (feat, fix, refactor, revert).'
            : 'this PR contains non-product changes and must not trigger SemVer product releases.'
        }\n` +
        `📂 Detected Component: "${highestComponent.name}" (${highestComponent.description || 'codebase section'})\n` +
        `✅ Allowed Type Prefix(es): [${allowedTypes.join(', ')}]\n` +
        `💡 Examples of valid commit messages for this PR:\n` +
        examples.map((ex) => `   - ${ex}`).join('\n') +
        `\n🔧 How to fix:\n` +
        `   git commit --amend -m "${allowedTypes[0]}: ${descriptionPart}"\n` +
        `   git push --force-with-lease\n`,
    };
  }

  if (!highestComponent.is_product && hasExclamation) {
    return {
      valid: false,
      reason:
        `Breaking change indicator "!" is not permitted for component "${highestComponent.name}".\n` +
        `❌ Problem: Component "${highestComponent.name}" is a non-product component. Breaking change markers ("!") trigger major SemVer releases on release-please and are strictly reserved for product code changes (e.g. inside internal/).\n` +
        `🔧 How to fix: Remove "!" from your commit prefix (e.g. "${type}: ..." instead of "${type}!: ...").\n` +
        `   git commit --amend -m "${type}: ${descriptionPart}"\n` +
        `   git push --force-with-lease\n`,
    };
  }

  return { valid: true };
}

export function loadComponents(configPath = '.github/repo-config.yml') {
  if (process.env.COMPONENTS_CONFIG) {
    try {
      return JSON.parse(process.env.COMPONENTS_CONFIG);
    } catch {
      // Fall through to file read
    }
  }

  if (fs.existsSync(configPath)) {
    try {
      const output = execFileSync('yq', ['eval', '-o=json', '.components // []', configPath], {
        encoding: 'utf8',
      });
      const parsed = JSON.parse(output.trim());
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Sane fallback defaults matching standard hierarchy
  return [
    {
      name: 'product',
      paths: ['internal/**', 'main.go'],
      exclude_paths: ['**/*_test.go'],
      allowed_types: ['feat', 'fix', 'refactor', 'revert'],
      is_product: true,
    },
    {
      name: 'product-docs',
      paths: ['docs/**', 'examples/**'],
      allowed_types: ['docs', 'product-docs'],
    },
    {
      name: 'e2e',
      paths: ['test/**'],
      allowed_types: ['e2e', 'test'],
    },
    {
      name: 'integration',
      paths: ['integration/**'],
      allowed_types: ['integration', 'test'],
    },
    {
      name: 'unit',
      paths: ['**/*_test.go', '**/*.test.js'],
      allowed_types: ['unit', 'test'],
    },
    {
      name: 'ci',
      paths: ['.github/**'],
      allowed_types: ['ci'],
    },
    {
      name: 'docs',
      paths: ['*.md', 'LICENSE'],
      allowed_types: ['docs'],
    },
    {
      name: 'dev',
      paths: ['.gemini/**', 'tools/**', 'GNUmakefile', 'package.json'],
      allowed_types: ['dev', 'chore'],
    },
    {
      name: 'env',
      paths: ['.dev/**', '.envrc', 'flake.nix', 'flake.lock'],
      allowed_types: ['env'],
    },
    {
      name: 'misc',
      paths: ['**'],
      allowed_types: ['chore'],
    },
  ];
}
