#!/usr/bin/env bash
set -euo pipefail

# https://github.com/gotestyourself/gotestsum/releases
go install gotest.tools/gotestsum@c4a0df2e75a225d979a444342dd3db752b53619f # v1.13.0
make test
