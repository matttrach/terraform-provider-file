#!/usr/bin/env bash
# Wrapper script to exercise models in the correct environment

set -euo pipefail

show_help() {
  cat << EOF
Usage: exercise-cron.sh [options]

Wrapper script to exercise models in the correct environment for headless cron execution.

Options:
  -h, --help    Show this help message and exit
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help)
        show_help
        exit 0
        ;;
      *)
        echo "Error: Unknown argument: $1" >&2
        show_help
        exit 1
        ;;
    esac
    shift
  done
}

run_exercise() {
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
  local project_dir="${script_dir}/.."

  cd "${project_dir}"

  # Source environment variables for headless cron execution
  if [[ -f ".variables" ]]; then
    # shellcheck source=/dev/null
    source .variables
  fi

  # Execute via run-in-nix.sh
  ./agent-scripts/run-in-nix.sh ./agent-scripts/exercise-agents.js
}

main() {
  parse_args "$@"
  run_exercise
}

main "$@"
