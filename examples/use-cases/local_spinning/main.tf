provider "file" {}

locals {
  directory = (var.directory == "" ? "." : var.directory)
}

resource "file_local" "base_file_1" {
  name      = "base_file_1.txt"
  directory = local.directory
  contents  = "Base file contents 1 to be snapshotted."
}
resource "terraform_data" "local_exec_1" {
  depends_on = [
    file_local.base_file_1,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 1'; 
      (echo "sleeping 1"; sleep 10; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_1" {
  depends_on = [
    file_local.base_file_1,
    terraform_data.local_exec_1,
  ]
  directory      = local.directory
  name           = file_local.base_file_1.name
  update_trigger = "trigger_1"
}
resource "file_local" "spinning_1" {
  depends_on = [
    file_local.base_file_1,
    terraform_data.local_exec_1,
    file_local_snapshot.spinning_1,
  ]
  name      = "spinning_1.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_1.snapshot)
}
data "file_local" "spinning_1" {
  depends_on = [
    file_local.base_file_1,
    terraform_data.local_exec_1,
    file_local_snapshot.spinning_1,
    file_local.spinning_1,
  ]
  name      = file_local.spinning_1.name
  directory = file_local.spinning_1.directory
}


resource "file_local" "base_file_2" {
  name      = "base_file_2.txt"
  directory = local.directory
  contents  = "Base file contents 2 to be snapshotted."
}
resource "terraform_data" "local_exec_2" {
  depends_on = [
    file_local.base_file_2,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 2'; 
      (echo "sleeping 2"; sleep 20; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_2" {
  depends_on = [
    file_local.base_file_2,
    terraform_data.local_exec_2,
  ]
  directory      = local.directory
  name           = file_local.base_file_2.name
  update_trigger = "trigger_2"
}
resource "file_local" "spinning_2" {
  depends_on = [
    file_local.base_file_2,
    terraform_data.local_exec_2,
    file_local_snapshot.spinning_2,
  ]
  name      = "spinning_2.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_2.snapshot)
}
data "file_local" "spinning_2" {
  depends_on = [
    file_local.base_file_2,
    terraform_data.local_exec_2,
    file_local_snapshot.spinning_2,
    file_local.spinning_2,
  ]
  name      = file_local.spinning_2.name
  directory = file_local.spinning_2.directory
}



resource "file_local" "base_file_3" {
  name      = "base_file_3.txt"
  directory = local.directory
  contents  = "Base file contents 3 to be snapshotted."
}
resource "terraform_data" "local_exec_3" {
  depends_on = [
    file_local.base_file_3,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 3'; 
      (echo "sleeping 3"; sleep 30; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_3" {
  depends_on = [
    file_local.base_file_3,
    terraform_data.local_exec_3,
  ]
  directory      = local.directory
  name           = file_local.base_file_3.name
  update_trigger = "trigger_3"
}
resource "file_local" "spinning_3" {
  depends_on = [
    file_local.base_file_3,
    terraform_data.local_exec_3,
    file_local_snapshot.spinning_3,
  ]
  name      = "spinning_3.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_3.snapshot)
}
data "file_local" "spinning_3" {
  depends_on = [
    file_local.base_file_3,
    terraform_data.local_exec_3,
    file_local_snapshot.spinning_3,
    file_local.spinning_3,
  ]
  name      = file_local.spinning_3.name
  directory = file_local.spinning_3.directory
}

resource "file_local" "base_file_4" {
  name      = "base_file_4.txt"
  directory = local.directory
  contents  = "Base file contents 4 to be snapshotted."
}
resource "terraform_data" "local_exec_4" {
  depends_on = [
    file_local.base_file_4,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 4'; 
      (echo "sleeping 4"; sleep 40; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_4" {
  depends_on = [
    file_local.base_file_4,
    terraform_data.local_exec_4,
  ]
  directory      = local.directory
  name           = file_local.base_file_4.name
  update_trigger = "trigger_4"
}
resource "file_local" "spinning_4" {
  depends_on = [
    file_local.base_file_4,
    terraform_data.local_exec_4,
    file_local_snapshot.spinning_4,
  ]
  name      = "spinning_4.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_4.snapshot)
}
data "file_local" "spinning_4" {
  depends_on = [
    file_local.base_file_4,
    terraform_data.local_exec_4,
    file_local_snapshot.spinning_4,
    file_local.spinning_4,
  ]
  name      = file_local.spinning_4.name
  directory = file_local.spinning_4.directory
}

resource "file_local" "base_file_5" {
  name      = "base_file_5.txt"
  directory = local.directory
  contents  = "Base file contents 5 to be snapshotted."
}
resource "terraform_data" "local_exec_5" {
  depends_on = [
    file_local.base_file_5,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 5'; 
      (echo "sleeping 5"; sleep 50; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_5" {
  depends_on = [
    file_local.base_file_5,
    terraform_data.local_exec_5,
  ]
  directory      = local.directory
  name           = file_local.base_file_5.name
  update_trigger = "trigger_5"
}
resource "file_local" "spinning_5" {
  depends_on = [
    file_local.base_file_5,
    terraform_data.local_exec_5,
    file_local_snapshot.spinning_5,
  ]
  name      = "spinning_5.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_5.snapshot)
}
data "file_local" "spinning_5" {
  depends_on = [
    file_local.base_file_5,
    terraform_data.local_exec_5,
    file_local_snapshot.spinning_5,
    file_local.spinning_5,
  ]
  name      = file_local.spinning_5.name
  directory = file_local.spinning_5.directory
}

resource "file_local" "base_file_6" {
  name      = "base_file_6.txt"
  directory = local.directory
  contents  = "Base file contents 6 to be snapshotted."
}
resource "terraform_data" "local_exec_6" {
  depends_on = [
    file_local.base_file_6,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 6'; 
      (echo "sleeping 6"; sleep 60; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_6" {
  depends_on = [
    file_local.base_file_6,
    terraform_data.local_exec_6,
  ]
  directory      = local.directory
  name           = file_local.base_file_6.name
  update_trigger = "trigger_6"
}
resource "file_local" "spinning_6" {
  depends_on = [
    file_local.base_file_6,
    terraform_data.local_exec_6,
    file_local_snapshot.spinning_6,
  ]
  name      = "spinning_6.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_6.snapshot)
}
data "file_local" "spinning_6" {
  depends_on = [
    file_local.base_file_6,
    terraform_data.local_exec_6,
    file_local_snapshot.spinning_6,
    file_local.spinning_6,
  ]
  name      = file_local.spinning_6.name
  directory = file_local.spinning_6.directory
}

resource "file_local" "base_file_7" {
  name      = "base_file_7.txt"
  directory = local.directory
  contents  = "Base file contents 7 to be snapshotted."
}
resource "terraform_data" "local_exec_7" {
  depends_on = [
    file_local.base_file_7,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 7'; 
      (echo "sleeping 7"; sleep 70; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_7" {
  depends_on = [
    file_local.base_file_7,
    terraform_data.local_exec_7,
  ]
  directory      = local.directory
  name           = file_local.base_file_7.name
  update_trigger = "trigger_7"
}
resource "file_local" "spinning_7" {
  depends_on = [
    file_local.base_file_7,
    terraform_data.local_exec_7,
    file_local_snapshot.spinning_7,
  ]
  name      = "spinning_7.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_7.snapshot)
}
data "file_local" "spinning_7" {
  depends_on = [
    file_local.base_file_7,
    terraform_data.local_exec_7,
    file_local_snapshot.spinning_7,
    file_local.spinning_7,
  ]
  name      = file_local.spinning_7.name
  directory = file_local.spinning_7.directory
}

resource "file_local" "base_file_8" {
  name      = "base_file_8.txt"
  directory = local.directory
  contents  = "Base file contents 8 to be snapshotted."
}
resource "terraform_data" "local_exec_8" {
  depends_on = [
    file_local.base_file_8,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 8'; 
      (echo "sleeping 8"; sleep 80; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_8" {
  depends_on = [
    file_local.base_file_8,
    terraform_data.local_exec_8,
  ]
  directory      = local.directory
  name           = file_local.base_file_8.name
  update_trigger = "trigger_8"
}
resource "file_local" "spinning_8" {
  depends_on = [
    file_local.base_file_8,
    terraform_data.local_exec_8,
    file_local_snapshot.spinning_8,
  ]
  name      = "spinning_8.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_8.snapshot)
}
data "file_local" "spinning_8" {
  depends_on = [
    file_local.base_file_8,
    terraform_data.local_exec_8,
    file_local_snapshot.spinning_8,
    file_local.spinning_8,
  ]
  name      = file_local.spinning_8.name
  directory = file_local.spinning_8.directory
}

resource "file_local" "base_file_9" {
  name      = "base_file_9.txt"
  directory = local.directory
  contents  = "Base file contents 9 to be snapshotted."
}
resource "terraform_data" "local_exec_9" {
  depends_on = [
    file_local.base_file_9,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 9'; 
      (echo "sleeping 9"; sleep 90; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_9" {
  depends_on = [
    file_local.base_file_9,
    terraform_data.local_exec_9,
  ]
  directory      = local.directory
  name           = file_local.base_file_9.name
  update_trigger = "trigger_9"
}
resource "file_local" "spinning_9" {
  depends_on = [
    file_local.base_file_9,
    terraform_data.local_exec_9,
    file_local_snapshot.spinning_9,
  ]
  name      = "spinning_9.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_9.snapshot)
}
data "file_local" "spinning_9" {
  depends_on = [
    file_local.base_file_9,
    terraform_data.local_exec_9,
    file_local_snapshot.spinning_9,
    file_local.spinning_9,
  ]
  name      = file_local.spinning_9.name
  directory = file_local.spinning_9.directory
}


resource "file_local" "base_file_10" {
  name      = "base_file_10.txt"
  directory = local.directory
  contents  = "Base file contents 10 to be snapshotted."
}
resource "terraform_data" "local_exec_10" {
  depends_on = [
    file_local.base_file_10,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 10'; 
      (echo "sleeping 10"; sleep 100; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_10" {
  depends_on = [
    file_local.base_file_10,
    terraform_data.local_exec_10,
  ]
  directory      = local.directory
  name           = file_local.base_file_10.name
  update_trigger = "trigger_10"
}
resource "file_local" "spinning_10" {
  depends_on = [
    file_local.base_file_10,
    terraform_data.local_exec_10,
    file_local_snapshot.spinning_10,
  ]
  name      = "spinning_10.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_10.snapshot)
}
data "file_local" "spinning_10" {
  depends_on = [
    file_local.base_file_10,
    terraform_data.local_exec_10,
    file_local_snapshot.spinning_10,
    file_local.spinning_10,
  ]
  name      = file_local.spinning_10.name
  directory = file_local.spinning_10.directory
}




resource "file_local" "base_file_11" {
  name      = "base_file_11.txt"
  directory = local.directory
  contents  = "Base file contents 11 to be snapshotted."
}
resource "terraform_data" "local_exec_11" {
  depends_on = [
    file_local.base_file_11,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 11'; 
      (echo "sleeping 11"; sleep 110; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_11" {
  depends_on = [
    file_local.base_file_11,
    terraform_data.local_exec_11,
  ]
  directory      = local.directory
  name           = file_local.base_file_11.name
  update_trigger = "trigger_11"
}
resource "file_local" "spinning_11" {
  depends_on = [
    file_local.base_file_11,
    terraform_data.local_exec_11,
    file_local_snapshot.spinning_11,
  ]
  name      = "spinning_11.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_11.snapshot)
}
data "file_local" "spinning_11" {
  depends_on = [
    file_local.base_file_11,
    terraform_data.local_exec_11,
    file_local_snapshot.spinning_11,
    file_local.spinning_11,
  ]
  name      = file_local.spinning_11.name
  directory = file_local.spinning_11.directory
}



resource "file_local" "base_file_12" {
  name      = "base_file_12.txt"
  directory = local.directory
  contents  = "Base file contents 12 to be snapshotted."
}
resource "terraform_data" "local_exec_12" {
  depends_on = [
    file_local.base_file_12,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 12'; 
      (echo "sleeping 12"; sleep 120; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_12" {
  depends_on = [
    file_local.base_file_12,
    terraform_data.local_exec_12,
  ]
  directory      = local.directory
  name           = file_local.base_file_12.name
  update_trigger = "trigger_12"
}
resource "file_local" "spinning_12" {
  depends_on = [
    file_local.base_file_12,
    terraform_data.local_exec_12,
    file_local_snapshot.spinning_12,
  ]
  name      = "spinning_12.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_12.snapshot)
}
data "file_local" "spinning_12" {
  depends_on = [
    file_local.base_file_12,
    terraform_data.local_exec_12,
    file_local_snapshot.spinning_12,
    file_local.spinning_12,
  ]
  name      = file_local.spinning_12.name
  directory = file_local.spinning_12.directory
}



resource "file_local" "base_file_13" {
  name      = "base_file_13.txt"
  directory = local.directory
  contents  = "Base file contents 13 to be snapshotted."
}
resource "terraform_data" "local_exec_13" {
  depends_on = [
    file_local.base_file_13,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 13'; 
      (echo "sleeping 13"; sleep 130; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_13" {
  depends_on = [
    file_local.base_file_13,
    terraform_data.local_exec_13,
  ]
  directory      = local.directory
  name           = file_local.base_file_13.name
  update_trigger = "trigger_13"
}
resource "file_local" "spinning_13" {
  depends_on = [
    file_local.base_file_13,
    terraform_data.local_exec_13,
    file_local_snapshot.spinning_13,
  ]
  name      = "spinning_13.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_13.snapshot)
}
data "file_local" "spinning_13" {
  depends_on = [
    file_local.base_file_13,
    terraform_data.local_exec_13,
    file_local_snapshot.spinning_13,
    file_local.spinning_13,
  ]
  name      = file_local.spinning_13.name
  directory = file_local.spinning_13.directory
}



resource "file_local" "base_file_14" {
  name      = "base_file_14.txt"
  directory = local.directory
  contents  = "Base file contents 14 to be snapshotted."
}
resource "terraform_data" "local_exec_14" {
  depends_on = [
    file_local.base_file_14,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 14'; 
      (echo "sleeping 14"; sleep 140; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_14" {
  depends_on = [
    file_local.base_file_14,
    terraform_data.local_exec_14,
  ]
  directory      = local.directory
  name           = file_local.base_file_14.name
  update_trigger = "trigger_14"
}
resource "file_local" "spinning_14" {
  depends_on = [
    file_local.base_file_14,
    terraform_data.local_exec_14,
    file_local_snapshot.spinning_14,
  ]
  name      = "spinning_14.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_14.snapshot)
}
data "file_local" "spinning_14" {
  depends_on = [
    file_local.base_file_14,
    terraform_data.local_exec_14,
    file_local_snapshot.spinning_14,
    file_local.spinning_14,
  ]
  name      = file_local.spinning_14.name
  directory = file_local.spinning_14.directory
}



resource "file_local" "base_file_15" {
  name      = "base_file_15.txt"
  directory = local.directory
  contents  = "Base file contents 15 to be snapshotted."
}
resource "terraform_data" "local_exec_15" {
  depends_on = [
    file_local.base_file_15,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 15'; 
      (echo "sleeping 15"; sleep 150; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_15" {
  depends_on = [
    file_local.base_file_15,
    terraform_data.local_exec_15,
  ]
  directory      = local.directory
  name           = file_local.base_file_15.name
  update_trigger = "trigger_15"
}
resource "file_local" "spinning_15" {
  depends_on = [
    file_local.base_file_15,
    terraform_data.local_exec_15,
    file_local_snapshot.spinning_15,
  ]
  name      = "spinning_15.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_15.snapshot)
}
data "file_local" "spinning_15" {
  depends_on = [
    file_local.base_file_15,
    terraform_data.local_exec_15,
    file_local_snapshot.spinning_15,
    file_local.spinning_15,
  ]
  name      = file_local.spinning_15.name
  directory = file_local.spinning_15.directory
}



resource "file_local" "base_file_16" {
  name      = "base_file_16.txt"
  directory = local.directory
  contents  = "Base file contents 16 to be snapshotted."
}
resource "terraform_data" "local_exec_16" {
  depends_on = [
    file_local.base_file_16,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 16'; 
      (echo "sleeping 16"; sleep 160; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_16" {
  depends_on = [
    file_local.base_file_16,
    terraform_data.local_exec_16,
  ]
  directory      = local.directory
  name           = file_local.base_file_16.name
  update_trigger = "trigger_16"
}
resource "file_local" "spinning_16" {
  depends_on = [
    file_local.base_file_16,
    terraform_data.local_exec_16,
    file_local_snapshot.spinning_16,
  ]
  name      = "spinning_16.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_16.snapshot)
}
data "file_local" "spinning_16" {
  depends_on = [
    file_local.base_file_16,
    terraform_data.local_exec_16,
    file_local_snapshot.spinning_16,
    file_local.spinning_16,
  ]
  name      = file_local.spinning_16.name
  directory = file_local.spinning_16.directory
}



resource "file_local" "base_file_17" {
  name      = "base_file_17.txt"
  directory = local.directory
  contents  = "Base file contents 17 to be snapshotted."
}
resource "terraform_data" "local_exec_17" {
  depends_on = [
    file_local.base_file_17,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 17'; 
      (echo "sleeping 17"; sleep 170; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_17" {
  depends_on = [
    file_local.base_file_17,
    terraform_data.local_exec_17,
  ]
  directory      = local.directory
  name           = file_local.base_file_17.name
  update_trigger = "trigger_17"
}
resource "file_local" "spinning_17" {
  depends_on = [
    file_local.base_file_17,
    terraform_data.local_exec_17,
    file_local_snapshot.spinning_17,
  ]
  name      = "spinning_17.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_17.snapshot)
}
data "file_local" "spinning_17" {
  depends_on = [
    file_local.base_file_17,
    terraform_data.local_exec_17,
    file_local_snapshot.spinning_17,
    file_local.spinning_17,
  ]
  name      = file_local.spinning_17.name
  directory = file_local.spinning_17.directory
}



resource "file_local" "base_file_18" {
  name      = "base_file_18.txt"
  directory = local.directory
  contents  = "Base file contents 18 to be snapshotted."
}
resource "terraform_data" "local_exec_18" {
  depends_on = [
    file_local.base_file_18,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 18'; 
      (echo "sleeping 18"; sleep 180; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_18" {
  depends_on = [
    file_local.base_file_18,
    terraform_data.local_exec_18,
  ]
  directory      = local.directory
  name           = file_local.base_file_18.name
  update_trigger = "trigger_18"
}
resource "file_local" "spinning_18" {
  depends_on = [
    file_local.base_file_18,
    terraform_data.local_exec_18,
    file_local_snapshot.spinning_18,
  ]
  name      = "spinning_18.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_18.snapshot)
}
data "file_local" "spinning_18" {
  depends_on = [
    file_local.base_file_18,
    terraform_data.local_exec_18,
    file_local_snapshot.spinning_18,
    file_local.spinning_18,
  ]
  name      = file_local.spinning_18.name
  directory = file_local.spinning_18.directory
}



resource "file_local" "base_file_19" {
  name      = "base_file_19.txt"
  directory = local.directory
  contents  = "Base file contents 19 to be snapshotted."
}
resource "terraform_data" "local_exec_19" {
  depends_on = [
    file_local.base_file_19,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 19'; 
      (echo "sleeping 19"; sleep 190; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_19" {
  depends_on = [
    file_local.base_file_19,
    terraform_data.local_exec_19,
  ]
  directory      = local.directory
  name           = file_local.base_file_19.name
  update_trigger = "trigger_19"
}
resource "file_local" "spinning_19" {
  depends_on = [
    file_local.base_file_19,
    terraform_data.local_exec_19,
    file_local_snapshot.spinning_19,
  ]
  name      = "spinning_19.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_19.snapshot)
}
data "file_local" "spinning_19" {
  depends_on = [
    file_local.base_file_19,
    terraform_data.local_exec_19,
    file_local_snapshot.spinning_19,
    file_local.spinning_19,
  ]
  name      = file_local.spinning_19.name
  directory = file_local.spinning_19.directory
}



resource "file_local" "base_file_20" {
  name      = "base_file_20.txt"
  directory = local.directory
  contents  = "Base file contents 20 to be snapshotted."
}
resource "terraform_data" "local_exec_20" {
  depends_on = [
    file_local.base_file_20,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 20'; 
      (echo "sleeping 20"; sleep 200; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_20" {
  depends_on = [
    file_local.base_file_20,
    terraform_data.local_exec_20,
  ]
  directory      = local.directory
  name           = file_local.base_file_20.name
  update_trigger = "trigger_20"
}
resource "file_local" "spinning_20" {
  depends_on = [
    file_local.base_file_20,
    terraform_data.local_exec_20,
    file_local_snapshot.spinning_20,
  ]
  name      = "spinning_20.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_20.snapshot)
}
data "file_local" "spinning_20" {
  depends_on = [
    file_local.base_file_20,
    terraform_data.local_exec_20,
    file_local_snapshot.spinning_20,
    file_local.spinning_20,
  ]
  name      = file_local.spinning_20.name
  directory = file_local.spinning_20.directory
}





resource "file_local" "base_file_21" {
  name      = "base_file_21.txt"
  directory = local.directory
  contents  = "Base file contents 21 to be snapshotted."
}
resource "terraform_data" "local_exec_21" {
  depends_on = [
    file_local.base_file_21,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 21'; 
      (echo "sleeping 21"; sleep 210; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_21" {
  depends_on = [
    file_local.base_file_21,
    terraform_data.local_exec_21,
  ]
  directory      = local.directory
  name           = file_local.base_file_21.name
  update_trigger = "trigger_21"
}
resource "file_local" "spinning_21" {
  depends_on = [
    file_local.base_file_21,
    terraform_data.local_exec_21,
    file_local_snapshot.spinning_21,
  ]
  name      = "spinning_21.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_21.snapshot)
}
data "file_local" "spinning_21" {
  depends_on = [
    file_local.base_file_21,
    terraform_data.local_exec_21,
    file_local_snapshot.spinning_21,
    file_local.spinning_21,
  ]
  name      = file_local.spinning_21.name
  directory = file_local.spinning_21.directory
}



resource "file_local" "base_file_22" {
  name      = "base_file_22.txt"
  directory = local.directory
  contents  = "Base file contents 22 to be snapshotted."
}
resource "terraform_data" "local_exec_22" {
  depends_on = [
    file_local.base_file_22,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 22'; 
      (echo "sleeping 22"; sleep 220; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_22" {
  depends_on = [
    file_local.base_file_22,
    terraform_data.local_exec_22,
  ]
  directory      = local.directory
  name           = file_local.base_file_22.name
  update_trigger = "trigger_22"
}
resource "file_local" "spinning_22" {
  depends_on = [
    file_local.base_file_22,
    terraform_data.local_exec_22,
    file_local_snapshot.spinning_22,
  ]
  name      = "spinning_22.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_22.snapshot)
}
data "file_local" "spinning_22" {
  depends_on = [
    file_local.base_file_22,
    terraform_data.local_exec_22,
    file_local_snapshot.spinning_22,
    file_local.spinning_22,
  ]
  name      = file_local.spinning_22.name
  directory = file_local.spinning_22.directory
}



resource "file_local" "base_file_23" {
  name      = "base_file_23.txt"
  directory = local.directory
  contents  = "Base file contents 23 to be snapshotted."
}
resource "terraform_data" "local_exec_23" {
  depends_on = [
    file_local.base_file_23,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 23'; 
      (echo "sleeping 23"; sleep 230; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_23" {
  depends_on = [
    file_local.base_file_23,
    terraform_data.local_exec_23,
  ]
  directory      = local.directory
  name           = file_local.base_file_23.name
  update_trigger = "trigger_23"
}
resource "file_local" "spinning_23" {
  depends_on = [
    file_local.base_file_23,
    terraform_data.local_exec_23,
    file_local_snapshot.spinning_23,
  ]
  name      = "spinning_23.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_23.snapshot)
}
data "file_local" "spinning_23" {
  depends_on = [
    file_local.base_file_23,
    terraform_data.local_exec_23,
    file_local_snapshot.spinning_23,
    file_local.spinning_23,
  ]
  name      = file_local.spinning_23.name
  directory = file_local.spinning_23.directory
}



resource "file_local" "base_file_24" {
  name      = "base_file_24.txt"
  directory = local.directory
  contents  = "Base file contents 24 to be snapshotted."
}
resource "terraform_data" "local_exec_24" {
  depends_on = [
    file_local.base_file_24,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 24'; 
      (echo "sleeping 24"; sleep 240; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_24" {
  depends_on = [
    file_local.base_file_24,
    terraform_data.local_exec_24,
  ]
  directory      = local.directory
  name           = file_local.base_file_24.name
  update_trigger = "trigger_24"
}
resource "file_local" "spinning_24" {
  depends_on = [
    file_local.base_file_24,
    terraform_data.local_exec_24,
    file_local_snapshot.spinning_24,
  ]
  name      = "spinning_24.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_24.snapshot)
}
data "file_local" "spinning_24" {
  depends_on = [
    file_local.base_file_24,
    terraform_data.local_exec_24,
    file_local_snapshot.spinning_24,
    file_local.spinning_24,
  ]
  name      = file_local.spinning_24.name
  directory = file_local.spinning_24.directory
}



resource "file_local" "base_file_25" {
  name      = "base_file_25.txt"
  directory = local.directory
  contents  = "Base file contents 25 to be snapshotted."
}
resource "terraform_data" "local_exec_25" {
  depends_on = [
    file_local.base_file_25,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 25'; 
      (echo "sleeping 25"; sleep 250; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_25" {
  depends_on = [
    file_local.base_file_25,
    terraform_data.local_exec_25,
  ]
  directory      = local.directory
  name           = file_local.base_file_25.name
  update_trigger = "trigger_25"
}
resource "file_local" "spinning_25" {
  depends_on = [
    file_local.base_file_25,
    terraform_data.local_exec_25,
    file_local_snapshot.spinning_25,
  ]
  name      = "spinning_25.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_25.snapshot)
}
data "file_local" "spinning_25" {
  depends_on = [
    file_local.base_file_25,
    terraform_data.local_exec_25,
    file_local_snapshot.spinning_25,
    file_local.spinning_25,
  ]
  name      = file_local.spinning_25.name
  directory = file_local.spinning_25.directory
}



resource "file_local" "base_file_26" {
  name      = "base_file_26.txt"
  directory = local.directory
  contents  = "Base file contents 26 to be snapshotted."
}
resource "terraform_data" "local_exec_26" {
  depends_on = [
    file_local.base_file_26,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 26'; 
      (echo "sleeping 26"; sleep 260; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_26" {
  depends_on = [
    file_local.base_file_26,
    terraform_data.local_exec_26,
  ]
  directory      = local.directory
  name           = file_local.base_file_26.name
  update_trigger = "trigger_26"
}
resource "file_local" "spinning_26" {
  depends_on = [
    file_local.base_file_26,
    terraform_data.local_exec_26,
    file_local_snapshot.spinning_26,
  ]
  name      = "spinning_26.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_26.snapshot)
}
data "file_local" "spinning_26" {
  depends_on = [
    file_local.base_file_26,
    terraform_data.local_exec_26,
    file_local_snapshot.spinning_26,
    file_local.spinning_26,
  ]
  name      = file_local.spinning_26.name
  directory = file_local.spinning_26.directory
}



resource "file_local" "base_file_27" {
  name      = "base_file_27.txt"
  directory = local.directory
  contents  = "Base file contents 27 to be snapshotted."
}
resource "terraform_data" "local_exec_27" {
  depends_on = [
    file_local.base_file_27,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 27'; 
      (echo "sleeping 27"; sleep 270; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_27" {
  depends_on = [
    file_local.base_file_27,
    terraform_data.local_exec_27,
  ]
  directory      = local.directory
  name           = file_local.base_file_27.name
  update_trigger = "trigger_27"
}
resource "file_local" "spinning_27" {
  depends_on = [
    file_local.base_file_27,
    terraform_data.local_exec_27,
    file_local_snapshot.spinning_27,
  ]
  name      = "spinning_27.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_27.snapshot)
}
data "file_local" "spinning_27" {
  depends_on = [
    file_local.base_file_27,
    terraform_data.local_exec_27,
    file_local_snapshot.spinning_27,
    file_local.spinning_27,
  ]
  name      = file_local.spinning_27.name
  directory = file_local.spinning_27.directory
}



resource "file_local" "base_file_28" {
  name      = "base_file_28.txt"
  directory = local.directory
  contents  = "Base file contents 28 to be snapshotted."
}
resource "terraform_data" "local_exec_28" {
  depends_on = [
    file_local.base_file_28,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 28'; 
      (echo "sleeping 28"; sleep 280; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_28" {
  depends_on = [
    file_local.base_file_28,
    terraform_data.local_exec_28,
  ]
  directory      = local.directory
  name           = file_local.base_file_28.name
  update_trigger = "trigger_28"
}
resource "file_local" "spinning_28" {
  depends_on = [
    file_local.base_file_28,
    terraform_data.local_exec_28,
    file_local_snapshot.spinning_28,
  ]
  name      = "spinning_28.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_28.snapshot)
}
data "file_local" "spinning_28" {
  depends_on = [
    file_local.base_file_28,
    terraform_data.local_exec_28,
    file_local_snapshot.spinning_28,
    file_local.spinning_28,
  ]
  name      = file_local.spinning_28.name
  directory = file_local.spinning_28.directory
}



resource "file_local" "base_file_29" {
  name      = "base_file_29.txt"
  directory = local.directory
  contents  = "Base file contents 29 to be snapshotted."
}
resource "terraform_data" "local_exec_29" {
  depends_on = [
    file_local.base_file_29,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 29'; 
      (echo "sleeping 29"; sleep 290; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_29" {
  depends_on = [
    file_local.base_file_29,
    terraform_data.local_exec_29,
  ]
  directory      = local.directory
  name           = file_local.base_file_29.name
  update_trigger = "trigger_29"
}
resource "file_local" "spinning_29" {
  depends_on = [
    file_local.base_file_29,
    terraform_data.local_exec_29,
    file_local_snapshot.spinning_29,
  ]
  name      = "spinning_29.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_29.snapshot)
}
data "file_local" "spinning_29" {
  depends_on = [
    file_local.base_file_29,
    terraform_data.local_exec_29,
    file_local_snapshot.spinning_29,
    file_local.spinning_29,
  ]
  name      = file_local.spinning_29.name
  directory = file_local.spinning_29.directory
}



resource "file_local" "base_file_30" {
  name      = "base_file_30.txt"
  directory = local.directory
  contents  = "Base file contents 30 to be snapshotted."
}
resource "terraform_data" "local_exec_30" {
  depends_on = [
    file_local.base_file_30,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo 'Executing concurrent local_exec 30'; 
      (echo "sleeping 30"; sleep 300; echo "done") &
    EOT
  }
}
resource "file_local_snapshot" "spinning_30" {
  depends_on = [
    file_local.base_file_30,
    terraform_data.local_exec_30,
  ]
  directory      = local.directory
  name           = file_local.base_file_30.name
  update_trigger = "trigger_30"
}
resource "file_local" "spinning_30" {
  depends_on = [
    file_local.base_file_30,
    terraform_data.local_exec_30,
    file_local_snapshot.spinning_30,
  ]
  name      = "spinning_30.txt"
  directory = local.directory
  contents  = base64decode(file_local_snapshot.spinning_30.snapshot)
}
data "file_local" "spinning_30" {
  depends_on = [
    file_local.base_file_30,
    terraform_data.local_exec_30,
    file_local_snapshot.spinning_30,
    file_local.spinning_30,
  ]
  name      = file_local.spinning_30.name
  directory = file_local.spinning_30.directory
}
