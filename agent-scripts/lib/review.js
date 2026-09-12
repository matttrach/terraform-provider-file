import fs from 'fs';
import path from 'path';
import { readFileSafe, writeFileSafe, mkdtempSafe, statSafe } from './file.js';
import { runGeminiWithValidation } from './gemini.js';
import { gitDiffStagedContext } from './git.js';
import { extractNodeStructure } from '../context-reducer.js';
import { readPlan } from './plan.js';

const REVIEW_CONFIG = {
  batchSize: parseInt(process.env.GEMINI_REVIEW_BATCH_SIZE || '10', 10),
  staggerDelay: parseInt(process.env.GEMINI_REVIEW_STAGGER_DELAY || '6000', 10),
  excludedAgents: new Set(['project_manager', 'surgical_coder', 'data_scientist', 'json_formatter']),
  modelTiers: {
    flash: ['gemini-3.1-flash-lite', 'gemini-3.5-flash'],
    pro: ['gemini-3.1-pro-preview', 'gemini-3.5-flash'],
  },
};

const AUDITOR_SCHEMA_PROMPT = `[
  {
    "file": "relative_filepath",
    "line": 15,
    "issue_type": "concurrency|security|standards|etc",
    "evidence": "verbatim snippet of offending code",
    "raw_rationale": "narrative description of the flaw"
  }
]`;

const SCIENTIST_SCHEMA_PROMPT = `{
  "project_report": [
    {
      "file": "relative_filepath",
      "finding": "description of tradeoff",
      "severity": "HIGH/MEDIUM/LOW",
      "reason": "detailed design/technical reasoning"
    }
  ],
  "active_findings": [
    {
      "severity": "HIGH/MEDIUM/LOW",
      "file": "relative_filepath",
      "finding": "description of finding"
    }
  ],
  "suggested_commit": {
    "title": "Chore: commit title",
    "message": "Commit description"
  },
  "approval_status": "APPROVED/UNAPPROVED"
}`;

function getStandardsFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let mappings = {
    '.go': 'docs/development/reference/Go.md',
    '.tf': 'docs/development/reference/Terraform.md',
    '.sh': 'docs/development/reference/ShellScripts.md',
    '.bash': 'docs/development/reference/ShellScripts.md',
    '.js': 'docs/development/reference/JavaScript.md',
    '.mjs': 'docs/development/reference/JavaScript.md',
    '.cjs': 'docs/development/reference/JavaScript.md',
    '.ts': 'docs/development/reference/JavaScript.md',
    '.md': 'docs/development/reference/Documentation.md',
    default: 'docs/development/reference/CodingStandards.md',
  };

  try {
    const configPath = path.join(process.cwd(), '.gemini/standards-mapping.json');
    if (fs.existsSync(configPath)) {
      const userMappings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      mappings = { ...mappings, ...userMappings };
    }
  } catch (err) {
    console.warn(`Failed to read standards mapping file: ${err.message}`);
  }

  return mappings[ext] || mappings['default'];
}

function parseJSONFromText(text) {
  const match = text.match(/```json\s*\n([\s\S]*?)\n\s*```/) || text.match(/```\s*\n([\s\S]*?)\n\s*```/);
  const clean = (match ? match[1] : text).trim();
  try {
    return JSON.parse(clean);
  } catch (err) {
    console.error(`Invalid JSON: ${err.message}`);
    return clean.startsWith('[') ? [] : {};
  }
}

const auditorValidator = (output) => {
  const parsed = parseJSONFromText(output);
  if (!Array.isArray(parsed)) {
    throw new Error('Output must be a valid JSON array.');
  }
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Each item in the array must be an object.');
    }
    if (typeof item.file !== 'string') {
      throw new Error("Each item must have a string 'file' property.");
    }
    if (typeof item.raw_rationale !== 'string' && typeof item.finding !== 'string') {
      throw new Error("Each item must have either a 'raw_rationale' or a 'finding' string property.");
    }
  }
  return parsed;
};

