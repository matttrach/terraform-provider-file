// FIXME: This batch orchestration module must eventually be relocated from lib/ to tools/
import fs from 'fs';
import path from 'path';
import {
  readFileSafe,
  writeFileSafe,
  resolveTargetDir,
  mkdtempSafe,
  copyFileSafe,
  registerCleanupTraps,
  diffPaths,
} from './file.js';
import { runGeminiWithRetry, runGeminiWithValidation } from './gemini.js';
const FLASH_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];
const SURGICAL_MODELS = ['gemini-3.5-flash'];

const SURGICAL_SCHEMA_PROMPT = `### FILE: relative_filepath
<<<<
[exact old block of code to search for, unmodified]
====
[new replacement block of code to write in its place]
>>>>`;

async function asyncExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (err) {
    console.warn(err.message);
    return false;
  }
}

async function getRealPath(p) {
  try {
    return await fs.promises.realpath(p);
  } catch (err) {
    console.warn(err.message);
    const parent = path.dirname(p);
    if (parent === p) {
      return p;
    }
    const resolvedParent = await getRealPath(parent);
    return path.join(resolvedParent, path.basename(p));
  }
}

async function isPathInside(parent, child) {
  const resolvedParent = await getRealPath(parent);
  const resolvedChild = await getRealPath(child);
  const relative = path.relative(resolvedParent, resolvedChild);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

const surgicalValidator = (output) => {
  const fileBlocks = output.split(/###\s*FILE:\s*/);
  let validBlockCount = 0;
  for (const block of fileBlocks) {
    const lines = block.split('\n');
    if (lines.length < 1) {
      continue;
    }
    const headerLine = lines[0].trim();
    if (!headerLine) {
      continue;
    }

    if (headerLine.toLowerCase().endsWith('- compliant') || headerLine.toLowerCase().endsWith('compliant')) {
      validBlockCount++;
      continue;
    }

    if (/^<<<<\s*\n/m.test(block) && /^====\s*\n/m.test(block) && /^>>>>/m.test(block)) {
      validBlockCount++;
    }
  }

  if (validBlockCount === 0) {
    throw new Error(
      "Output does not contain any valid '### FILE: ...' headers with Search-and-Replace '<<<< ==== >>>>' or '- compliant' blocks. Please strictly follow the formatting guidelines.",
    );
  }
  return output;
};

async function applySurgicalReplacements(responseText, agentSandbox) {
  const fileBlocks = responseText.split(/###\s*FILE:\s*/);
  const appliedFiles = {};
  const writePromises = [];

  for (const block of fileBlocks) {
    const lines = block.split('\n');
    if (lines.length < 1) {
      continue;
    }

    const headerLine = lines[0].trim();
    if (!headerLine) {
      continue;
    }

    const relativePath = headerLine.replace(/\s*-\s*compliant\s*$/i, '').trim();
    const rest = lines.slice(1).join('\n');

    if (headerLine.toLowerCase().endsWith('- compliant') || headerLine.toLowerCase().endsWith('compliant')) {
      appliedFiles[relativePath] = 'compliant';
      continue;
    }

    const filePath = path.join(agentSandbox, relativePath);
    if (!(await isPathInside(agentSandbox, filePath)) || !(await asyncExists(filePath))) {
      continue;
    }

    const blockRegex = /^<<<<\s*\n([\s\S]*?)\n^====\s*\n([\s\S]*?)\n^>>>>\s*$/gm;
    const blocks = [];
    let match;
    while ((match = blockRegex.exec(rest)) !== null) {
      blocks.push({
        oldCode: match[1].replace(/\r\n/g, '\n').trim(),
        newCode: match[2].replace(/\r\n/g, '\n').trim(),
      });
    }

    const originalContent = await fs.promises.readFile(filePath, 'utf8');
    const isCrlf = originalContent.includes('\r\n');
    let content = originalContent.replace(/\r\n/g, '\n');
    let hasChanges = false;

    for (const { oldCode, newCode } of blocks) {
      const occurrences = content.split(oldCode).length - 1;

      if (occurrences === 1) {
        content = content.replace(oldCode, newCode);
        hasChanges = true;
      } else if (occurrences > 1) {
        console.error(
          `::error::[Surgical Parser] Ambiguous replacement for ${relativePath}: Found ${occurrences} occurrences of block.`,
        );
      } else {
        const normContent = content.replace(/\s+/g, '');
        const normOld = oldCode.replace(/\s+/g, '');
        if (normContent.includes(normOld)) {
          console.info(`::warning::[Surgical Parser] Whitespace mismatch fallback for: ${relativePath}`);
        } else {
          console.info(`::warning::[Surgical Parser] Old code block not found in file: ${relativePath}`);
        }
      }
    }

    if (hasChanges) {
      const outputContent = isCrlf ? content.replace(/\n/g, '\r\n') : content;
      writePromises.push(fs.promises.writeFile(filePath, outputContent, 'utf8'));
      appliedFiles[relativePath] = 'modified';
    }
  }
  await Promise.all(writePromises);
  return appliedFiles;
}

const escapeXml = (unsafe) => {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
};

export async function runAutoRemediate() {
  const TARGET_DIR = await resolveTargetDir();
  const remediationReportPath = path.join(TARGET_DIR, 'remediation-report.json');

  if (!(await asyncExists(remediationReportPath))) {
    console.info(`::notice::No remediation-report.json found at ${remediationReportPath}. Nothing to remediate!`);
    return true;
  }

  const content = await readFileSafe(remediationReportPath, 'utf8');
  if (!content || !content.trim()) {
    console.info('::notice::Remediation report is empty.');
    return true;
  }

  let groupedTasksArray;
  try {
    groupedTasksArray = JSON.parse(content);
  } catch (err) {
    console.error(`::error::❌ Remediation report is not valid JSON: ${err.message}`);
    groupedTasksArray = [];
  }

  if (!Array.isArray(groupedTasksArray) || groupedTasksArray.length === 0) {
    console.info('::notice::🟢 No pending remediation checklist items found.');
    return true;
  }

  const groupedTasks = {};
  for (const item of groupedTasksArray) {
    groupedTasks[item.file] = [
      {
        text: `Target lines ${JSON.stringify(item.line_numbers)}: ${item.narrative}`,
        lineIdx: 0,
        originalLine: item.narrative,
      },
    ];
  }

  const files = Object.keys(groupedTasks);
  const totalFiles = files.length;

  console.info(`::notice::Found ${totalFiles} file(s) requiring auto-remediation.`);

  const targetAgents = 5;
  let filesPerAgent = Math.ceil(totalFiles / targetAgents);

  if (filesPerAgent > 10) {
    filesPerAgent = 10;
  } else if (filesPerAgent < 1) {
    filesPerAgent = 1;
  }

  const batches = [];
  for (let i = 0; i < totalFiles; i += filesPerAgent) {
    batches.push(files.slice(i, i + filesPerAgent));
  }

  console.info(
    `::notice::Spawning ${batches.length} subagents (Batch size: up to ${filesPerAgent} file(s) per subagent)...`,
  );

  const runSandbox = await mkdtempSafe(path.join(TARGET_DIR, 'gemini-remediation-'));
  registerCleanupTraps(runSandbox);

  const processBatch = async (batchFiles, batchIdx) => {
    const completedFiles = [];
    let batchError = null;

    try {
      const agentSandbox = await mkdtempSafe(path.join(runSandbox, `batch-${batchIdx}-`));

      const fileMappings = [];
      for (const file of batchFiles) {
        const srcPath = path.resolve(process.cwd(), file);
        if (!(await isPathInside(process.cwd(), srcPath)) || !(await asyncExists(srcPath))) {
          console.info(`::warning::[Batch ${batchIdx}] Source file or invalid path: ${file}`);
          continue;
        }

        const destPath = path.join(agentSandbox, file);
        if (!(await isPathInside(agentSandbox, destPath))) {
          console.error(`::error::[Batch ${batchIdx}] Invalid destination path: ${file}`);
          continue;
        }
        console.info(`::notice::[Batch ${batchIdx}] 📦 Sandboxing file: ${file}`);
        await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
        await copyFileSafe(srcPath, destPath);
        fileMappings.push({
          relative: file,
          src: srcPath,
          dest: destPath,
        });
      }

      if (fileMappings.length === 0) {
        console.info(`::warning::[Batch ${batchIdx}] No files mapped successfully. Skipping batch.`);
        return { completedFiles, error: null };
      }

      const fileContexts = [];
      for (const mapping of fileMappings) {
        const originalCode = await readFileSafe(mapping.src, 'utf8');
        fileContexts.push(
          `--- START FILE: ${mapping.relative} ---\n${originalCode}\n--- END FILE: ${mapping.relative} ---`,
        );
      }

      const tasksDescription = batchFiles
        .map((f) => {
          const fileTasks = groupedTasks[f].map((t) => `  - ${t.text}`).join('\n');
          return `For file "${f}":\n${fileTasks}`;
        })
        .join('\n\n');

      const prompt = `You are a highly capable software engineering subagent.
Your goal is to design and return surgical search-and-replace code modifications for the files inside your current sandbox workspace to satisfy their explicit remediation tasks.

Because your environment is read-only, you are NOT allowed to write files or execute commands. You are also **STRICTLY FORBIDDEN** from attempting to execute any tools (such as grep_search, list_directory, or read_file). All of the file content you need is already provided to you directly under the "Target Files Context" section below. Do not make any tool calls.

To minimize token usage, DO NOT output the full modified file contents in your text response. Instead, you MUST output ONLY the precise search-and-replace blocks using the "<<<<", "====", ">>>>" delimiters.

Format your output EXACTLY as follows for each file you edit:

### FILE: [relative_filepath]
<<<<
[exact old block of code to search for, unmodified]
====
[new replacement block of code to write in its place]
>>>>

If a file is already completely compliant and requires no modifications, output:
### FILE: [relative_filepath] - compliant

Target Files Context:
${fileContexts.join('\n\n')}

Remediation Tasks to Implement:
${tasksDescription}

Be extremely surgical: only apply the required changes, preserving the rest of the code structure exactly as it is.`;

      console.info(
        `::notice::[Batch ${batchIdx}] 🤖 Spawning @surgical_coder subagent (generating surgical replacement blocks)...`,
      );
      const { output: responseText } = await runGeminiWithValidation(
        prompt,
        '@surgical_coder',
        agentSandbox,
        SURGICAL_SCHEMA_PROMPT,
        surgicalValidator,
        SURGICAL_MODELS,
      );

      const appliedFiles = await applySurgicalReplacements(responseText, agentSandbox);

      for (const mapping of fileMappings) {
        const status = appliedFiles[mapping.relative];

        if (status === 'compliant') {
          console.info(`::notice::[Batch ${batchIdx}] 🟢 File is already compliant: ${mapping.relative}`);
          completedFiles.push(mapping.relative);
          continue;
        }

        const srcContent = await readFileSafe(mapping.src, 'utf8');
        const destContent = await readFileSafe(mapping.dest, 'utf8');

        if (srcContent === destContent) {
          console.error(`::error::[Batch ${batchIdx}] ❌ No file changes detected on disk for: ${mapping.relative}`);
          throw new Error(`Subagent failed to produce any valid surgical replacements for: ${mapping.relative}`);
        }

        console.info(`::notice::[Batch ${batchIdx}] 🔍 Generating unified diff for: ${mapping.relative}`);
        let diffOutput;
        try {
          diffOutput = await diffPaths(mapping.src, mapping.dest);
        } catch (err) {
          diffOutput = err.stdout || '';
        }

        // Bounded input context XML wrapping to mitigate prompt injection risks (CVD-2026-002)
        const sanitizedDiff = escapeXml(diffOutput);
        const verifierPrompt = `You are a strict, adversarial software QA verifier.
Your task is to review a proposed code change (git diff) against the original implementation instructions to ensure they have been semantically fulfilled.
You must prevent the developer from "cheating" the checklist by writing inconsequential dummy comments, empty spacing, or unrelated edits to bypass the check.

Instructions:
${groupedTasks[mapping.relative].map((t) => `- ${t.text}`).join('\n')}

<proposed_git_diff>
${sanitizedDiff}
</proposed_git_diff>

Evaluate the proposed change:
1. Did the developer actually implement the semantic requirements of the instructions?
2. Did they cheat by adding a dummy comment (e.g. "// done", "// compliant"), spacing-only changes, or other irrelevant modifications?

You MUST respond with EXACTLY:
"VALID" (if the semantic changes are correct and fully implemented)
or
"INVALID: <reason>" (if the developer cheated, wrote dummy comments, or failed to implement the instructions).`;

        console.info(
          `::notice::[Batch ${batchIdx}] 🛡️  Deploying Adversarial Local Verifier (auditing changes against instructions)...`,
        );
        const verificationResult = await runGeminiWithRetry(
          verifierPrompt,
          '@generalist',
          agentSandbox,
          5,
          FLASH_MODELS,
          60000,
        );

        const trimmedResult = verificationResult.trim();
        if (/^\s*\bVALID\b/i.test(trimmedResult)) {
          console.info(`::notice::[Batch ${batchIdx}] 🟢 LLM Verification PASSED. Applying changes directly...`);
          await fs.promises.mkdir(path.dirname(mapping.src), { recursive: true });
          await writeFileSafe(mapping.src, destContent, 'utf8');

          console.info(`::notice::[Batch ${batchIdx}] ✅ Successfully remediated and updated: ${mapping.relative}`);
          completedFiles.push(mapping.relative);
        } else {
          console.error(
            `::error::[Batch ${batchIdx}] ❌ Verification FAILED for ${mapping.relative}. Reason: ${trimmedResult}`,
          );
          throw new Error(`Adversarial Verifier rejected changes for ${mapping.relative}: ${trimmedResult}`);
        }
      }
    } catch (err) {
      batchError = err;
    }

    return { completedFiles, error: batchError };
  };

  try {
    const results = [];
    for (let i = 0; i < batches.length; i++) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      const res = await processBatch(batches[i], i);
      results.push(res);
    }

    const errors = [];
    const remainingTasks = [];

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const batchFiles = batches[i];

      if (res.error) {
        errors.push(res.error);
        // Retain uncompleted tasks for JSON report rewrite
        for (const file of batchFiles) {
          if (!res.completedFiles.includes(file)) {
            // Remap back to exact target form
            const origItem = groupedTasksArray.find((item) => item.file === file);
            if (origItem) {
              remainingTasks.push(origItem);
            }
          }
        }
      }
    }

    // Write back the remaining tasks (if any) to remediation-report.json
    await writeFileSafe(remediationReportPath, JSON.stringify(remainingTasks, null, 2));

    if (errors.length > 0) {
      console.error(`::error::❌ Auto-remediation failed:`);
      for (const err of errors) {
        console.error(`::error::  - ${err.stack || err.message || err}`);
      }
      throw new Error('Some auto-remediation batches failed.');
    } else {
      console.info(`::notice::🎉 Auto-remediation run completed and verified successfully!`);
      return true;
    }
  } catch (err) {
    console.error(`::error::❌ Fatal Remediation Error in main loop: ${err.message}`);
    throw err;
  }
}
