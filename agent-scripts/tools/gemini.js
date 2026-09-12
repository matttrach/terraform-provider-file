#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'os';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { runGemini, runGeminiWithRetry, runGeminiWithValidation } from '../lib/gemini.js';

export { runGemini, runGeminiWithRetry, runGeminiWithValidation };

function showHelp() {
  console.log(`Usage: gemini.js [options]

Options:
  --prompt [string]      The prompt to pass to the sub-agent (required).
  --subagent [name]      The sub-agent name (e.g., @project_manager) (required).
  --sandbox [dir]        The target sandbox directory (optional, a temporary directory is created if omitted).
  --sandbox-file [file]  A file to copy into the sandbox (optional).
  --retry [number]       Max retry attempts (default: 5).
  --model [name]         The Gemini model to use (optional).
  -h, --help             Show this help message.
`);
  process.exit(0);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (err) {
    console.error(`Error accessing file ${filePath}:`, err);
    return false;
  }
}

async function main() {
  const { parseArgs } = await import('util');
  let parsed;

  try {
    parsed = parseArgs({
      options: {
        prompt: { type: 'string' },
        subagent: { type: 'string' },
        sandbox: { type: 'string' },
        'sandbox-file': { type: 'string' },
        retry: { type: 'string', default: '5' },
        model: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
    });
  } catch (err) {
    console.error(`Error parsing arguments: ${err.message}`);
    showHelp();
  }

  if (parsed.values.help || !parsed.values.prompt || !parsed.values.subagent) {
    showHelp();
  }

  let sandboxDir = parsed.values.sandbox;
  let isTempSandbox = false;

  if (!sandboxDir) {
    sandboxDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gemini-sandbox-'));
    console.log(`📦 Created temporary sandbox: ${sandboxDir}`);
    isTempSandbox = true;
  } else if (!(await fileExists(sandboxDir))) {
    await fs.mkdir(sandboxDir, { recursive: true });
  }

  if (parsed.values['sandbox-file']) {
    const fileToCopy = path.resolve(parsed.values['sandbox-file']);
    if (await fileExists(fileToCopy)) {
      const destPath = path.join(sandboxDir, path.basename(fileToCopy));
      await fs.copyFile(fileToCopy, destPath);
      console.log(`📄 Copied ${fileToCopy} to sandbox.`);
    } else {
      console.error(`❌ Sandbox file not found: ${fileToCopy}`);
      if (isTempSandbox) {
        await fs.rm(sandboxDir, { recursive: true, force: true });
      }
      process.exit(1);
    }
  }

  const maxAttempts = parseInt(parsed.values.retry, 10) || 5;

  try {
    await runGeminiWithRetry(
      parsed.values.prompt,
      parsed.values.subagent,
      sandboxDir,
      maxAttempts,
      parsed.values.model,
    );
    console.log(`✅ Sub-agent ${parsed.values.subagent} completed successfully.`);
  } finally {
    if (isTempSandbox) {
      console.log(`🧹 Cleaning up temporary sandbox: ${sandboxDir}`);
      await fs.rm(sandboxDir, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('::error::Fatal Gemini Tool Error:', err.stack || err.message);
    process.exit(1);
  });
}
