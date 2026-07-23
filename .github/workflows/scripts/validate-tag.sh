#!/usr/bin/env bash
set -euo pipefail

if [[ "${EXPECTED_TYPE}" == "rc" ]]; then
  if [[ "${TAG}" == *rc* ]]; then
    echo "Tag contains 'rc', continuing with RC release"
  else
    echo "Error: Tag doesn't contain 'rc', please use the manual-release workflow" >&2
    exit 1
  fi
elif [[ "${EXPECTED_TYPE}" == "release" ]]; then
  if [[ "${TAG}" == *rc* ]]; then
    echo "Error: Tag contains 'rc', please use the manual-rc-release workflow" >&2
    exit 1
  else
    echo "Tag doesn't contain 'rc', continuing with full release"
  fi
else
  echo "Error: Unknown EXPECTED_TYPE: ${EXPECTED_TYPE}" >&2
  exit 1
fi
