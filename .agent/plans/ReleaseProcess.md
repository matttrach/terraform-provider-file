# Plan: Release Process

* **Executed Date:** 2026-08-05
* **Purpose:** Establish and enable the newly designed "Standard Repository Release Process: Architectural Blueprint & Tooling Specification" as our repository's standard. This involves documenting the standard in `RELEASING.md`, communicating it in `README.md`, and making the necessary codebase updates to convert our GHA and script logic to this new process.
* **Goals & Code Snippets:**

---

# Standard Repository Release Process: Architectural Blueprint & Tooling Specification

## **1. Actor-vs-Automation Interaction Swimlanes**

This swimlane diagram traces the detailed event triggers and data flow between development roles and automated GHA runners:

```
|                [ Actor ]                    |                  [ Automation (GHA / Nix / Vault) ]            |
├─────────────────────────────────────────────┼────────────────────────────────────────────────────────────────┤
|                                             |                                                                |
| === PART 1: PULL REQUEST TO SQUASH-MERGE ===|                                                                |
|                                             |                                                                |
|  1. PR Opened or Code Updated ------------> | ──► Trigger: pull_request (opened / synchronize)               |
|     (Contributor submits change)            |    ├─► Native Copilot Review triggers automatically            |
|                                             |    └─► Nix: Runs static tests, linting, and unit-checks        |
|                                             |         │                                                      |
|                                             |         ▼ (Checks Completed successfully)                      |
|                                             |       Trigger: workflow_run (completed)                        |
|                                             |       ──► Coordinator executes (Dry-Run Mode)                  |
|                                             |           - Scans approval state                               |
|                                             |           - Finds: No trusted reviews or approvals yet         |
|                                             |           - Action: Posts comment: "PR Needs Collaborator Review"|
|                                             |                                                                |
|  2. Collaborator Reviews PR & Comments ---->| ──► Trigger: pull_request_review (submitted)                   |
|     (Collaborator leaves feedback/questions)|       ──► Coordinator executes (Merge Mode)                    |
|                                             |           - Finds: No approvals, unresolved comment threads    |
|                                             |           - Action: Posts status comment: "Unresolved Comments"|
|                                             |                                                                |
|  3. Contributor Resolves Comments           |                                                                |
|     (Option A: Fixes code & pushes commit)  |                                                                |
|     └─► Pushes Commit ────────────────────> | ──► Re-runs Step 1 (Nix Unit Tests -> Dry-Run check)           |
|                                             |                                                                |
|     (Option B: Resolves via browser)        |                                                                |
|     └─► Resolves conversation on GitHub     |      [ No GHA trigger fired for "clicking resolve" ]           |
|                                             |                                                                |
|     (Option C: "Pokes" via comment)         |                                                                |
|     └─► Types top-level or thread comment -> | ──► Trigger: issue_comment / pull_request_review_comment       |
|         (e.g., "resolved", "ready")         |       ──► Coordinator executes (Merge Mode)                    |
|                                             |           - GraphQL: Queries all review threads                |
|                                             |           - Finds: All threads are marked resolved             |
|                                             |           - Action: Updates status comment, waits for Approval │
|                                             |                                                                |
|  4. Collaborator Submits Final Approval ──> | ──► Trigger: pull_request_review (submitted)                   |
|     (Trusted Collaborator clicks "Approve") |       ──► Coordinator executes (Merge Mode)                    |
|                                             |           - GQL Check: Confirms 100% of comment threads resolved│
|                                             |           - Review Check: Validates ≥ 1 Collaborator Approval  |
|                                             |           - Action: Fires Proxy Approval (vouching for review) │
|                                             |           - Action: Fires SemVer Guard (scopes file boundary)  |
|                                             |           - Action: Sanitizes commit message (product-safe)    |
|                                             |           - Action: Executes NATIVE AUTO-MERGE into 'main'     |
|                                             |           - Action: Automatically deletes status comments      |
|                                             |                                                                |
| === PART 2: SQUASH-MERGE TO PRODUCTION RELEASE =================─────────────────────────────────────────────┤
|                                             |                                                                |
|  5. Squash Merge Lands on main ───────────> | ──► Trigger: push to main                                      |
|                                             |       ──► Release Please Action runs:                          |
|                                             |           - Scans Conventional Commit squash titles            |
|                                             |           - Calculates next version increment                  |
|                                             |           - Action: Updates/creates draft "Release PR"         |
|                                             |             (e.g., "chore: release v1.2.3")                    |
|                                             |                                                                |
|                                             | ──► Trigger: pull_request (targeting Release Please branch)    |
|                                             |       ──► Release PR CI runs:                                  |
|                                             |           - Nix: Runs Unit Tests                               |
|                                             |           - AWS: Assumes OIDC IAM Role                         |
|                                             |           - Nix: Executes FULL ACCEPTANCE TEST SUITE           |
|                                             |                  (acc-relay: Real AWS resource deployment)      |
|                                             |         │                                                      |
|                                             |         ▼ (Heavy Integration Tests Pass)                       |
|                                             |       ──► Release Candidate (RC) Step:                         |
|                                             |           - Calculates next RC tag (e.g., v1.2.3-rc.0) via API |
|                                             |           - Vault: Securely extracts GPG keys                  |
|                                             |           - Nix: GoReleaser compiles & signs RC binaries       |
|                                             |           - Action: Publishes GPG-Signed RC Release            |
|                                             |                                                                |
|  6. Maintainer Merges Release PR ─────────> | ──► Trigger: push to main (Release PR merged)                  |
|     (Maintainer approves/merges Release PR) |       ──► Release Please Action runs:                          |
|                                             |           - Detects Release PR merge                           |
|                                             |           - Action: Outputs: release_created = true            |
|                                             |         │                                                      |
|                                             |         ▼                                                      |
|                                             |       ──► Full Release Step:                                   |
|                                             |           - Action: Automatically tags version (v1.2.3)        |
|                                             |           - Vault: Securely extracts GPG credentials           |
|                                             |           - Keyring Workaround: Dynamically parses primary ID  |
|                                             |           - Nix: GoReleaser cross-compiles stable binaries     |
|                                             |           - Action: Publishes Final GPG-Signed Release         |
|                                             |                                                                |
```

