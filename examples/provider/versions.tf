# Copyright (c) HashiCorp, Inc.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    file = {
      source  = "matttrach/file"
      version = ">= 0.0.1"
    }
  }
}
