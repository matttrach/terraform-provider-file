import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

async function getJsFilesRecursively(dir) {
  let list;
  try {
    list = await fs.promises.readdir(dir);
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
    throw err;
  }

  const promises = list.map(async (file) => {
    const filePath = path.join(dir, file);
    const stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) {
      return getJsFilesRecursively(filePath);
    } else if (file.endsWith('.js')) {
      return [filePath];
    }
    return [];
  });

  const results = await Promise.all(promises);
  return results.flat();
}

test('Gemini hooks ESM import resolution validation', async (t) => {
  const hooksDir = path.resolve(process.cwd(), '.gemini/hooks');
  let hookFiles;
  try {
    hookFiles = await getJsFilesRecursively(hooksDir);
  } catch (err) {
    console.error(`Could not read hooks directory ${hooksDir}:`, err);
    throw err;
  }

  for (const file of hookFiles) {
    const relativePath = path.relative(process.cwd(), file);
    await t.test(`should successfully load and parse hook: ${relativePath}`, async () => {
      try {
        await import(`file://${file}`);
        assert.ok(true, `Successfully parsed and loaded ESM imports for: ${relativePath}`);
      } catch (err) {
        assert.fail(`Failed to parse/load hook ${relativePath}: ${err.stack || err.message}`);
      }
    });
  }
});
