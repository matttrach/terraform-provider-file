#!/usr/bin/env bash
#
# Skill: commit-push.sh
# Description: Programmatically commit and push local changes with GPG/SSH signature, sign-off, and fork synchronization.
# Conforms to shell-scripts.instructions.md guidelines.

set -euo pipefail

# Helper to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Display script help usage instructions
show_help() {
  cat <<EOF
Usage: commit-push.sh [options] -m "COMMIT_MESSAGE"

Programmatically commit and push local changes with GPG/SSH signature, sign-off, and fork synchronization.

Options:
  -h, --help            Show this message and exit.
  -m MESSAGE            The conventional commit message (Required).
  --no-sync             Skip running git-sync.sh default branch synchronization.

Examples:
  .agent/skills/commit-push.sh -m "ci(workflows): add new automated checks"
  .agent/skills/commit-push.sh --no-sync -m "fix(hooks): correct branch check"
EOF
}

verify_environment() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Error: Must be run inside a Git repository." >&2
    exit 1
  fi
}

main() {
  local commit_msg=""
  local run_sync=true

  # Parse Help / Arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help)
        show_help
        exit 0
        ;;
      -m)
        if [[ -z "${2:-}" ]]; then
          echo "Error: -m option requires a non-empty commit message argument." >&2
          exit 1
        fi
        commit_msg="$2"
        shift 2
        ;;
      --no-sync)
        run_sync=false
        shift
        ;;
      *)
        echo "Error: Unknown argument '$1'" >&2
        show_help >&2
        exit 1
        ;;
    esac
  done

  if [[ -z "$commit_msg" ]]; then
    echo "Error: Commit message is required. Specify using -m \"message\"." >&2
    show_help >&2
    exit 1
  fi

  verify_environment

  local current_branch
  current_branch=$(git branch --show-current)
  if [[ -z "$current_branch" ]]; then
    echo "Error: Could not determine current branch name." >&2
    exit 1
  fi

  # 1. Staging Verification & File Staging Limits (Phase 5, Step 11)
  local staged_count
  staged_count=$(git diff --cached --name-only | wc -l | tr -d ' ')
  local max_allowed=5

  if [[ "$staged_count" -eq 0 ]]; then
    echo "Error: No changes are currently staged for commit." >&2
    echo "       Please stage your changes first using 'git add <files>...'." >&2
    exit 1
  fi

  if [[ "$staged_count" -gt "$max_allowed" ]]; then
    echo "Error: Committing too much code at once is prohibited ($staged_count files staged; max allowed is $max_allowed)." >&2
    echo "       In accordance with Phase 5, Step 11 of 'development-process.md', please split your commit into smaller, surgical layers." >&2
    exit 1
  fi

  # 2. Sync Default Branch with Upstream (Phase 5, Step 12)
  if [[ "$run_sync" == "true" ]]; then
    if [[ "$current_branch" != "main" ]]; then
      echo "Synchronizing local 'main' branch and tags with upstream parent repository..."
      # Temporarily stash unstaged/untracked files to allow git-sync.sh clean checks
      local stash_created=false
      if git status --porcelain | grep -v '^[A-Z]' >/dev/null; then
        echo "  -> Temporarily stashing unstaged/untracked files..."
        git stash push -u -m "temp-commit-push-stash" >/dev/null
        stash_created=true
      fi

      # Run sync skill
      if ! bash .agent/skills/git-sync.sh; then
        echo "Error: Upstream synchronization failed." >&2
        if [[ "$stash_created" == "true" ]]; then
          git stash pop >/dev/null
        fi
        exit 1
      fi

      # Restore stashed changes
      if [[ "$stash_created" == "true" ]]; then
        echo "  -> Restoring stashed unstaged/untracked files..."
        git stash pop >/dev/null
      fi
    fi
  fi

  # 3. Pull from Fork Remote to prevent Web UI divergence
  echo "Pulling latest changes from fork remote 'origin/$current_branch'..."
  if ! git pull origin "$current_branch" --ff-only 2>/dev/null; then
    echo "  -> Note: Local branch is out of sync or remote branch doesn't exist. Merging ff-only failed, fetching..."
    git fetch origin "$current_branch" 2>/dev/null || true
  fi

  # 4. GPG/SSH Signed and Signed-off Commit
  echo "Committing $staged_count staged file(s) with signature (-S) and sign-off (-s)..."
  if ! BYPASS_COMMIT_HOOK=1 git commit -s -S -m "$commit_msg"; then
    echo "Error: Git commit failed. Ensure GPG/SSH signing is configured." >&2
    exit 1
  fi

  # 5. Secure Push to Fork Remote
  echo "Pushing signed commit securely to fork remote 'origin/$current_branch'..."
  if ! BYPASS_COMMIT_HOOK=1 git push origin "$current_branch"; then
    echo "Error: Git push failed." >&2
    exit 1
  fi

  echo "✅ Changes programmatically committed and pushed successfully!"
}

main "$@"
