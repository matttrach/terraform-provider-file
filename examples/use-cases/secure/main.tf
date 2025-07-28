# Copyright (c) HashiCorp, Inc.


resource "file_local" "secure" {
  name     = "secure_example.txt"
  contents = "An example implementation of a secure file."
}
