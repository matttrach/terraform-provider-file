import { spawn } from 'child_process';
import os from 'os';

/**
 * Helper to stream Gemini subagent output in real-time inside a target sandbox directory.
 * Overrides the HOME env variable to bypass our strict Gated Lifecycle hooks.
 * @param {string} prompt
 * @param {string} subagent
 * @param {string} targetSandboxDir
 * @returns {Promise<string>}
 */
export function runGemini(prompt, subagent, targetSandboxDir, model = null, timeoutMs = 0, contextLabel = '') {
  return new Promise((resolve, reject) => {
    let args;
    let stdinPayload = null;

    if (prompt.length > 16384) {
      args = ['-p', `${subagent}: Please analyze the instructions and input provided via stdin.`, '--skip-trust'];
      stdinPayload = prompt;
    } else {
      args = ['-p', `${subagent}: ${prompt}`, '--skip-trust'];
    }

    if (model) {
      args.push('--model', model);
    }

    const child = spawn('gemini', args, {
      cwd: targetSandboxDir,
      timeout: timeoutMs,
      stdio: [stdinPayload ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        HOME: targetSandboxDir,
        GEMINI_CLI_HOME: os.homedir(),
        CI: 'true',
      },
    });

    if (stdinPayload) {
      child.stdin.write(stdinPayload);
      child.stdin.end();
    }

    let stdout = '';
    let stderr = '';

    const cleanLabel = subagent.replace('@', '');
    const prefix = contextLabel ? `::sub-agent_${cleanLabel}[${contextLabel}]:: ` : `::sub-agent_${cleanLabel}:: `;

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn gemini process: ${err.message}`));
    });

    let stdoutBuffer = '';
    child.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop(); // Keep incomplete line in buffer
      lines.forEach((line) => {
        process.stdout.write(`${prefix}${line}\n`);
      });
      stdout += data.toString();
    });

    let stderrBuffer = '';
    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop(); // Keep incomplete line in buffer
      lines.forEach((line) => {
        process.stderr.write(`${prefix}${line}\n`);
      });
      stderr += data.toString();
    });

    child.on('close', (code) => {
      // Flush remaining buffers
      if (stdoutBuffer) {
        process.stdout.write(`${prefix}${stdoutBuffer}\n`);
      }
      if (stderrBuffer) {
        process.stderr.write(`${prefix}${stderrBuffer}\n`);
      }
      if (code !== 0) {
        reject(new Error(`gemini process exited with code ${code}.\nStderr: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Wrapper around runGemini to support exponential backoff on model rate limits.
 * @param {string} prompt
 * @param {string} subagent
 * @param {string} targetSandboxDir
 * @param {number} maxAttempts
 * @returns {Promise<string>}
 */
export async function runGeminiWithRetry(
  prompt,
  subagent,
  targetSandboxDir,
  maxAttempts = 5,
  models = null,
  timeoutMs = 0,
  contextLabel = '',
) {
  const modelArray = Array.isArray(models) ? models : models ? [models] : [null];
  let delay = 5000;

  for (let i = 0; i < modelArray.length; i++) {
    const currentModel = modelArray[i];
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const result = await runGemini(prompt, subagent, targetSandboxDir, currentModel, timeoutMs, contextLabel);
        return result;
      } catch (err) {
        if (i < modelArray.length - 1) {
          console.warn(
            `🔄 Error encountered on ${currentModel || 'default'}. Failing over immediately to next model: ${modelArray[i + 1]}... Error: ${err.message.split('\n')[0]}`,
          );
          delay = 5000;
          break; // Break the while loop to move to the next model in the for loop
        } else if (attempt < maxAttempts) {
          console.warn(
            `⚠️ [Sandbox] Error or rate limit on ${subagent} (${currentModel || 'default'}) (Attempt ${attempt}/${maxAttempts}). Retrying in ${delay / 1000}s... Error: ${err.message.split('\n')[0]}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw err; // No more models to try, bubble up the error
        }
      }
    }
  }
}

export async function runGeminiWithValidation(
  prompt,
  subagent,
  targetSandboxDir,
  schemaPrompt,
  validatorFn,
  models = null,
  timeoutMs = 0,
  contextLabel = '',
  formatterAgent = null,
  formatterPromptTemplate = null,
) {
  // 1. Run the primary domain-expert agent
  const rawOutput = await runGeminiWithRetry(prompt, subagent, targetSandboxDir, 5, models, timeoutMs, contextLabel);

  // 2. Fast Path: Attempt to validate the domain agent's output directly
  try {
    const validatedOutput = validatorFn(rawOutput);
    return { output: rawOutput, validatedOutput };
  } catch (err) {
    if (!formatterAgent) {
      throw err;
    }

    console.warn(
      `::notice::[Formatting Adapter] Domain agent ${subagent} output did not match target JSON schema. Error: ${err.message}. Invoking ${formatterAgent} adapter...`,
    );

    // 3. Fallback Path: Deploy the specialized formatter agent in a 5-attempt self-healing loop
    let currentFeedback = err.message;
    let currentRawOutput = rawOutput;
    let attempt = 0;
    const maxFormatterRetries = 5;

    while (attempt < maxFormatterRetries) {
      attempt++;

      let formatterPrompt;
      if (typeof formatterPromptTemplate === 'function') {
        formatterPrompt = formatterPromptTemplate({ schemaPrompt, currentRawOutput, currentFeedback });
      } else if (formatterPromptTemplate) {
        formatterPrompt = formatterPromptTemplate
          .replace(/\{\{schemaPrompt\}\}/g, schemaPrompt)
          .replace(/\$\{schemaPrompt\}/g, schemaPrompt)
          .replace(/\{\{currentRawOutput\}\}/g, currentRawOutput)
          .replace(/\$\{currentRawOutput\}/g, currentRawOutput)
          .replace(/\{\{raw_output\}\}/g, currentRawOutput)
          .replace(/\$\{raw_output\}/g, currentRawOutput)
          .replace(/\{\{currentFeedback\}\}/g, currentFeedback)
          .replace(/\$\{currentFeedback\}/g, currentFeedback);
      } else {
        formatterPrompt = `Format the raw text inside the <raw_output> block strictly into the required JSON schema.

Target JSON Schema:
${schemaPrompt}

<raw_output>
${currentRawOutput}
</raw_output>

Feedback/Parsing Error:
${currentFeedback}

Follow your instructions exactly. Output ONLY the JSON wrapped in markdown code blocks.`;
      }

      let formatterOutput;
      try {
        // Run the formatter subagent using fast/cheap gemini-3.1-flash-lite
        const result = await runGeminiWithRetry(
          formatterPrompt,
          formatterAgent,
          targetSandboxDir,
          5,
          ['gemini-3.1-flash-lite'],
          timeoutMs,
          contextLabel,
        );
        formatterOutput = result;
      } catch (runErr) {
        console.warn(`::warning::[Formatting Adapter] Failed to run formatter subagent: ${runErr.message}`);
        formatterOutput = '';
      }

      try {
        const validatedOutput = validatorFn(formatterOutput);
        console.log(
          `::notice::[Formatting Adapter] 🟢 Successfully adapted and validated JSON schema on Attempt ${attempt}/${maxFormatterRetries}!`,
        );
        return { output: formatterOutput, validatedOutput };
      } catch (validationErr) {
        console.warn(
          `::warning::[Formatting Adapter] Formatter validation failed (Attempt ${attempt}/${maxFormatterRetries}): ${validationErr.message}`,
        );
        if (attempt >= maxFormatterRetries) {
          throw new Error(
            `Formatter subagent failed to produce valid JSON schema after ${maxFormatterRetries} attempts. Error: ${validationErr.message}\nRaw Output: ${formatterOutput}`,
            { cause: validationErr },
          );
        }
        currentFeedback = validationErr.message;
        currentRawOutput = formatterOutput;
      }
    }
  }
}