---

## **2. Core Automation & Security Tooling Specifications**

To enforce a zero-trust, reproducible release pipeline, the repository utilizes four foundational tools: **Nix**, **The CI-Image**, **Release Please**, and **GoReleaser**.

### **A. Nix: Zero-Trust Hermetic Reproducibility**
* **Purpose:** Nix acts as a declarative package manager that defines the **exact build and test environment** down to the cryptographic hash. It locks the compiler, linter, runtime, and CLI utilities (Go, Node.js, Terraform, actionlint, etc.) in `flake.nix`.
* **Security & Automation Contribution:**
  - **Eliminates Environment Drift:** Standardizes the toolchain so that a developer running a test locally uses the *exact same binary byte-code* as the CI runner, eliminating "works on my machine" failures.
  - **Zero-Dependency Host Runners:** The GitHub Actions runner does not need pre-installed tools. Nix fetches and isolates everything inside a sandbox, securing the pipeline against malicious or outdated runner environments.

### **B. The CI-Image: Pre-Built Dependency Caching**
* **Purpose:** A pre-built Docker image (`ghcr.io/rancher/ci-image/nix`) containing a base Nix environment and pre-cached tool dependencies.
* **Security & Automation Contribution:**
  - **Time Optimization:** Bootstrapping Nix and compiling developer tools on every GHA workflow run can take several minutes. The pre-built CI image slashes initialization overhead to under **15 seconds**.
  - **Immutable Runtime Environment:** By freezing the CI-Image version (e.g. `nix:20260603-18`), the project secures its pipeline against supply-chain updates and runtime image modifications.

### **C. Release Please: Declarative Versioning & Changelog Automation**
* **Purpose:** An automated release management engine that parses Conventional Commits (`feat:`, `fix:`, `chore:`) to calculate Semantic Versioning (SemVer) jumps.
* **Security & Automation Contribution:**
  - **Manual Versioning Eradication:** Completely automates version calculations and generates high-fidelity changelogs.
  - **The Release PR Pattern:** Instead of tagging immediately on merge, it maintains a long-lived "Release PR" that acts as a staging queue. This allows the team to inspect version jumps and provides a physical gateway where final integration tests are executed.

### **D. GoReleaser: Automated Compiling, Packaging & GPG Signing**
* **Purpose:** A release automation engine designed to build, package, sign, and publish compiled binaries (such as Terraform providers) for multiple CPU architectures and Operating Systems.
* **Security & Automation Contribution:**
  - **Cryptographic Signing (GPG):** GoReleaser integrates with local GPG keys (securely pulled from Vault in memory) to cryptographically sign provider binaries and generate SHA256 checksums. This guarantees to the Terraform Registry that the binary has not been tampered with since compilation.
  - **Standardized Multi-Platform Matrixing:** Automatically cross-compiles for `linux`, `darwin`, and `windows` across `amd64` and `arm64` in a single, atomic step.
  
