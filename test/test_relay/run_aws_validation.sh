#!/usr/bin/env bash
#
# run_aws_validation.sh
# Automates the remote AWS Test Relay validation for the Go 1.26 Scheduler Spinning Bug.
# It cross-compiles both the provider and test suite binaries for linux/amd64,
# and then runs our workstation-side Terratest suite to deploy the AWS instance,
# monitor remote CPU utilization over SSH, and automatically tear down AWS resources on completion.
#
# Assumptions:
# - You are currently inside the Nix shell (`nix develop`).
# - AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, etc.) are exported in your environment.

set -euo pipefail

# Ensure we run from the repository root directory
REPOS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../" && pwd)"
cd "$REPOS_ROOT"

# Helper for showing logs
log() {
  echo -e "\033[1;34m==>\033[0m $1"
}

# Add an EXIT trap to guarantee that all temporary keys and JSON files are deleted from your workstation on exit
cleanup() {
  log "Cleaning up temporary local validation files..."
  rm -f test/test_relay/id_rsa_temp_*
  rm -f test/test_relay/server_info.json
  rm -f test/test_relay/.terraformrc_remote
}
trap cleanup EXIT

# 1. Verify AWS environment variables
log "Verifying AWS credentials..."
if [ -z "${AWS_ACCESS_KEY_ID:-}" ] && [ -z "${AWS_PROFILE:-}" ]; then
  echo "Warning: Neither AWS_ACCESS_KEY_ID nor AWS_PROFILE is set in your environment."
  echo "Please ensure you have active AWS credentials exported before running this script."
  echo "Press Ctrl+C to abort, or any other key to continue..."
  read -r
fi

# 2. Cross-compile the provider binary natively on the host for linux/amd64.
log "Cross-compiling provider binary for linux/amd64 (CGO_ENABLED=0)..."
mkdir -p ./bin
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o ./bin/terraform-provider-file .

# 3. Cross-compile the test suite binary natively on the host for linux/amd64.
# (This is the binary that runs concurrently inside the remote AWS VM)
log "Cross-compiling remote test suite binary for linux/amd64 (CGO_ENABLED=0)..."
(cd test && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go test -c -o ./spinning.test ./local/spinning)

# 4. Execute the workstation-side Terratest to deploy, monitor, and destroy AWS resources
log "Launching TestAWSRelaySpinningConcurrency to deploy AWS Test Relay and monitor remote lockup..."
(cd test && go test -v ./local/spinning/... -run=TestAWSRelaySpinningConcurrency -timeout=600s)
