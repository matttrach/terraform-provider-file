#!/usr/bin/env bash
set -euo pipefail

if [ "${EXPECTED_TYPE}" == "rc" ]; then
  if grep -q "rc" <<< "${TAG}"; then
    echo "Tag contains 'rc', continuing with RC release"
  else
    echo "Tag doesn't contain 'rc', please use the manual-release workflow"
    exit 1
  fi
elif [ "${EXPECTED_TYPE}" == "release" ]; then
  if grep -q "rc" <<< "${TAG}"; then
    echo "Tag contains 'rc', please use the manual-rc-release workflow"
    exit 1
  else
    echo "Tag doesn't contain 'rc', continuing with full release"
  fi
else
  echo "Unknown EXPECTED_TYPE: ${EXPECTED_TYPE}"
  exit 1
fi