#### **🔧 Security Engineering Tip: GPG Key ID Extraction Workaround**
Static configuration of a GPG Key ID in secrets managers often leads to breaking releases. For example, if a key is rotated, or if Vault is accidentally configured with an encryption subkey ID rather than the primary signing key ID, GoReleaser will abort with a signing failure.

**The Workaround:** 
To handle this key-matching weirdness, the pipeline imports the raw secret key and then **dynamically inspects the GPG key-ring in real-time** to extract the true primary signing key ID (`sec`). It overrides any static `GPG_KEY_ID` configuration with the dynamically detected ID:
```bash
# 1. Strip whitespace/spaces from static GPG_KEY_ID config
export GPG_KEY_ID=$(echo -n "${GPG_KEY_ID}" | tr -d '[:space:]')

# 2. Import raw key block into local keyring
echo "${GPG_KEY}" | gpg --import --batch

# 3. Query the GPG keyring to extract the actual imported primary secret key ID (sec)
SEC_LINE=$(gpg --batch --list-secret-keys --keyid-format LONG | grep -E '^sec' | head -n1 || true)
if [[ -n "${SEC_LINE}" ]]; then
  # Parse out the key ID after the '/' separator
  DETECTED_KEY_ID=$(echo "${SEC_LINE}" | awk '{print $2}' | cut -d'/' -f2)
  if [[ -n "${DETECTED_KEY_ID}" ]]; then
    # Overwrite the static variable with the actual imported ID
    GPG_KEY_ID="${DETECTED_KEY_ID}"
  fi
fi
```
This guarantees that GPG signing never fails due to subkey mismatches, whitespace issues, or misconfigured key identifiers.

---

## **3. Standard Phase Specifications**

### **Phase 1: Zero-Trust Pull Request Checking (CHECK)**
* **PR Opened:** A contributor submits a Pull Request targeting `main`.
* **Checked:** The standard PR checkers run inside the hermetic **Nix** shell on GHA. This executes static code linters (`golangci-lint`, `actionlint`, `shellcheck`, `gitleaks`) and runs localized unit tests with zero-trust permissions.
* **Copilot Review:** Natively triggered repository integration initiates automated AI review comments.

---

### **Phase 2: Secure, Event-Driven Merge Coordination (COORD)**
* **Event Triggered:** Completion of the checks or reviews initiates the event coordinator. This executes on `workflow_run` in the secure default branch context (`main`), protecting secrets while enabling write-level access.
* **Validated Reviews/GQL:** The coordinator checks that the PR requirements are satisfied:
  * **Standard Pull Requests:** Requires **at least 1 approval** from a trusted role (Collaborator, Member, Owner, or Triage permission) and runs GraphQL queries to guarantee **100% of all review comments are marked resolved** (whether left by humans or AI).
  * **Dependabot Pull Requests:** Bypasses human reviewer constraints. Allows auto-merging with **at least 1 AI review approval/comment** (e.g. from Copilot) once all other functional check runs have completed successfully.
* **Proxy Approval:** If the requirements are met, but the PR lacks a Write-level approval (e.g., the approving reviewer has Triage-level access, or it is a Dependabot PR approved by AI), the GHA bot automatically submits an `APPROVE` review on the PR. Since the bot has Write access, its approval satisfies GitHub's branch protection requirements, serving as a proxy to allow the merge.

---

### **Phase 3: Automated SemVer Guard & Native Auto-Merge (MERGE)**
* **Scoped Boundary Check:** Evaluates modified files. If changes are exclusively non-product (e.g. docs, tests, CI files outside the core `internal/` directory), the SemVer Guard is activated.
* **Title Sanitized:** If SemVer Guard is active, conventional commit types like `feat` or `refactor` and breaking indicators (`!`) are dynamically stripped or downgraded to `chore` or `fix` to prevent unintentional Minor or Major version bumps.
* **Native Auto-Merge:** The PR is merged using GitHub's native Auto-Merge backend (`gh pr merge --auto --squash`) with custom, AI-sanitized commit messages. This cleanly bypasses the REST API GITHUB_TOKEN merge limitation for fork-authored PRs while respecting all branch protection settings.
* **Concurrency & Exploitation Protection:** If a contributor pushes a new commit *after* native auto-merge is enabled, GitHub's native system instantly pauses/cancels the auto-merge because previous approvals are automatically dismissed and new checks are triggered. The event coordinator (`pr-executor.yml`) must re-evaluate and re-verify the new commit SHA before auto-merge can be re-enabled.

