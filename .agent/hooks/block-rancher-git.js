#!/usr/bin/env node
import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function main() {
  let inputData;
  try {
    inputData = JSON.parse(fs.readFileSync(0, 'utf-8'));
  } catch (err) {
    console.error("Failed to parse stdin JSON:", err);
    console.log(JSON.stringify({ decision: "allow" }));
    process.exit(0);
  }

  const { tool_name, tool_input, cwd } = inputData;

  // We only inspect run_shell_command execution
  if (tool_name !== 'run_shell_command' || !tool_input || !tool_input.command) {
    console.log(JSON.stringify({ decision: "allow" }));
    process.exit(0);
  }

  const command = tool_input.command.trim();

  // Strip leading env var assignments (e.g. KEY=value or KEY="value" or KEY='value') and optional sudo
  let commandClean = command;
  while (true) {
    const next = commandClean.replace(/^[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|"[^"]*"|\S+)\s+/, '');
    if (next === commandClean) break;
    commandClean = next;
  }

  // Check if we are attempting to switch branches while current PR is in Draft mode (Phase 6, Step 18 / Phase 7, Step 20)
  let isBranchSwitch = false;
  if (/\bgit\s+switch\b/.test(commandClean)) {
    isBranchSwitch = true;
  } else if (/\bgit\s+checkout\b/.test(commandClean)) {
    // Check if it is a file-only checkout.
    // A file checkout is characterized by:
    // 1. It contains " -- " followed by a file path, e.g. "git checkout -- file.js".
    // 2. Or the arguments (excluding flags like -f, -q) correspond to existing files/folders on disk.
    const hasDoubleDash = commandClean.includes(' -- ');
    if (hasDoubleDash) {
      isBranchSwitch = false;
    } else {
      // Parse all non-flag arguments
      const parts = commandClean.split(/\s+/).filter(p => p !== 'git' && p !== 'checkout');
      const nonFlagParts = parts.filter(p => !p.startsWith('-') || p === '-'); // Keep '-' because "git checkout -" is a branch switch!
      
      if (nonFlagParts.length > 0) {
        const target = nonFlagParts[0];
        if (target === '-') {
          isBranchSwitch = true;
        } else {
          const resolvedTarget = path.resolve(cwd || process.cwd(), target);
          if (!fs.existsSync(resolvedTarget)) {
            isBranchSwitch = true;
          }
        }
      } else {
        // git checkout with no non-flag arguments (e.g. "git checkout" or "git checkout -f")
        // does not change the current branch, it just discards changes or prints status.
        isBranchSwitch = false;
      }
    }
  }

  if (isBranchSwitch) {
    try {
      const currentBranch = execSync('git branch --show-current', {
        cwd: cwd || process.cwd(),
        stdio: ['ignore', 'pipe', 'ignore']
      }).toString().trim();

      if (currentBranch && currentBranch !== 'main') {
        // Safe command invocation using execFileSync to completely eliminate shell interpolation / command injection risks
        const prStatusOutput = execFileSync('gh', ['pr', 'view', currentBranch, '--json', 'isDraft,number'], {
          cwd: cwd || process.cwd(),
          stdio: ['ignore', 'pipe', 'ignore']
        }).toString().trim();

        if (prStatusOutput) {
          const prInfo = JSON.parse(prStatusOutput);
          if (prInfo.isDraft === true) {
            console.log(JSON.stringify({
              decision: "deny",
              reason: `Security Policy Violation: Moving to a new PR or branch is prohibited while the current branch PR (#${prInfo.number}) is still in Draft mode.\n\n` +
                      `In accordance with Phase 6, Step 18 (Convert to Ready) and Phase 7, Step 20 (Proceed to Next Layer) of 'development-process.md', you MUST first graduate the current PR from Draft to Ready-for-Review before checking out 'main' or switching tasks.\n\n` +
                      `To proceed:\n` +
                      `1. Complete all iteration reviews and obtain local sign-off.\n` +
                      `2. Convert the draft PR to Ready-for-Review (Phase 6, Step 18) using: \`gh pr ready ${prInfo.number}\` (or the create-pr.sh skill).\n` +
                      `3. Once the PR is marked as ready for review on GitHub, you will be authorized to switch branches (Phase 7, Step 20).`,
              systemMessage: `🔒 Security Block: Current PR #${prInfo.number} is in Draft mode. Please comply with Phase 6, Step 18 of development-process.md.`
            }));
            process.exit(0);
          }
        }
      }
    } catch (err) {
      // Allow if git or gh CLI commands fail or are unavailable
    }
  }

  // Check for unauthorized git commit or push operations
  const isCommitOrPush = /\bgit\s+(commit|push)\b/.test(commandClean);
  if (isCommitOrPush) {
    const bypassHook = process.env.BYPASS_COMMIT_HOOK === '1';
    if (!bypassHook) {
      console.log(JSON.stringify({
        decision: "deny",
        reason: `Security Policy Violation: Direct manual git commit and push commands are strictly prohibited in this repository.\n\n` +
                `In accordance with Phase 6, Step 15 (Authorized Commit & Push) of 'development-process.md', you MUST use our custom, secure, and synchronized commit-and-push skill to perform commits and pushes.\n\n` +
                `This skill automatically validates file count limits, synchronizes with upstream main, pulls from your fork remote, and executes GPG/SSH cryptographically signed and signed-off commits.\n\n` +
                `To proceed:\n` +
                `1. Stage your changes cleanly: \`git add <files>...\`\n` +
                `2. Execute the commit-push skill in the chat: \`.agent/skills/commit-push.sh -m "your commit message"\`\n` +
                `3. Provide manual confirmation and allow the skill to execute fully.`,
        systemMessage: "🔒 Security Block: Direct git commit/push is blocked. Please run '.agent/skills/commit-push.sh -m \"...\"' to commit."
      }));
      process.exit(0);
    }

    // Enforce proactive code review verification and file limit checks before git commit is executed
    const isCommit = /\bgit\s+commit\b/.test(commandClean);
    if (isCommit) {
      try {
        // Enforce file limit checkpoint (Phase 5, Step 11) to ensure small, layered commits
        const stagedFilesOutput = execSync('git diff --cached --name-only', {
          cwd: cwd || process.cwd(),
          stdio: ['ignore', 'pipe', 'ignore']
        }).toString().trim();

        const stagedFiles = stagedFilesOutput ? stagedFilesOutput.split('\n') : [];
        const maxAllowedFiles = 5;

        if (stagedFiles.length > maxAllowedFiles) {
          console.log(JSON.stringify({
            decision: "deny",
            reason: `Security Policy Violation: Committing too much code at once is prohibited (${stagedFiles.length} files staged; max allowed is ${maxAllowedFiles}).\n\n` +
                    `In accordance with Phase 5, Step 11 (Logical Partitioning) of 'development-process.md', you MUST group files into focused, independent subsystem boundaries (layers) and make small, focused commits.\n\n` +
                    `Staged Files:\n` +
                    stagedFiles.map(f => `  - ${f}`).join('\n') + `\n\n` +
                    `To proceed:\n` +
                    `1. Unstage some files to keep the commit focused on a single layer of 5 files or fewer using: \`git restore --staged <file>...\`\n` +
                    `2. Group the remaining changes logically and commit them in smaller, surgical increments.\n` +
                    `3. Comply with Phase 5, Step 11 of the development process to ensure safe, reviewable PR branches.`,
            systemMessage: `🔒 Security Block: Staged files count (${stagedFiles.length}) exceeds maximum limit (${maxAllowedFiles}). Please comply with Phase 5, Step 11 of development-process.md.`
          }));
          process.exit(0);
        }

        const statusOutput = execSync('git status --porcelain', {
          cwd: cwd || process.cwd(),
          stdio: ['ignore', 'pipe', 'ignore']
        }).toString();

        let activePlanPath = "";
        statusOutput.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed.includes('.agent/plans/') && trimmed.endsWith('.md')) {
            const parts = trimmed.split(/\s+/);
            activePlanPath = parts[parts.length - 1];
          }
        });

        if (activePlanPath) {
          const resolvedPlanPath = path.resolve(cwd || process.cwd(), activePlanPath);
          if (fs.existsSync(resolvedPlanPath)) {
            const planContent = fs.readFileSync(resolvedPlanPath, 'utf-8');
            
            // Search for unchecked proactive code review items
            const uncheckedReviewRegex = /- \[\s\] [^\n]*(?:proactive[^\n]*review|github-copilot-review|copilot-review)/i;
            if (uncheckedReviewRegex.test(planContent)) {
              console.log(JSON.stringify({
                decision: "deny",
                reason: `Security Policy Violation: Committing code is prohibited without first performing and checking off the proactive code review.\n\n` +
                        `In accordance with Phase 4, Steps 9-10 (Proactive Review & Quality Gate) of 'development-process.md', you MUST delegate a proactive code review of your active git diff directly to our specialized subagent by running \`@review_agent\` in the chat and resolving all findings BEFORE committing.\n\n` +
                        `To proceed:\n` +
                        `1. Delegate a comprehensive review of your changes to our custom subagent in the chat: \`@review_agent Please review my current staged changes\`\n` +
                        `2. Resolve all reported issues, code smells, or styling violations to ensure exactly 0 findings.\n` +
                        `3. Check off the proactive code review item in your active plan ('${activePlanPath}') by marking it as completed (e.g., - [x] Perform a proactive code review...).\n` +
                        `4. Once the review is checked off in the plan, you will be authorized to commit.`,
                systemMessage: "🔒 Security Block: Unchecked proactive code review found in plan. Please comply with Phase 4, Steps 9-10 of development-process.md."
              }));
              process.exit(0);
            }
          }
        }
      } catch (err) {
        // Fallback gracefully on errors
      }
    }

    const segments = command.split(/\s*(?:&&|;|\|\|)\s*/);
    const hasUserApproval = segments.every(segment => {
      const isSegmentCommitOrPush = /\bgit\s+(commit|push)\b/.test(segment);
      if (!isSegmentCommitOrPush) return true;
      const segmentClean = segment.trim();
      return /^(?:[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|"[^"]*"|\S+)\s+)*APPROVED_BY_USER=1\b/.test(segmentClean);
    });
    if (!hasUserApproval) {
      console.log(JSON.stringify({
        decision: "deny",
        reason: "Security Policy Violation: Automated git commits and pushes are strictly prohibited without manual developer review and sign-off.\n\n" +
                "In accordance with Phase 5, Steps 12-14 (Upstream Sync, Layer Isolation, and IDE Review Gateway) and Phase 6, Step 15 (Authorized Commit & Push) of 'development-process.md', you MUST:\n" +
                "1. Synchronize with upstream default branch off-point (Phase 5, Step 12).\n" +
                "2. Isolate the target layer unstaged and present the diff in the chat for developer's IDE review (Phase 5, Steps 13-14).\n" +
                "3. Obtain explicit manual approval to commit/push, and then prefix your command with APPROVED_BY_USER=1 (Phase 6, Step 15) (e.g., `APPROVED_BY_USER=1 git commit -m ...`).",
        systemMessage: "🔒 Security Block: Commit/Push blocked. Please follow Phase 5, Steps 12-14 and Phase 6, Step 15 of development-process.md."
      }));
      process.exit(0);
    }
  }

  // Check if it is a git command and performs a remote-interacting operation
  const isGitCmd = /^(?:sudo\s+)?git\b/.test(commandClean);
  const isRemoteOp = /\b(push|pull|fetch|clone|remote)\b/.test(commandClean);

  if (isGitCmd && isRemoteOp) {
    const targetDir = tool_input.dir_path || cwd || process.cwd();

    // Check command string directly to catch inline URL references or remote additions
    // Ignore false positives from the filename "block-rancher-git.js"
    const hasRancherRef = /rancher/i.test(command.replace(/block-rancher-git\.js/g, ''));
    if (hasRancherRef) {
      console.log(JSON.stringify({
        decision: "deny",
        reason: "Security Policy Violation: Git command contains references to Rancher remote/URLs, which is strictly blocked.",
        systemMessage: "🔒 Security Block: Prohibited remote/URL reference detected."
      }));
      process.exit(0);
    }

    try {
      // Fetch remote URLs configured in this repo
      const remotesOutput = execSync('git remote -v', {
        cwd: path.resolve(targetDir),
        stdio: ['ignore', 'pipe', 'ignore']
      }).toString();

      // Check if any remote URL contains "rancher" (case-insensitive)
      if (/rancher/i.test(remotesOutput)) {
        console.log(JSON.stringify({
          decision: "deny",
          reason: "Security Policy Violation: Operations (push, pull, fetch, remote) targeting Rancher-owned remotes are strictly blocked.",
          systemMessage: "🔒 Security Block: Git remote operation against a Rancher remote is prohibited."
        }));
        process.exit(0);
      }
    } catch {
      // Ignore git command execution failures (e.g. not in a git repo) and proceed safely
    }
  }

  // Allow all other commands to proceed
  console.log(JSON.stringify({ decision: "allow" }));
  process.exit(0);
}

main();
