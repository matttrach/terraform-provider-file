# Copyright (c) HashiCorp, Inc.

provider "file" {}

resource "file_local" "basic" {
  name     = "basic_example.txt"
  contents = "An example of the most basic implementation writing a local file."
}
