#!/usr/bin/env bash
set -euo pipefail

gitleaks detect --no-banner -v --no-git
gitleaks detect --no-banner -v
