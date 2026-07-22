terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.11"
    }
    http = {
      source  = "hashicorp/http"
      version = ">= 3.4"
    }
    acme = {
      source  = "vancluever/acme"
      version = ">= 2.0"
    }
    file = {
      source  = "rancher/file"
      version = ">= 2.2"
    }
  }
}
