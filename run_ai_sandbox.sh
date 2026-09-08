#!/usr/bin/env bash

set -euo pipefail

readonly CONTAINER_IMAGE="ghcr.io/rancher/ci-image/nix:20260603-18"

show_help() {
  cat <<EOF
Usage: $(basename "${0}") [OPTIONS]

Runs an interactive environment for safely using AI while developing.
This contains the agent, keeping it from accessing your entire workstation
while still giving it all of the tools and dependencies that it needs to
work and run tests. It will automatically source .variables.

Options:
  -h, --help    Show this help message and exit.
  --root        Enter the container as the 'root' user.
  --suse        Enter the container as the 'suse' user (default).
  --gemini      Start the 'gemini' agent inside the container (default).
  --claude      Start the 'claude' agent inside the container.
EOF
}

generate_temp_aws_credentials() {
  echo "Generating 10-hour temporary AWS credentials..."
  local sts_output

  if ! command -v aws >/dev/null 2>&1; then
    echo "Warning: 'aws' CLI is not installed. Skipping AWS credential generation." >&2
    return 0
  fi

  if ! command -v jq >/dev/null 2>&1; then
    echo "Warning: 'jq' utility is not installed. Skipping AWS credential generation." >&2
    return 0
  fi

  if ! sts_output=$(aws sts get-session-token --duration-seconds 36000 --output json 2>/dev/null); then
    echo "Warning: Failed to generate temporary AWS credentials. Proceeding without them." >&2
    return 0
  fi

  AWS_ACCESS_KEY_ID=$(echo "${sts_output}" | jq -r '.Credentials.AccessKeyId')
  AWS_SECRET_ACCESS_KEY=$(echo "${sts_output}" | jq -r '.Credentials.SecretAccessKey')
  AWS_SESSION_TOKEN=$(echo "${sts_output}" | jq -r '.Credentials.SessionToken')
}