---

### **Phase 3b: Direct Fork PR Auto-Merge (The Ruleset Bypass)**
* **Fork PR Evaluation:** When `pr-executor.yml` (running under `workflow_run`) evaluates a fork PR, it has full write/merge privileges on the base repository. If all requirements are met, it executes the native squash-merge using the GitHub CLI (`gh pr merge --auto --squash`).
* **The Recursion Bypass:** Normally, a GITHUB_TOKEN push (or merge) event prevents downstream workflows (such as Release Please) from triggering due to recursion prevention rules. However, the repository utilizes **GitHub Workflow Execution Protections (Rulesets)** to explicitly allow `github-actions[bot]` to trigger push-based workflows on `main`, ensuring downstream release pipelines run seamlessly.
* **🔧 Ruleset Configuration Prerequisites & Guardrails:**
  * **Location:** Repository settings -> *Actions > Policies*.
  * **Restrict Events:** Permit the **`push`** event to trigger actions (so the squash-merge commit on `main` initiates downstream release workflows). Keep other high-risk events (like `pull_request_target`) strictly restricted.
  * **Restrict Actors:** Add the system-level **`GitHub Actions` App** (representing the GITHUB_TOKEN) and your team's authorized roles (like `Write`, `Maintain`, `Admin` or the `k3s` group) as allowed actors to trigger the `push` event.
  * **Scope:** Ensure this ruleset is active on the repository (Actions Policies apply globally and do not use branch selectors).

---

### **Phase 4: Release Management & The Integration Test Gate (GATES)**
* **Release PR Maintained:** Merging into `main` triggers `Release Please`. It calculates the next version and automatically updates a draft "Release PR" containing updated version coordinates and changelogs.
* **Integration Tests Gate:** The Release PR acts as a staging queue where a dedicated CI workflow executes the **full integration and acceptance test suite** (using real cloud resources/relays). Merging is blocked until this suite passes.
* **Release PR Merged:** Merging this PR triggers the final release process.

---

### **Phase 5: Release Tagging & Cryptographic Signing (PUBLISH)**
* **Tagged vX.Y.Z:** `Release Please` registers the release merge and automatically creates and pushes the official semantic git tag.
* **Key Extracted:** The workflow imports the signing GPG block from Vault and dynamically queries the keyring to extract the actual primary secret key ID to work around subkey/mismatch weirdness.
* **Signed & Published:** GoReleaser compiles binaries inside the reproducibly locked Nix environment, signs them with the GPG key, and publishes the signed provider assets directly to the GitHub Release.

---

## Implementation Checklist

### Phase 3: Sequential Implementation (Act)
- [x] Create `RELEASING.md` in the root of the repository containing the co-designed release standard documentation.
- [x] Add a prominent section/link in `README.md` pointing to `RELEASING.md`.
- [x] Update `.github/workflows/review-trigger.yml` to trigger on comment events (`pull_request_review_comment` and `issue_comment` types: `created, edited, deleted`) to support the comment-based re-evaluation ("poke") mechanism.
- [x] Refactor `.github/workflows/scripts/verify-pr-requirements.js` to change the review threshold from requiring `2 humans OR 1 human + 1 AI` to **at least 1 human approval** (with trusted access), since AI review is natively triggered at the repository level now.
- [x] Refactor `.github/workflows/scripts/verify-pr-requirements.js` to fail the verification check run if the PR is in draft mode in non-auto-merge mode.
- [x] Rename `verify-pr-requirements.js` to `verify-pr-requirements.mjs` and update `pull_request.yaml` and `pr-executor.yml` references to ESM `.mjs` extension to resolve runner syntax error.
- [x] Resolve syntax error in `verify-pr-requirements.mjs` caused by hybrid code replacement.
- [x] Remove `triggerAIReviewIfNeeded` function and references from `verify-pr-requirements.mjs` since Copilot review is natively repository-triggered.

### Phase 4: Testing, Verification & Proactive Review (Quality Gate 1)
- [x] Run `actionlint` locally to verify that `.github/workflows/review-trigger.yml`, `pull_request.yaml` and `pr-executor.yml` syntax remains valid.
- [x] Run `node --check` to verify that `.github/workflows/scripts/verify-pr-requirements.mjs` syntax remains valid.
- [x] Verify that markdown formatting and hyperlinks are valid in both `RELEASING.md` and `README.md`.
- [x] Enter Proactive Review Mode on the written code diff to proactively resolve any issues human or Copilot automated reviews might flag.

