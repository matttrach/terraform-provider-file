# Sub-Agent Prompting Specifications

## Abstract

This reference document defines the standard template, configurations, and strict handoff contracts required to create and integrate specialized subagents within the agentic framework.

---

## 1. The Token-Efficient Sub-Agent Template

To prevent context bloat and minimize API token consumption, all subagent configuration files (markdown files located in `.gemini/agents/`) MUST bypass generic conversational guidelines entirely. Instead, they must strictly act as micro-scoped, schema-contracted data-transformation pipes following this unified template:

```markdown
---
name: [unique_agent_identifier]
description: "[Concise description of the agent's role used by the coordinator]"
kind: local
tools: [explicitly scoped, read-only by default, e.g. ["read_file"]]
model: [least powerful model necessary, e.g. "gemini-2.5-flash-lite"]
temperature: 0.1
max_turns: [tightly bounded, e.g. 2]
---

## AGENT: [Agent Display Name]

## EVALUATION SCOPE

[Explicitly define the exact boundary of the agent's world, strictly prohibiting any investigation or commentary on adjacent files, patterns, or scopes.]

## SYSTEM INPUT CONTRACT

[Define the exact structure and payload format that this agent is designed to consume, e.g. "A raw JSON array" or "A single sandboxed file copy."]

## EVALUATION CRITERIA

- **[Dimension A]**: [Explicit, token-optimized bullet points defining what to search for]
- **[Dimension B]**: [Explicit, token-optimized bullet points defining what to search for]

## HANDOFF SCHEMA

[Mandate a rigid, machine-parseable data block (using Markdown code blocks marked with JSON, XML, or exact formatting layouts) at the very end of the prompt. Explicitly forbid conversational preambles, introductory filler, or trailing commentary.]
```

---

## 2. Standardized Handoff Schemas

### A. Compact JSON Array Schema (Reviewer-Grade)

For fine-grained code auditors, results must be formatted as a single JSON array wrapped inside a markdown code block. This allows the parent process to validate the structure programmatically before passing it to subsequent aggregation layers:

````markdown
```json
[
  {
    "file": "string (relative path)",
    "line": integer,
    "issue_type": "EXPLICIT_ENUM_VAL_A|EXPLICIT_ENUM_VAL_B",
    "evidence": "Exact string snippet of offending code",
    "raw_rationale": "Concise technical explanation of the violation"
  }
]
```
````

### B. Standardized Code Vulnerability and Defect (CVD) Ledger (Aggregator-Grade)

For aggregator and severity-analyzer agents, fragmented inputs must be compiled into a security-grade defect ledger:

```markdown
### ID: CVD-[Year]-[Sequential Number]

- **Title**: Short, punchy defect summary.
- **Severity**: CRITICAL | HIGH | MEDIUM | LOW
- **Origin Agents**: [Local / Global / Concurrency / Security / Multiple]
- **Impacted Topology**: List of affected modules, files, or specific line indicators.
- **Technical Vector**: Verbatim distillation of the fundamental underlying flaw.
```

### C. Actionable Remediation Plan (PM-Grade / Task Creator)

For task-creation agents, high-level ledger findings must be translated into file-grouped, narrative checklists following the **File Duplication Compliance Rule**:

````markdown
## ACTIONABLE REMEDIATION PLAN

## FILE: [Relative Path to File A]

- [ ] Task [CVD-ID]: [Action verb instruction indicating what to change, locate, or refactor in this specific file].

## FILE: [Relative Path to File B]

- [ ] Task [CVD-ID]: [Action verb instruction showing duplicated widespread problem detail specifically tailored to this file context].

```

```
````

---

## 3. Strict Operational Rules & Boundaries

1. **Least Powerful Model Rule**: Always configure the subagent with the absolute lowest-power model capable of resolving its specific evaluation criteria (e.g., `gemini-2.5-flash-lite` for localized, line-by-line syntax checks, and `gemini-2.5-flash` for structural, cross-module relationship mapping).
2. **No Solutions Rule**: Task-creator agents are strictly forbidden from inventing code fixes, outputting code blocks, or proposing raw code modifications. They must only index explicit narrative work instructions.
3. **File Duplication Rule**: Shorthand summaries like "repeat for other files" or "same as above" are strictly banned. If a defect is widespread across multiple files, the task-creator MUST duplicate the problem checklist record explicitly under every single relevant file heading to enable isolated, parallel execution by downstream sandboxed agents.
4. **No Conversational Noise**: Subagents must never output preambles, introductory filler ("Okay, I will look at..."), or polite sign-offs. Their entire outputs must reside strictly within the requested handoff schemas.
