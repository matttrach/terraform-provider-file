#!/usr/bin/env bash

# IDENTIFIER="$(echo -n "these contents are the default for testing" | base64 -w 0 | sha256sum | awk '{print $1}')"
terraform import file_snapshot.example "IDENTIFIER"

# after this is run you will need to refine the resource more by defining the contents and update_trigger
# admittedly, it doesn't make a lot of sense to import a snapshot since there isn't anything to reconcile
