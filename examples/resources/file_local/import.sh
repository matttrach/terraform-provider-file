#!/usr/bin/env bash

# echo "Test data" > data.txt
# FILEPATH="./data.txt"
# TF_FILE_HMAC_SECRET_KEY="super-secret-key"
# IDENTIFIER="$(openssl dgst -sha256 -hmac "$TF_FILE_HMAC_SECRET_KEY" "$FILE" | awk '{print $2}')"

terraform import file_local.example "IDENTIFIER"

# after this is run you will need to refine the resource further by setting the directory and name.
