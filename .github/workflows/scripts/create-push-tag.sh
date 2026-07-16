#!/usr/bin/env bash
set -euo pipefail

TAG=$VERSION
if [[ $TAG != v* ]]; then
  TAG="v$TAG"
fi
git config user.name "${GITHUB_ACTOR}"
git config user.email "${GITHUB_ACTOR}@users.noreply.github.com"

if ! git ls-remote --tags origin | grep -q "refs/tags/$TAG$"; then
  git tag "$TAG" -m "Release $TAG"
  git push origin "$TAG"
else
  echo "Tag $TAG already exists."
fi
