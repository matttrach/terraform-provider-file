variable "identifier" {
  type        = string
  description = "A unique identifier prefix for all AWS resources created."
}

variable "public_key" {
  type        = string
  description = "The public key content corresponding to the private key used for SSH access."
}

variable "private_key_path" {
  type        = string
  description = "The path to the local SSH private key file on your machine to authenticate with the EC2 instance."
}
