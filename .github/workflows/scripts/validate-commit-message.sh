#!/usr/bin/env bash
set -euo pipefail

# Check commit messages
# This steps enforces https://www.conventionalcommits.org/en/v1.0.0/
# This format enables automatic generation of changelogs and versioning

filter() {
  local commit="$1"
  echo "${commit}" | grep -v -e '^fix: ' -e '^feature: ' -e '^feat: ' -e '^refactor!: ' -e '^feature!: ' -e '^feat!: ' -e '^chore(main): ' -e '^Merge ' || true
}

prefix_check() {
  local message="$1"
  if [[ -n "$(filter "${message}")" ]]; then
    cat <<EOF >&2
...Commit message does not start with the required prefix.
Please use one of the following prefixes: "fix:", "feature:", "feat:", "refactor!:", "feature!:", or "feat!:".
This enables release-please to automatically format release notes based on the commit message.
$message
EOF
    exit 1
  else
    echo "...Commit message starts with the required prefix."
  fi
}

empty_check() {
  local message="$1"
  if [[ -z "${message}" ]]; then
    echo "Error: Empty commit message." >&2
    exit 1
  else
    echo "...Commit message is not empty."
  fi
}

length_check() {
  local message="$1"
  local length
  length=$(wc -m <<<"${message}")
  # Strip whitespaces if any from wc output
  length=$(echo "${length}" | tr -d '[:space:]')
  if [[ "${length}" -gt 100 ]]; then
    echo "Error: Commit message subject line should be less than 100 characters, found ${length}." >&2
    exit 1
  else
    echo "...Commit message subject line is less than 100 characters."
  fi
}

spell_check() {
  local message="$1"
  if grep -q -e '^Merge ' <<<"${message}"; then
    return 0
  fi
  local words
  words=$(cspell stdin --quiet --words-only <<<"${message}" || true)
  if [[ -n "${words}" ]]; then
    cat <<EOF >&2
...Commit message contains spelling errors on: ^${words}\$
...Also try updating the PR title.
...If this is a mistake, add your word to the custom_words.txt file.
EOF
    exit 1
  else
    echo "...Commit message does not contain spelling errors."
  fi
}

# Fetch the commit messages
if [[ -z "${PR_NUMBER:-}" ]]; then
  echo "Error: PR_NUMBER is not set." >&2
  exit 1
fi

COMMIT_MESSAGES=$(gh pr view "${PR_NUMBER}" --json commits | jq -r '.commits[].messageHeadline')
echo "Commit messages found: "
echo "${COMMIT_MESSAGES}"

while read -r message; do
  if [[ -z "${message}" ]]; then
    continue
  fi
  echo "checking message ^${message}\$"
  empty_check "${message}"
  prefix_check "${message}"
  length_check "${message}"
  spell_check "${message}"
  echo "message ^${message}\$ passed all checks"
done <<< "${COMMIT_MESSAGES}"
