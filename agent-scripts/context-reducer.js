import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function extractNames(regex, str) {
  const results = new Set();
  let match;
  while ((match = regex.exec(str)) !== null) {
    const name = match[1] || match[2];
    if (name) {
      results.add(name);
    }
  }
  return Array.from(results);
}

export function extractNodeStructure(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    const funcRegex = /(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/g;
    const arrowRegex = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(.*?\)\s*=>/g;
    const classRegex = /class\s+([a-zA-Z0-9_$]+)/g;
    const exportRegex =
      /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+([a-zA-Z0-9_$]+)|module\.exports\s*=\s*([a-zA-Z0-9_$]+)/g;

    const functions = extractNames(funcRegex, content);
    const arrowFunctions = extractNames(arrowRegex, content);
    const classes = extractNames(classRegex, content);
    const exportsList = extractNames(exportRegex, content);

    const lineCount = content.split('\n').length;

    return {
      path: filePath,
      line_count: lineCount,
      signatures: {
        classes,
        functions: [...new Set([...functions, ...arrowFunctions])],
        exports: exportsList,
      },
    };
  } catch (e) {
    return { error: e.message };
  }
}

export function generateContextJson(rootDir, outputJsonPath, validExtensions = null) {
  const codeContext = {};

  if (!validExtensions) {
    try {
      const configPath = path.join(rootDir, '.context-reducer.config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        validExtensions = config.validExtensions;
      }
    } catch (err) {
      console.warn(`Failed to read context-reducer config: ${err.message}`);
    }
  }

  if (!validExtensions || !Array.isArray(validExtensions)) {
    validExtensions = ['.js', '.ts', '.mjs', '.cjs'];
  }

  function walkDir(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          walkDir(fullPath);
        }
      } else if (entry.isFile()) {
        if (validExtensions.includes(path.extname(entry.name))) {
          const relPath = path.relative(rootDir, fullPath);
          codeContext[relPath] = extractNodeStructure(fullPath);
        }
      }
    }
  }

  walkDir(rootDir);
  fs.writeFileSync(outputJsonPath, JSON.stringify(codeContext, null, 2), 'utf-8');
  console.log(`Context reduced and saved to ${outputJsonPath}. Processed ${Object.keys(codeContext).length} files.`);
}

// Allow direct execution via CLI
const isMain =
  process.argv[1] &&
  (process.argv[1] === fileURLToPath(import.meta.url) || path.basename(process.argv[1]) === 'context-reducer.js');
if (isMain) {
  const args = process.argv.slice(2);
  const targetDir = args[0] || '.';
  const outputFile = args[1] || 'code_context.json';
  const cliExtensions = args[2] ? args[2].split(',') : null;
  generateContextJson(targetDir, outputFile, cliExtensions);
}