### Phase 5: Chunking & Staging Isolation (Quality Gate 2)
- [x] Present the unstaged diff to the developer in the chat.
- [x] Solicit manual developer review and obtain explicit approval in the chat.

### Phase 6: Authorized Commit & PR Generation (Quality Gate 3)
- [x] Stage only the specific modified/created files (no `git add .` or `-A`).
- [x] Commit changes locally with a conventional prefix (e.g., `ci: implement standard release process and documentation`) and `APPROVED_BY_USER=1`.
- [x] Push the branch `feature/document-standard-release` to the user's origin fork.
- [x] Generate a Draft Pull Request targeting upstream `main` in draft mode (`--draft`) using the `create-pr.sh` skill.
- [x] Graduate the draft PR to ready-for-review using `create-pr.sh --ready`.

### Phase 7: Verification, Copilot Compliance & Iteration
- [x] Trigger/wait for GitHub Copilot automated review on the PR.
- [x] Address and resolve any findings by committing necessary refinements.
- [x] Resolve CI deadlock by ignoring self-status and event-trigger check runs (`Verify PR Requirements` and `Trigger Executor on Event`).
- [x] Enhance troubleshooting logging to display detailed information on processed/ignored check runs, all reviewers with their status, type, and author association.
- [x] Integrate collaborator permission checks via `getCollaboratorPermissionLevel` API to correctly identify team/group-based write or triage access with a graceful fallback.
- [x] Enhance logging to check and print collaborator permission level of ALL human reviewers (including inactive ones) to ease debugging.
- [x] Configure `verify-pr-requirements` in `pull_request.yaml` to depend on all other validation/test jobs (making it the last gate to execute).
- [x] Update `pull_request.yaml` to allow `dependabot[bot]` actor branch pushes in `Enforce Fork Contributions` check run.
- [x] Implement Dependabot PR auto-merge rule and proxy approval logic inside `verify-pr-requirements.mjs` (merges Dependabot PRs based on AI review approval).
- [x] Tighten `pull_request.yaml` to ensure only `dependabot[bot]` can push to `dependabot/` branches inside the same-repository.
- [x] Fix Nix-run syntax error in `verify-pr-requirements.mjs` by writing prompt to file instead of command line.
- [x] Remove redundant, false-failing `verify-pr-requirements` job from `pull_request.yaml` to improve developer UX and prevent premature check failures.
- [x] Implement robust GitHub CLI and native auto-merge pipeline (`gh pr merge --auto`) with direct merge and REST API fallbacks in `verify-pr-requirements.mjs`.
- [x] Verify updated code locally and obtain approval.

### Phase 8: Direct Fork PR Auto-Merge (Ruleset Enabled)
- [x] Refactor `.github/workflows/scripts/verify-pr-requirements.mjs` to completely remove the legacy `isFork` blocker, allowing fork PRs to be merged directly by the executor just like local and Dependabot PRs.
- [x] Run `node --check` to verify `.github/workflows/scripts/verify-pr-requirements.mjs` syntax.
- [x] Present the unstaged diff to the developer in the chat.
- [x] Solicit manual developer review and obtain explicit approval in the chat.
- [x] Stage the modified/created files and commit locally with a conventional prefix (e.g. `ci: enable automated fork PR merging via Ruleset bypass`) and `APPROVED_BY_USER=1`.
- [x] Push the branch to the user's origin fork and generate a Draft PR using `create-pr.sh`.

### Phase 9: Resolve Copilot PR Review Feedback
- [x] Refactor `verify-pr-requirements.mjs` to pass `isFork` to `mergePullRequest`.
- [x] Update `mergePullRequest` with a graceful merge-failure fallback: if the merge fails, apply/keep the `ready-to-merge` label and post a detailed diagnostic comment explaining how the maintainer can merge or fix the Ruleset.
- [x] Rephrase `ReleaseProcess.md` to add a clear, explicit checklist of the repository settings and ruleset prerequisite options needed to enable direct auto-merges of fork PRs.
- [x] Update `WorkflowExecutionProtections.md` to explicitly time-bound its product claims as of August 2026, and add prominent links to the authoritative GitHub documentation pages.
- [x] Compile and verify the refactored script with `node --check`.
- [x] Prevent throwing restError in the fork graceful fallback path to keep the PR status check green, enabling manual maintainer merge.
- [x] Fix the Verify Release Please Action step in `.github/workflows/release.yml` to gracefully allow skips (exit 0) when there are zero unreleased user-facing commits since the latest tag.

<!-- Retrigger workflows -->

