output "server_ip" {
  value       = module.runner.server.public_ip
  description = "The public IP address of the remote Linux server."
}

output "server_user" {
  value       = local.username
  description = "The username to log into the remote Linux server."
}
