import fs from 'fs';
import path from 'path';

async function getFiles(dir, fileList = []) {
  const files = await fs.promises.readdir(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) {
      // Skip node_modules and .git
      if (file !== 'node_modules' && file !== '.git') {
        await getFiles(filePath, fileList);
      }
    } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export default async ({ core, process }) => {
  try {
    const rootDir = process.env.GITHUB_WORKSPACE || process.cwd();
    const files = await getFiles(rootDir);
    let failed = false;

    core.info(
      `🔍 Scanning ${files.length} JavaScript files for 'catch' statements without an explicit error binding...`,
    );

    for (const file of files) {
      // Relative path for cleaner output
      const relativePath = path.relative(rootDir, file);
      let content = await fs.promises.readFile(file, 'utf-8');

      // Strip block comments while preserving line count
      content = content.replace(/\/\*[\s\S]*?\*\//g, (match) => '\n'.repeat(match.split('\n').length - 1));
      // Strip single line comments
      content = content.replace(/\/\/.*$/gm, '');

      // Strip double-quoted, single-quoted, and multi-line template string literals securely,
      // preserving newlines to maintain accurate line numbers on errors.
      content = content.replace(
        /"[^"\\]*(?:\\.[^"\\]*)*"/g,
        (match) => '""' + '\n'.repeat(match.split('\n').length - 1),
      );
      content = content.replace(
        /'[^'\\]*(?:\\.[^'\\]*)*'/g,
        (match) => "''" + '\n'.repeat(match.split('\n').length - 1),
      );
      content = content.replace(/`[\s\S]*?(?<!\\)`/g, (match) => '``' + '\n'.repeat(match.split('\n').length - 1));

      const catchRegex = /\bcatch\b/g;
      let match;

      while ((match = catchRegex.exec(content)) !== null) {
        const catchIndex = match.index;

        // Ignore property/method calls (e.g. promise.catch(...))
        const beforeText = content.slice(0, catchIndex).trim();
        if (beforeText.endsWith('.')) {
          continue;
        }

        // Determine 1-based line number for error reporting
        const linesBefore = content.slice(0, catchIndex).split('\n');
        const lineNumber = linesBefore.length;
        const currentLineText = linesBefore[lineNumber - 1] + content.slice(catchIndex).split('\n')[0];

        // Find first non-whitespace following catch
        const remaining = content.slice(catchIndex + 5);
        const trimmedRemaining = remaining.trimStart();

        if (!trimmedRemaining.startsWith('(')) {
          core.error(
            `❌ Violation: 'catch' statement without an explicit error binding found at ${relativePath}:${lineNumber}\n   Line: ${currentLineText.trim()}`,
          );
          failed = true;
          continue;
        }

        // It starts with '('. Let's find the closing parenthesis.
        const closeParenIndex = trimmedRemaining.indexOf(')');
        if (closeParenIndex === -1) {
          core.error(
            `❌ Violation: Unclosed parenthesis on 'catch' statement at ${relativePath}:${lineNumber}\n   Line: ${currentLineText.trim()}`,
          );
          failed = true;
          continue;
        }

        const paramContent = trimmedRemaining.slice(1, closeParenIndex).trim();
        // Validate that the param is a valid variable identifier
        const isValidIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(paramContent);
        if (!isValidIdentifier) {
          core.error(
            `❌ Violation: 'catch' statement without an explicit error binding found at ${relativePath}:${lineNumber}\n   Line: ${currentLineText.trim()}`,
          );
          failed = true;
        }
      }
    }

    if (failed) {
      core.setFailed('🔴 Audit Failed: One or more catch statements violate the policy.');
    } else {
      core.info('🟢 Audit Passed: All catch statements comply with explicit error binding policy!');
    }
  } catch (err) {
    core.setFailed(`🔴 Fatal Audit Error: ${err.message || err}`);
  }
};