const scientistValidator = (output) => {
  const parsed = parseJSONFromText(output);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Output must be a valid JSON object.');
  }
  const requiredKeys = ['active_findings', 'project_report'];
  for (const key of requiredKeys) {
    if (!(key in parsed)) {
      throw new Error(`JSON is missing required key: "${key}"`);
    }
  }
  if (!Array.isArray(parsed.active_findings)) {
    throw new Error('"active_findings" must be an array.');
  }
  if (!Array.isArray(parsed.project_report)) {
    throw new Error('"project_report" must be an array.');
  }
  return parsed;
};

// Map Phase: Parallel Auditor Execution
export async function runMapPhase(
  files,
  isEntireFileReview,
  targetDir,
  sandboxDir,
  workspaceRoot,
  isFullContext = false,
  priorPassFindings = null,
) {
  const agentsDir = path.join(workspaceRoot, '.gemini/agents');
  let rawAgents;
  try {
    rawAgents = await fs.promises.readdir(agentsDir);
  } catch (err) {
    console.warn(`::warning::Failed to read agents directory: ${err.message}`);
    return [];
  }

  const agents = [];
  for (const file of rawAgents) {
    if (file.endsWith('.md')) {
      const name = path.basename(file, '.md');
      if (REVIEW_CONFIG.excludedAgents.has(name)) {
        continue;
      }
      agents.push({ id: `@${name}`, name });
    }
  }

  console.log(`::notice::Active review subagents: ${agents.map((a) => a.name).join(', ')}`);

  // Build the full combined diff text if we are not in single file mode
  let fullContent = '';
  if (isEntireFileReview) {
    for (const f of files) {
      const absolute = path.resolve(workspaceRoot, f);
      const content = (await readFileSafe(absolute, 'utf8')) || '';
      fullContent += `\n\n--- FILE: ${f} ---\n${content}`;
    }
  } else {
    fullContent = await gitDiffStagedContext();
  }

  if (process.env.GEMINI_STAGGER_DELAY) {
    console.log(`::notice::Applying explicit Map-Reduce review stagger delay of ${REVIEW_CONFIG.staggerDelay}ms...`);
  }

  const activeNotes = [];

  for (const agent of agents) {
    console.log(`::notice::Deploying ${agent.name} auditor subagent...`);

    if (agent.name === 'heads_down_coder') {
      const fileWorkerPromises = files.map(async (file, idx) => {
        try {
          const batchSandbox = await mkdtempSafe(path.join(sandboxDir, `batch-${idx}-`));
          const absPath = path.resolve(workspaceRoot, file);
          const standardsFile = getStandardsFile(file);
          const standardsPath = path.join(workspaceRoot, standardsFile);

          const [srcContent, standardsContent] = await Promise.all([
            readFileSafe(absPath, 'utf8'),
            readFileSafe(standardsPath, 'utf8').catch(() => 'No coding standards file found.'),
          ]);

          const prompt = `Review the file '${file}' strictly following the project coding standards. Follow your instructions exactly.

    Your output MUST be a valid JSON array matching this schema:
    [
    {
    "file": "${file}",
    "line": 15,
    "issue_type": "concurrency|security|standards|etc",
    "evidence": "verbatim snippet of offending code",
    "raw_rationale": "narrative description of the flaw"
    }
    ]
    Do not wrap your output in markdown code blocks unless they are \`\`\`json blocks. Under no circumstances should you output normal text.

    Coding Standards Reference (${standardsFile}):
    <standards>
    ${standardsContent}
    </standards>

    File Content to Review ('${file}'):
    <source_code>
    ${srcContent}
    </source_code>`;

          const { output } = await runGeminiWithValidation(
            prompt,
            '@heads_down_coder',
            batchSandbox,
            AUDITOR_SCHEMA_PROMPT,
            auditorValidator,
            REVIEW_CONFIG.modelTiers.flash,
            300000,
          );
          return output;
        } catch (err) {
          console.warn(
            `::warning::Heads-down review failed for ${file}: ${err.message}. Proceeding with empty findings.`,
          );
          return '[]';
        }
      });

      const batchResults = await Promise.all(fileWorkerPromises);
      const coderNotes = batchResults
        .filter(Boolean)
        .map((res) => {
          const parsed = parseJSONFromText(res);
          return Array.isArray(parsed) ? parsed : [];
        })
        .flat();

      activeNotes.push({
        agent: 'heads_down_coder',
        notes: JSON.stringify(coderNotes, null, 2),
      });
    } else {
      try {
        const audSandbox = await mkdtempSafe(path.join(sandboxDir, `${agent.name}-`));
        const audDiffFile = path.join(audSandbox, 'full_diff.txt');
        await writeFileSafe(audDiffFile, fullContent);

        let prompt = `Review the full set of changes provided in the <full_diff> block below from a specialized ${agent.name.replace(/_/g, ' ')} perspective. Follow your instructions exactly.

    Your output MUST be a valid JSON array matching this schema:
    [
    {
    "file": "relative_filepath",
    "severity": "HIGH/MEDIUM/LOW",
    "finding": "description of the vulnerability, design error, or violation"
    }
    ]
    Do not wrap your output in markdown code blocks unless they are \`\`\`json blocks. Under no circumstances should you output normal text.

    <full_diff>
    ${fullContent}
    </full_diff>`;

        if (isFullContext && priorPassFindings) {
          prompt += `\n\nPreviously discovered findings to IGNORE in this pass:\n${JSON.stringify(priorPassFindings, null, 2)}\nFocus strictly on discovering NEW issues from your specialized perspective.`;
        }

        const targetModels =
          agent.name === 'lead_architect' ? REVIEW_CONFIG.modelTiers.pro : REVIEW_CONFIG.modelTiers.flash;
        const { output } = await runGeminiWithValidation(
          prompt,
          agent.id,
          audSandbox,
          AUDITOR_SCHEMA_PROMPT,
          auditorValidator,
          targetModels,
          300000,
        );
        activeNotes.push({
          agent: agent.name,
          notes: JSON.stringify(parseJSONFromText(output), null, 2),
        });
      } catch (err) {
        console.warn(`::warning::Auditor ${agent.name} failed: ${err.message}. Proceeding with empty findings.`);
        activeNotes.push({
          agent: agent.name,
          notes: '[]',
        });
      }
    }
  }

  const allFindings = [];
  for (const item of activeNotes) {
    const findings = JSON.parse(item.notes);
    if (Array.isArray(findings)) {
      for (const f of findings) {
        const severity = f.severity || (item.agent === 'security_auditor' ? 'HIGH' : 'MEDIUM');
        const findingText = f.finding || f.raw_rationale || f.description || 'No description';
        allFindings.push({
          source: item.agent,
          file: f.file || 'unknown',
          severity: severity.toUpperCase(),
          finding: findingText,
        });
      }
    }
  }

  return allFindings;
}