run_container() {
  local run_user="${1}"
  local agent_command="${2}"
  local cwd_name
  cwd_name=$(basename "${PWD}")

  # Ensure directories exist locally so Docker doesn't create them as root
  mkdir -p "${PWD}/.gemini/hooks" "${PWD}/.claude/hooks" "${PWD}/agent-scripts/tests"

  # Enforce zero-trust by hiding security infrastructure from native AI tools
  for ignore_file in .aiexclude .claudeignore; do
    if [[ -f "${ignore_file}" ]]; then
      chmod +w "${ignore_file}" 2>/dev/null || true
    fi
    touch "${ignore_file}"
    for rule in ".gemini/hooks/" ".claude/hooks/" "agent-scripts/*" "!agent-scripts/tests/"; do
      if ! grep -qxF "${rule}" "${ignore_file}"; then
        echo "${rule}" >>"${ignore_file}"
      fi
    done
    chmod 0400 "${ignore_file}" 2>/dev/null || true
  done

  local -a docker_args=(
    "-it" "--rm"
    "--user" "${run_user}"
    "-v" "${PWD}:/home/suse/${cwd_name}"

    # Hardened read-only volume overlays to prevent tamper/bypass
    "-v" "${PWD}/.aiexclude:/home/suse/${cwd_name}/.aiexclude:ro"
    "-v" "${PWD}/.claudeignore:/home/suse/${cwd_name}/.claudeignore:ro"
    "-v" "${PWD}/.gemini/hooks:/home/suse/${cwd_name}/.gemini/hooks:ro"
    "-v" "${PWD}/.claude/hooks:/home/suse/${cwd_name}/.claude/hooks:ro"
    "-v" "${PWD}/agent-scripts:/home/suse/${cwd_name}/agent-scripts:ro"
    "-v" "${PWD}/agent-scripts/tests:/home/suse/${cwd_name}/agent-scripts/tests:rw"

    "--workdir" "/home/suse/${cwd_name}"

    # Persistent Docker volume for SSH configuration (like known_hosts)
    "-v" "ai_sandbox_ssh:/home/suse/.ssh"

    # Persistent Docker volumes for Nix store and user cache to avoid rebuilding binaries
    "-v" "ai_sandbox_nix:/nix"
    "-v" "ai_sandbox_cache:/home/suse/.cache"
  )

  # Inherits git settings
  if [[ -f "${HOME}/.gitconfig" ]]; then
    docker_args+=("-v" "${HOME}/.gitconfig:/tmp/host_gitconfig:ro")
  fi

  # Inherits ssh-agent
  if [[ -n "${SSH_AUTH_SOCK:-}" ]]; then
    if [[ "${OSTYPE}" == "darwin"* ]]; then
      # Docker Desktop and Colima on Mac require this specific path for SSH agent forwarding
      docker_args+=("-v" "/run/host-services/ssh-auth.sock:/run/host-services/ssh-auth.sock")
      docker_args+=("-e" "SSH_AUTH_SOCK=/run/host-services/ssh-auth.sock")
    else
      docker_args+=("-v" "${SSH_AUTH_SOCK}:/tmp/ssh_auth.sock" "-e" "SSH_AUTH_SOCK=/tmp/ssh_auth.sock")
    fi
  fi

  # Inherits github authentication
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    docker_args+=("-e" "GITHUB_TOKEN=${GITHUB_TOKEN}")
  fi

  local host_gh_token=""
  if command -v gh >/dev/null 2>&1; then
    host_gh_token=$(gh auth token 2>/dev/null || true)
  fi

  if [[ -n "${host_gh_token}" ]]; then
    docker_args+=("-e" "HOST_GH_TOKEN=${host_gh_token}")
  fi
  if [[ -d "${HOME}/.config/gh" ]]; then
    docker_args+=("-v" "${HOME}/.config/gh:/home/suse/.config/gh:ro")
  fi

  # Inherits temp AWS credentials
  if [[ -n "${AWS_ACCESS_KEY_ID:-}" ]]; then
    docker_args+=("-e" "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}")
    docker_args+=("-e" "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}")
    docker_args+=("-e" "AWS_SESSION_TOKEN=${AWS_SESSION_TOKEN}")
    docker_args+=("-e" "AWS_REGION=${AWS_REGION:-us-west-2}")
  fi

  # Inherit AI API keys explicitly instead of mounting configuration directories
  if [[ -n "${GEMINI_API_KEY:-}" ]]; then
    docker_args+=("-e" "GEMINI_API_KEY=${GEMINI_API_KEY}")
  fi
  if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    docker_args+=("-e" "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}")
  fi

  # Runs either the 'gemini' or 'claude' command (with .variables sourced and gh CLI authenticated)
  local nix_cmd="if [[ -n \"\${HOST_GH_TOKEN:-}\" ]]; then echo \"\${HOST_GH_TOKEN}\" | gh auth login --with-token 2>/dev/null; fi; exec ${agent_command}"
  local init_cmd="sudo chown -R \$(whoami) /home/suse/.ssh 2>/dev/null || true; mkdir -p /home/suse/.ssh; if ! grep -q github.com /home/suse/.ssh/known_hosts 2>/dev/null; then ssh-keyscan github.com >> /home/suse/.ssh/known_hosts 2>/dev/null; fi; [[ -f /tmp/host_gitconfig ]] && cp /tmp/host_gitconfig /home/suse/.gitconfig; source .variables"
  docker run "${docker_args[@]}" "${CONTAINER_IMAGE}" bash -c "${init_cmd} && exec ./.github/workflows/scripts/nix-run.sh bash -c '${nix_cmd}'"
}

main() {
  local container_user="suse"
  local agent_command="gemini"

  while [[ "${#}" -gt 0 ]]; do
    case "${1}" in
      -h | --help)
        show_help
        exit 0
        ;;
      --root)
        container_user="root"
        shift
        ;;
      --suse)
        container_user="suse"
        shift
        ;;
      --gemini)
        agent_command="gemini"
        shift
        ;;
      --claude)
        agent_command="claude"
        shift
        ;;
      *)
        echo "Unknown option: ${1}" >&2
        show_help >&2
        exit 1
        ;;
    esac
  done

  generate_temp_aws_credentials
  run_container "${container_user}" "${agent_command}"
}

main "${@}"
