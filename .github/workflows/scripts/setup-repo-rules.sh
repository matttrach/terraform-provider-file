#!/usr/bin/env bash
#
# Helper: setup-repo-rules.sh
# Description: Configures repository settings to allow automerge and establishes branch protection rules.
# Conforms to shell-scripts.instructions.md guidelines.

set -euo pipefail

REPO="${1:-}"
BRANCH="${2:-main}"

if [[ -z "${REPO}" ]]; then
  if command -v gh >/dev/null 2>&1; then
    REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
  fi
fi

if [[ -z "${REPO}" ]]; then
  echo "Error: Repository name is required (e.g. rancher/terraform-provider-file)." >&2
  echo "Usage: $0 [owner/repo] [branch]" >&2
  exit 1
fi

echo "==> Configuring repository settings for ${REPO}..."
gh repo edit "${REPO}" \
  --enable-auto-merge \
  --enable-squash-merge \
  --delete-branch-on-merge

echo "==> Configuring branch protection rules for branch '${BRANCH}' in ${REPO}..."
gh api --method PUT "/repos/${REPO}/branches/${BRANCH}/protection" \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Unit Tests",
      "Lint Workflows",
      "Validate Action SHAs"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

echo "🟢 Success: Repository rules and automerge configured successfully for ${REPO}."
