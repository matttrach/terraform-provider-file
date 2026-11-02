#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRepoRoot, runCommand } from './utils.js';

export const SUPPORTED_MODES = ['unit', 'compile', 'acc', 'acc-relay', 'workflow-scripts', 'agent-scripts', 'all'];

/**
 * Prints help and usage information for test.js.
 */
export function printHelp() {
  console.log(`Usage: test.js [mode]
   or: test.js [-m|--mode <mode>]

Executes test suites and verification harnesses.

Modes:
  unit              Run unit tests (default)
  compile           Run compile check on tests
  acc               Run acceptance tests
  acc-relay         Run AWS Test Relay acceptance tests
  workflow-scripts  Run workflow script unit tests
  agent-scripts     Run agent script unit tests
  all               Run all compile, unit, and script tests

Options:
  -m, --mode        Explicitly specify test mode
  -h, --help        Show this help message
`);
}

/**
 * Parses arguments for test.js.
 * @param {Array<string>} rawArgs
 * @returns {{help?: boolean, mode?: string, error?: string}}
 */
export function parseTestArgs(rawArgs = []) {
  if (rawArgs.includes('-h') || rawArgs.includes('--help')) {
    return { help: true };
  }

  let mode = null;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '-m' || arg === '--mode') {
      if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) {
        mode = rawArgs[++i];
      } else {
        return { error: 'Option --mode requires a value.' };
      }
    } else if (arg.startsWith('--mode=')) {
      mode = arg.slice('--mode='.length);
    } else if (arg.startsWith('-')) {
      return { error: `Unknown option: '${arg}'` };
    } else if (!arg.startsWith('-')) {
      if (mode === null) {
        mode = arg;
      } else {
        return { error: `Unexpected argument: '${arg}'` };
      }
    }
  }

  mode = mode || 'unit';

  if (!SUPPORTED_MODES.includes(mode)) {
    return {
      error: `Unknown test mode: '${mode}'. Supported modes: ${SUPPORTED_MODES.join(', ')}`,
    };
  }

  return { mode };
}

/**
 * Executes the test harness asynchronously.
 *
 * @param {object} [options]
 * @param {string} [options.mode='unit'] - The test mode to execute
 * @param {string} [options.cwd] - Working directory (defaults to repo root)
 * @param {'inherit'|'pipe'} [options.stdio='inherit'] - Child process stdio configuration
 * @param {Function} [options.commandRunner=runCommand] - Custom command runner function
 * @returns {Promise<{success: boolean, code: number, stdout: string, stderr: string, mode: string}>}
 */
export async function runTest({ mode = 'unit', cwd = null, stdio = 'inherit', commandRunner = runCommand } = {}) {
  const repoRoot = await getRepoRoot();
  const workingDir = cwd || repoRoot;
  const testScriptPath = path.join(repoRoot, '.github/workflows/scripts/test.sh');

  const result = await commandRunner('bash', [testScriptPath, mode], {
    cwd: workingDir,
    stdio,
  });

  return {
    ...result,
    mode,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const parsed = parseTestArgs(args);

  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  if (parsed.error) {
    console.error(`❌ Error: ${parsed.error}`);
    printHelp();
    process.exit(1);
  }

  const { mode } = parsed;
  console.log(`▶️ Running test suite [mode: ${mode}]...`);

  const result = await runTest({ mode, stdio: 'inherit' });

  if (result.success) {
    console.log(`✅ Test suite passed [mode: ${mode}]`);
    process.exit(0);
  } else {
    console.error(`❌ Test suite failed [mode: ${mode}] (exit code: ${result.code})`);
    process.exit(result.code);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(`❌ Fatal error in test runner: ${err?.message || err}`);
    process.exit(1);
  });
}
