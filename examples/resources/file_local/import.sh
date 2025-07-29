# Copyright (c) HashiCorp, Inc.

# echo "Test data" > data.txt
# FILEPATH="./data.txt"
# SECRET="super-secret-key"
# IDENTIFIER="$(openssl dgst -sha256 -hmac "$SECRET" "$FILE" | awk '{print $2}')"

terraform import file_local "IDENTIFIER"
