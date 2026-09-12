import fs from 'fs';
import path from 'path';
import { writeFileSafe, readFileSafe } from './file.js';
import { runGeminiWithValidation } from './gemini.js';

const PRO_MODELS = ['gemini-3.1-pro-preview', 'gemini-3.5-flash'];

const REMEDIATION_SCHEMA_PROMPT = `[
  {
    "file": "relative_filepath",
    "line_numbers": [12, 13, 14],
    "narrative": "Detailed, highly explicit instructions describing exactly what changes are required so the downstream surgical coder can implement it blindly"
  }
]`;

function parseJSONFromText(text) {
  let clean = text;
  let startIdx = text.indexOf('```json');
  let tokenLength = 7;
  if (startIdx === -1) {
    startIdx = text.indexOf('```');
    tokenLength = 3;
  }
  if (startIdx !== -1) {
    const endIdx = text.indexOf('```', startIdx + tokenLength);
    if (endIdx !== -1) {
      clean = text.substring(startIdx + tokenLength, endIdx);
    }
  }
  try {
    return JSON.parse(clean.trim());
  } catch (err) {
    throw new Error(`Invalid JSON: ${err.message}`, { cause: err });
  }
}

const pmValidator = (output) => {
  const parsed = parseJSONFromText(output);
  if (!Array.isArray(parsed)) {
    throw new Error('Output must be a valid JSON array matching the remediation schema.');
  }
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Each item in the array must be an object.');
    }
    if (typeof item.file !== 'string' || !Array.isArray(item.line_numbers) || typeof item.narrative !== 'string') {
      throw new Error(
        "Each item must have a string 'file', an array 'line_numbers', and a string 'narrative' property.",
      );
    }
  }
  return parsed;
};

export async function runProjectManager(reportContent, targetDir, workspaceRoot, sandboxDir) {
  let reportObj;
  try {
    reportObj = JSON.parse(reportContent);
  } catch (err) {
    console.log(`::error::[PM] Failed to parse review report JSON: ${err.message}`);
    return { worklist: '[]', projectReport: '[]' };
  }

  const activeLedger = reportObj.active_ledger || [];
  const filesWithFindings = [...new Set(activeLedger.map((item) => item.file))].filter((f) => f && f !== 'unknown');

  // Compile target codebase context for only those specific files with active findings
  console.log(
    `::notice::[PM] Compiling targeted codebase context for ${filesWithFindings.length} file(s) with active findings...`,
  );
  let codebaseBlock = '<workspace_codebase>\n';
  for (const file of filesWithFindings) {
    const srcPath = path.resolve(workspaceRoot, file);
    try {
      await fs.promises.access(srcPath);
      const content = await readFileSafe(srcPath, 'utf8');
      if (content && content.trim()) {
        codebaseBlock += `<file path="${file}">\n${content}\n</file>\n\n`;
      }
    } catch {
      console.log(`::warning::[PM] Could not access or read target file: ${file}`);
    }
  }
  codebaseBlock += '</workspace_codebase>';

  const topSection = `You are a Developer Action Items Plan Mode Analyzer subagent. Your role is to translate the active findings of the synthesized review report into a file-grouped, line-targeted, and highly specific narrative remediation plan.`;
  const middleSection = `<review_report>\n${reportContent}\n</review_report>\n\n${codebaseBlock}\n\n`;
  const bottomSection = `Analyze the findings inside the <review_report> block carefully. Cross-reference them against the actual code provided inside the <workspace_codebase> block.

Your output MUST be a strict, valid JSON array containing exactly the file path, the target line numbers, and a highly specific, detailed, and targeted narrative description of the required changes for each file. 

Format your output strictly matching this schema, with NO markdown commentary outside of the \`\`\`json block:
\`\`\`json
[
  {
    "file": "relative_filepath",
    "line_numbers": [12, 13, 14],
    "narrative": "Highly explicit, line-targeted instructions. Describe exactly what lines to modify, what functions to change, what imports to add/remove, and what logic to write so the downstream surgical coder can implement it blindly without any surrounding context."
  }
]
\`\`\`

If there are 0 active findings, output an empty array: \`[]\`.

Under no circumstances should you output normal narrative text or markdown headers outside the JSON array block. Ensure your output is 100% syntactically valid JSON.`;

  const prompt = `${topSection}\n\n${middleSection}${bottomSection}`;

  console.log(`::notice::Invoking @project_manager to analyze review and generate remediation worklist...`);

  const { output } = await runGeminiWithValidation(
    prompt,
    '@project_manager',
    sandboxDir,
    REMEDIATION_SCHEMA_PROMPT,
    pmValidator,
    PRO_MODELS,
    180000,
  );

  const LOGS_DIR = path.join(targetDir, 'logs');
  const reportFile = path.join(LOGS_DIR, `project_manager_report.json`);
  await writeFileSafe(reportFile, reportContent, { mode: 0o600 });

  const cleanOutput = parseJSONFromText(output);
  const worklist = JSON.stringify(cleanOutput, null, 2);

  // We no longer need an independent projectReport here as design tradeoffs are already resolved and merged by the Triage Aggregator (Data Scientist)
  return { worklist, projectReport: '[]' };
}