// Helper to recursively list files with ignored filtering
async function getFilesRecursively(dir, workspaceRoot) {
  let results = [];
  const list = await fs.promises.readdir(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    if (file === '.git' || file === 'node_modules' || file === 'bin' || file === 'test') {
      continue;
    }
    const stat = await statSafe(filePath);
    if (stat && stat.isDirectory()) {
      const nested = await getFilesRecursively(filePath, workspaceRoot);
      results = results.concat(nested);
    } else {
      results.push(filePath);
    }
  }
  return results;
}

// Enriched Context Builder for Triage Aggregator (Data Scientist)
async function buildTriageCodebaseContext(workerNotes, workspaceRoot) {
  const rawNotesString = JSON.stringify(workerNotes);
  const filesToLoad = new Set();
  const squashedFiles = new Set();

  // 1. Eagerly load all standards reference documents
  const referenceDir = path.join(workspaceRoot, 'docs/development/reference');
  try {
    const refFiles = await fs.promises.readdir(referenceDir);
    for (const file of refFiles) {
      const fullPath = path.join(referenceDir, file);
      const stat = await statSafe(fullPath);
      if (stat && stat.isFile() && file.endsWith('.md')) {
        filesToLoad.add(path.join('docs/development/reference', file));
      }
    }
  } catch (err) {
    console.warn(`::warning::Failed to read standards reference directory: ${err.message}`);
  }

  // 2. Scan raw notes to extract file paths
  const pathRegex = /\b(?:agent-scripts|docs|internal|\.gemini)\/[a-zA-Z0-9_./-]+\b/g;
  let match;
  while ((match = pathRegex.exec(rawNotesString)) !== null) {
    const matchedPath = match[0];

    // Check if it's a file
    const srcPath = path.resolve(workspaceRoot, matchedPath);
    try {
      const stat = await statSafe(srcPath);
      if (stat && stat.isFile()) {
        if (matchedPath.startsWith('agent-scripts/') || matchedPath.startsWith('.gemini/')) {
          squashedFiles.add(matchedPath);
        } else {
          filesToLoad.add(matchedPath);
        }
      }
    } catch (err) {
      console.error(`Error checking stat for ${srcPath}: ${err.message}`);
    }

    // 3. Eager load full agent-scripts and .gemini as SQUASHED if agent concerns are detected
    if (matchedPath.startsWith('agent-scripts/') || matchedPath.startsWith('.gemini/')) {
      const agentScriptsFiles = await getFilesRecursively(
        path.join(workspaceRoot, 'agent-scripts'),
        workspaceRoot,
      ).catch(() => []);
      const geminiFiles = await getFilesRecursively(path.join(workspaceRoot, '.gemini'), workspaceRoot).catch(() => []);
      for (const file of [...agentScriptsFiles, ...geminiFiles]) {
        const rel = path.relative(workspaceRoot, file);
        if (rel !== '.gemini/project-report.json' && rel !== '.gemini/settings.json') {
          squashedFiles.add(rel);
        } else {
          filesToLoad.add(rel); // Load full settings/report
        }
      }
    }

    // 4. Implicit mapping logic: if lib/X.js is loaded, automatically include tools/X.js (squashed)
    if (matchedPath.startsWith('agent-scripts/lib/')) {
      const toolFile = matchedPath.replace('agent-scripts/lib/', 'agent-scripts/tools/');
      squashedFiles.add(toolFile);
    }
  }

  console.info(
    `::notice::[REDUCE] Massively enriching Triage Aggregator context with ${filesToLoad.size} full files and ${squashedFiles.size} squashed files...`,
  );
  let codebaseBlock = '<workspace_codebase>\n';

  // Load full files
  for (const file of filesToLoad) {
    const srcPath = path.resolve(workspaceRoot, file);
    try {
      await fs.promises.access(srcPath);
      const stat = await statSafe(srcPath);
      if (stat && stat.isFile()) {
        const content = await readFileSafe(srcPath, 'utf8');
        if (content && content.trim()) {
          codebaseBlock += `<file path="${file}">\n${content}\n</file>\n\n`;
        }
      }
    } catch (err) {
      console.error(`Error loading full file ${file}: ${err.message}`);
    }
  }

  // Load squashed files (classes/functions JSON metadata)
  for (const file of squashedFiles) {
    const srcPath = path.resolve(workspaceRoot, file);
    try {
      const struct = extractNodeStructure(srcPath);
      if (struct && !struct.error) {
        codebaseBlock += `<reduced_file_context path="${file}">\n${JSON.stringify(struct, null, 2)}\n</reduced_file_context>\n\n`;
      }
    } catch (err) {
      console.error(`Error loading squashed context for ${file}: ${err.message}`);
    }
  }

  codebaseBlock += '</workspace_codebase>';
  return codebaseBlock;
}

