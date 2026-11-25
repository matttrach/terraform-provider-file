#!/usr/bin/env bash
set -euo pipefail

# parse-config.sh
# Reads .github/repo-config.yml and exports configuration variables & matrices to $GITHUB_OUTPUT.

CONFIG_FILE="${1:-.github/repo-config.yml}"
OUTPUT_TARGET="${GITHUB_OUTPUT:-/dev/stdout}"

if [ ! -f "${CONFIG_FILE}" ]; then
  echo "Warning: ${CONFIG_FILE} not found. Using defaults." >&2
  TMP_CONFIG=$(mktemp)
  cat <<'EOF' >"${TMP_CONFIG}"
version: "1.0"
features:
  automatic_changelog_and_release: false
  testing:
    unit: true
    integration: false
    e2e: false
  static_analysis:
    auto_detect: true
  pr_approval_proxy: false
  issue_management: false
  automatic_backporting: false
  automatic_rc_releases: false
testing:
  unit:
    matrix:
      - name: "unit-tests"
        command: "make test"
  integration:
    matrix:
      - name: "integration-tests"
        command: "true"
  e2e:
    matrix:
      - name: "e2e-tests"
        command: "true"
backport_branches: []
rc_release_branches:
  - "main"
EOF
  CONFIG_FILE="${TMP_CONFIG}"
fi

export_output() {
  local key="$1"
  local val="$2"
  echo "${key}=${val}" >>"${OUTPUT_TARGET}"
}

# Feature flags
CH_REL=$(yq eval '.features.automatic_changelog_and_release // false' "${CONFIG_FILE}")
export_output "feature_automatic_changelog_and_release" "${CH_REL}"

TEST_UNIT=$(yq eval '.features.testing.unit // false' "${CONFIG_FILE}")
export_output "feature_testing_unit" "${TEST_UNIT}"

TEST_INT=$(yq eval '.features.testing.integration // false' "${CONFIG_FILE}")
export_output "feature_testing_integration" "${TEST_INT}"

TEST_E2E=$(yq eval '.features.testing.e2e // false' "${CONFIG_FILE}")
export_output "feature_testing_e2e" "${TEST_E2E}"

STATIC_AUTO=$(yq eval '.features.static_analysis.auto_detect // true' "${CONFIG_FILE}")
export_output "feature_static_analysis_auto_detect" "${STATIC_AUTO}"

PR_PROXY=$(yq eval '.features.pr_approval_proxy // false' "${CONFIG_FILE}")
export_output "feature_pr_approval_proxy" "${PR_PROXY}"

ISSUE_MGMT=$(yq eval '.features.issue_management // false' "${CONFIG_FILE}")
export_output "feature_issue_management" "${ISSUE_MGMT}"

AUTO_BACKPORT=$(yq eval '.features.automatic_backporting // false' "${CONFIG_FILE}")
export_output "feature_automatic_backporting" "${AUTO_BACKPORT}"

AUTO_RC=$(yq eval '.features.automatic_rc_releases // false' "${CONFIG_FILE}")
export_output "feature_automatic_rc_releases" "${AUTO_RC}"

# Matrices
if [ "${TEST_UNIT}" = "true" ]; then
  UNIT_MAT=$(yq eval -o=json -I=0 '.testing.unit.matrix // [{"name": "unit-tests", "command": "make test"}] | map(.enabled = true)' "${CONFIG_FILE}")
else
  UNIT_MAT=$(yq eval -o=json -I=0 '.testing.unit.matrix // [{"name": "unit-tests", "command": "true"}] | map(.enabled = false)' "${CONFIG_FILE}")
fi
export_output "matrix_testing_unit" "${UNIT_MAT}"

if [ "${TEST_INT}" = "true" ]; then
  INT_MAT=$(yq eval -o=json -I=0 '.testing.integration.matrix // [{"name": "integration-tests", "command": "make test-integration"}] | map(.enabled = true)' "${CONFIG_FILE}")
else
  INT_MAT=$(yq eval -o=json -I=0 '.testing.integration.matrix // [{"name": "integration-tests", "command": "true"}] | map(.enabled = false)' "${CONFIG_FILE}")
fi
export_output "matrix_testing_integration" "${INT_MAT}"

if [ "${TEST_E2E}" = "true" ]; then
  E2E_MAT=$(yq eval -o=json -I=0 '.testing.e2e.matrix // [{"name": "acceptance-tests", "command": "make testacc"}] | map(.enabled = true)' "${CONFIG_FILE}")
else
  E2E_MAT=$(yq eval -o=json -I=0 '.testing.e2e.matrix // [{"name": "acceptance-tests", "command": "true"}] | map(.enabled = false)' "${CONFIG_FILE}")
fi
export_output "matrix_testing_e2e" "${E2E_MAT}"

# Branches
BACKPORT_BRANCHES=$(yq eval -o=json -I=0 '.backport_branches // []' "${CONFIG_FILE}")
export_output "backport_branches" "${BACKPORT_BRANCHES}"

RC_BRANCHES=$(yq eval -o=json -I=0 '.rc_release_branches // ["main"]' "${CONFIG_FILE}")
export_output "rc_release_branches" "${RC_BRANCHES}"

# Components
COMPONENTS=$(yq eval -o=json -I=0 '.components // []' "${CONFIG_FILE}")
export_output "components_config" "${COMPONENTS}"

echo "Configuration parsed successfully." >&2
