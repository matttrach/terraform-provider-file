# Sub-Agent Prompting Architecture (Conceptual Explanation)

This document provides a reflective, concept-oriented overview of the specialized subagent prompting philosophy, the core mental-model shift required to build deterministic agents, and the mitigation of LLM attention dilution. It aligns with our mandatory 4-Phase Lifecycle (Plan, Implement, Review, Commit) and the 3-Gate Architecture (Planning Gate 1, Review/Testing Gate 2, Commit Gate 3) to ensure architectural nomenclature alignment across all automation scripts and subagents.

---

## 1. The Core Mental-Model Shift

Transitioning from standard chatbot prompts to effective subagent prompt engineering requires shifting the engineering mindset from **"How do I get an answer?"** to **"How do I build a modular software component?"**

When a parent coordinator spawns a subagent, it is not initiating a loose, conversational dialogue. It is executing a **tightly scoped, deterministic function call**.

- A standard chatbot prompt is unstructured, conversational, and highly context-sensitive.
- A standardized subagent prompt is structured, micro-scoped, schema-contracted, and completely isolated.

By stripping away conversational elements and treating the LLM as a data-transformation pipe, we can achieve high predictability, rapid execution, and robust error handling.

---

## 2. Key Prompting Concepts

### A. Find the "Goldilocks Zone" (Altitude Control)

A common mistake in subagent prompting is writing overly restrictive, brittle rules (hardcoding precise multi-step execution sequences) or providing broad, abstract advice.

- **Overly Restrictive (Procedural)**: "Step 1: Read file X. Step 2: Search for Y. Step 3: Write report." This bottlenecks the LLM's adaptive thinking and causes immediate failures if the file structure varies slightly.
- **Overly Broad (Abstract)**: "Review the code for best practices and make sure it is good." This leads to generic, low-signal, and highly unpredictable outputs.
- **The Goldilocks Zone (Goal-Oriented)**: Define the precise boundaries of the agent's world, what it is optimizing for, what criteria it must evaluate, and what constitutes a successful termination state. Let the model organically plan its tool use within those hard boundaries.

### B. Boundary Engines (Preventing Scope Leakage)

To keep token usage low and prevent context window bloat, specialized subagent prompts must bypass generic behavioral guidelines entirely. They must strictly function as **Boundary Engines**—defining exactly what the agent looks at, and explicitly prohibiting it from evaluating or commenting on anything else.
For example, a _Local Code Reviewer_ must be entirely blind to file architecture, imports, and system patterns, while a _Global Code Reviewer_ must completely ignore individual code line optimizations, naming quirks, or syntax formatting. This division of labor prevents duplicate processing and keeps the payload extremely compact.

### C. Strict Handoff Contracts

Because a subagent's output must be programmatically parsed and consumed by a parent coordinator or a subsequent agent, it cannot simply return a loose, conversational chat response. It must be bound to a rigid **Handoff Contract**:

- Outputs must be formatted strictly in a standardized schema (such as compact JSON arrays or a rigid markdown CVD layout) wrapped inside a single code block.
- This allows the parent process to run automated validation scripts (unit tests) over the subagent outputs before passing them to the next agent in line, completely blocking downstream context bloat or malformed structures.

---

## 3. Combating LLM Attention Dilution & "Loop-Flapping"

### The Phenomenon of Attention Dilution

When an LLM is passed a very large context (such as a massive git diff containing multi-file modifications), its **attention density** is diluted. The model struggles with context retrieval, failing to notice subtle architectural, concurrency, or security-grade violations. It only flags the most obvious issues.

However, once those obvious fixes are applied, the next run passes a much smaller, cleaner diff. With the clutter removed, the model's attention is no longer overloaded. It suddenly notices and flags the subtle violations it previously missed—generating a new unapproved checklist, forcing a new remediation round, and trapping the developer in an endless **"loop-flapping"** cycle.

### The Specialized Parallel Auditor Solution

To permanently break this loop-flapping behavior, the review phase must be broken down into **multiple, highly-focused, parallel specialized auditors** (e.g. Local Reviewer, Structural Reviewer, Concurrency Auditor, and Security Auditor):

```text
                        [Orchestrator Pipeline]
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
    [Local Reviewer]     [Concurrency Auditor]    [Security Auditor]
(Syntax, Variables, loops)   (Async, Blocking IO) (Path Traversal, Keys)
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  ▼
                        [Finding Aggregator]
                       (Deduplicates & Triages)
                                  ▼
                        [Action Item Analyzer]
                        (Generates Checklist)
```

1. **Maximum Attention Density**: Each specialized agent is given a microscopic prompt and asked to look for exactly one narrow category of violation. It cannot be distracted by other issues.
2. **100% Completeness on Pass 1**: Because the work is distributed across multiple focused minds, they will catch _every_ issue (including synchronous I/O, path traversal, or spacing) on the **very first pass**, producing a complete, exhaustive checklist.
3. **Low Latency & Cost**: Since the specialized reviewers run concurrently in parallel sandboxes during the Map Phase, they add zero latency. By utilizing least-powerful model tier assignments (e.g. `gemini-2.5-flash-lite` for localized audits), the total token cost is lower than running a single, expensive Pro model.
