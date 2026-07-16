#!/usr/bin/env bash
set -euo pipefail

git config user.name "${GITHUB_ACTOR}"
git config user.email "${GITHUB_ACTOR}@users.noreply.github.com"

MSG_PREFIX="Release"
if grep -q "rc" <<< "${TAG}"; then
  MSG_PREFIX="Release Candidate"
fi

if [ -n "${SHA:-}" ]; then
  git tag "${TAG}" -m "${MSG_PREFIX} ${TAG}" "${SHA}"
else
  git tag "${TAG}" -m "${MSG_PREFIX} ${TAG}"
fi
git push origin "${TAG}"
