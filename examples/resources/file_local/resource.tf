# Copyright (c) HashiCorp, Inc.

resource "file_local" "example" {
  name     = "example.txt"
  contents = "An example implementation writing a local file."
}
