#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}"

run_terraform() {
  echo "==> Linting Terraform files..."
  terraform fmt -check -recursive
  tflint --recursive
}

run_actionlint() {
  echo "==> Linting GitHub workflows..."
  actionlint
}

run_shellcheck() {
  echo "==> Running shellcheck..."
  local files
  files=$(grep -Rl -e '^#!' . \
    | grep -v -E "^\./(\.git|\.terraform|\.agent|bin)/" \
    | grep -v -E "\.md$" || true)

  if [[ -z "${files}" ]]; then
    echo "No shell scripts found to check."
    return 0
  fi

  while read -r file; do
    if [[ -f "${file}" ]]; then
      echo "Checking ${file}..."
      shellcheck -x "${file}"
    fi
  done <<< "${files}"
}

run_tests_lint() {
  echo "==> Linting Go test files..."
  cd test
  if ! golangci-lint run; then
    echo "Error: golangci-lint failed on tests..." >&2
    exit 1
  fi
  if [[ -n "$(gofmt -l -s -d .)" ]]; then
    echo "Error: Go test files need formatting..." >&2
    exit 1
  fi
  cd ..
}

run_gitleaks() {
  echo "==> Scanning for secrets with gitleaks..."
  gitleaks detect --no-banner -v --no-git
  gitleaks detect --no-banner -v
}

case "${MODE}" in
  terraform)
    run_terraform
    ;;
  actionlint)
    run_actionlint
    ;;
  shellcheck)
    run_shellcheck
    ;;
  tests)
    run_tests_lint
    ;;
  gitleaks)
    run_gitleaks
    ;;
  all)
    run_terraform
    run_actionlint
    run_shellcheck
    run_tests_lint
    run_gitleaks
    ;;
  *)
    echo "Error: Unknown lint mode: ${MODE}" >&2
    echo "Usage: $0 [terraform|actionlint|shellcheck|tests|gitleaks|all]" >&2
    exit 1
    ;;
esac