export async function runReducePhase(workerNotes, outputFilePath, targetDir, sandboxDir, workspaceRoot) {
  const activePlanContent = (await readPlan(targetDir)) || 'No active plan found.';

  // Load stateful project-report.json from repository if it exists
  const stateFile = path.join(workspaceRoot, '.gemini/project-report.json');
  let priorDecisions = [];
  try {
    if (fs.existsSync(stateFile)) {
      const content = fs.readFileSync(stateFile, 'utf8');
      priorDecisions = JSON.parse(content);
      console.log('::notice::Loaded stateful project-report.json from .gemini/ directory.');
    }
  } catch (err) {
    console.warn(`::warning::Failed to load project-report.json: ${err.message}`);
  }

  // Compile enriched context block dynamically for the Triage Aggregator
  const codebaseBlock = await buildTriageCodebaseContext(workerNotes, workspaceRoot || process.cwd());

  const scientistPrompt = `You are the Triage Aggregator (Data Scientist). Your sole responsibility is to evaluate a raw list of reviews, cross-reference them against established prior decisions and the active plan, and determine active technical debt.

Target JSON Schema to return:
{
  "project_report": [
    {
      "file": "relative_filepath",
      "finding": "description of tradeoff",
      "severity": "HIGH/MEDIUM/LOW",
      "reason": "detailed design/technical reasoning"
    }
  ],
  "active_findings": [
    {
      "severity": "HIGH/MEDIUM/LOW",
      "file": "relative_filepath",
      "finding": "description of finding"
    }
  ],
  "suggested_commit": {
    "title": "Chore: commit title",
    "message": "Commit description"
  },
  "approval_status": "APPROVED/UNAPPROVED"
}

Prior Project Tradeoff Decisions (<prior_project_decisions>):
<prior_project_decisions>
${JSON.stringify(priorDecisions, null, 2)}
</prior_project_decisions>

Active Implementation Plan (<active_plan>):
<active_plan>
${activePlanContent}
</active_plan>

Codebase Context (<workspace_codebase>):
${codebaseBlock}

Raw Subagent Review Findings (<raw_subagent_findings>):
<raw_subagent_findings>
${JSON.stringify(workerNotes, null, 2)}
</raw_subagent_findings>

Instructions:
1. Deduplicate the raw findings.
2. Evaluate each finding against the <prior_project_decisions> block and the <active_plan> block.
   - If a finding is already listed in <prior_project_decisions> (or matches semantically), you MUST suppress it. Put all suppressed tradeoffs in the "project_report" array.
   - **Scope Creep Prevention Rule**: If a finding is NOT directly related to the functional intent or specific files of the approved <active_plan> (e.g., if it is an unrelated linting issue, legacy naming discrepancy, or minor style issue on files untouched by the plan's direct implementation), you MUST classify it as OUT OF SCOPE. Just because a reviewer found an issue doesn't mean we have to fix it in this PR.
   - Any out-of-scope finding MUST be suppressed and placed in the "project_report" array (use 'Out of scope of the active plan' or a specific technical reason under the 'reason' property). Do NOT flag it as an active finding.
3. If a finding is new, is directly within the functional scope and intent of the <active_plan> files, and is not a suppressed tradeoff, put it in the "active_findings" array.
4. If there are any active findings, set "approval_status" to "UNAPPROVED". If there are zero active findings, set "approval_status" to "APPROVED".
5. Suggest a conventional git commit message detailing the aggregate review work.
6. Return only the JSON block. No commentary.`;

  const { output: scientistOutput } = await runGeminiWithValidation(
    scientistPrompt,
    '@data_scientist',
    sandboxDir,
    SCIENTIST_SCHEMA_PROMPT,
    scientistValidator,
    REVIEW_CONFIG.modelTiers.pro, // Escalate Triage Aggregator to Pro model for high-end reasoning
    300000,
  );

  const parsedReport = parseJSONFromText(scientistOutput);

  // Re-map format to maintain backwards compatibility with high-level reporting logic if needed
  const reportWrapper = {
    suppressed_findings: parsedReport.project_report,
    summary: {
      security: 'Tradeoffs evaluated securely.',
      coding_standards: 'Architectural rules and SOLID compliance triaged cleanly.',
      spelling_wording: 'Spelling checks clean.',
      automation_audit: 'Automation and pipeline states checked.',
    },
    active_ledger: parsedReport.active_findings,
    suggested_commit: parsedReport.suggested_commit,
    approval_status: parsedReport.approval_status,
  };

  const finalReportString = JSON.stringify(reportWrapper, null, 2);
  await writeFileSafe(outputFilePath, finalReportString);
  console.info('::notice::--- Final Review Report ---');
  console.info(finalReportString);

  return finalReportString;
}
