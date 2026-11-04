# Programmatic Orchestrator & Development Scripts

## Abstract

This directory contains our developer-agent orchestration pipeline and standard automation utilities. Our workflow is proactively controlled by the central **Orchestrator** (`agent-scripts/orchestrator.js`), which enforces the Plan -> Implement -> QA -> Commit lifecycle programmatically using the `@google/gemini-cli-sdk` SDK.

---

## The Simplified 4-Phase Developer Loop

Instead of reactive, fragile hook interceptions, our development lifecycle is steered programmatically by `orchestrator.js`:

1. **Phase 1: Planning (Read-Only)**: The orchestrator restricts the model to read-only actions and generates a plan. The orchestrator pauses and requests explicit developer approval via terminal `readline` before any edits are allowed.
2. **Phase 2: Implementation (Write Access)**: Once approved, the orchestrator initiates the implementation session, enabling the agent to surgically edit code and run local tests.
3. **Phase 3: Automated QA Review Loop**: The orchestrator executes the multi-agent Ralph Review Loop across all workflows. A thinking reviewer evaluates staged code and active plan constraints, a counting model tallies issue severity, and an inner implementation loop surgically resolves critical and medium findings while enforcing test and linter validation backpressure until clean convergence.
4. **Phase 4: Final User Review & Commit**: The orchestrator shows the unified git diff to the developer in the terminal, asks for confirmation, and creates a signed commit.

---

## 1. Core Orchestrator (`agent-scripts/orchestrator.js`)

The central execution engine using the official `@google/gemini-cli-sdk` SDK. It coordinates all tool invocations (such as file reads/writes, globbing, running commands, and asking for user feedback) and drives the four development phases sequentially.

---

## 2. Higher-Level Scripts (`agent-scripts/`)

These higher-level automation scripts execute sequences of tools to accomplish complex repository pipeline tasks:

- **`cleanup-data.js`**: Dynamically detects the active session ID via `logs.json` and purges older, stale temporary directories securely.
- **`run-in-nix.sh`**: Environment bootstrapper to securely run Javascript/Shell tasks in a hermetic, reproducible Nix environment.
- **`update-action-versions.sh`**: Scans and upgrades outdated third-party GitHub Action dependencies within workflows.
- **`update-modules.sh`**: Scans and upgrades Go dependency modules to keep the provider dependencies up-to-date.

---
