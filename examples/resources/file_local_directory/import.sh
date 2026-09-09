#!/usr/bin/env bash
# IDENTIFIER="$(echo -n "path/to/file" sha256sum | awk '{print $1}')"
terraform import file_local_directory.example "IDENTIFIER"

# after this is run you will need to refine the resource further by setting the path and created properties.
