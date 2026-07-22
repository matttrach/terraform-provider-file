output "output" {
  value = { for k, v in jsondecode(data.file_local.outputs.contents) : k => v.value }
}
