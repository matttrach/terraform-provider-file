provider "aws" {
  default_tags {
    tags = {
      Owner = "terraform-ci@suse.com"
      Name  = var.identifier
      Id    = var.identifier
    }
  }
}

provider "acme" {
  server_url = "https://acme-staging-v02.api.letsencrypt.org/directory"
}

locals {
  project_name = substr("tf-val-${substr(md5(var.identifier), 0, 5)}-${var.identifier}", 0, 20)
  username     = lower(local.project_name)
  image        = "sles-15"
  ip           = chomp(data.http.myip.response_body)

  home_remote_path = "/home/${local.username}"
}

data "http" "myip" {
  url = "https://ipinfo.io/ip"
  retry {
    attempts     = 2
    min_delay_ms = 1000
  }
}

module "access" {
  source                     = "rancher/access/aws"
  version                    = "4.0.5"
  vpc_name                   = "${local.project_name}-vpc"
  vpc_type                   = "dualstack"
  vpc_public                 = true
  security_group_name        = "${local.project_name}-sg"
  security_group_type        = "egress"
  load_balancer_use_strategy = "skip"
  domain_use_strategy        = "skip"
}

resource "aws_key_pair" "temp_key" {
  key_name   = "${var.identifier}-temp-key"
  public_key = var.public_key
}

module "runner" {
  depends_on = [
    module.access,
    aws_key_pair.temp_key,
  ]
  source                     = "rancher/server/aws"
  version                    = "2.0.3"
  image_type                 = local.image
  server_name                = local.project_name
  server_type                = "xl"
  subnet_name                = keys(module.access.subnets)[0]
  security_group_name        = module.access.security_group.tags_all.Name
  direct_access_use_strategy = "ssh"
  cloudinit_use_strategy     = "default"
  server_access_addresses = {
    "runnerSsh" = {
      port      = 22
      protocol  = "tcp"
      cidrs     = ["${local.ip}/32"]
      ip_family = "ipv4"
    }
  }
  server_user = {
    user                     = local.username
    aws_keypair_use_strategy = "select"
    ssh_key_name             = aws_key_pair.temp_key.key_name
    public_ssh_key           = var.public_key
    user_workfolder          = local.home_remote_path
    timeout                  = 5
  }
}

resource "file_local" "server_info" {
  contents = jsonencode({
    ip   = module.runner.server.public_ip
    user = local.username
  })
  name      = "server_info.json"
  directory = path.root
}

resource "file_local" "remote_terraformrc" {
  contents  = <<-EOT
    provider_installation {
      dev_overrides {
        "rancher/file" = "${local.home_remote_path}/bin"
      }
      direct {
        exclude = []
      }
    }
  EOT
  name      = ".terraformrc_remote"
  directory = path.root
}

resource "terraform_data" "provision_test" {
  depends_on = [
    module.access,
    module.runner,
    file_local.server_info,
    file_local.remote_terraformrc,
  ]
  connection {
    type        = "ssh"
    user        = local.username
    private_key = file(var.private_key_path)
    agent       = false
    host        = module.runner.server.public_ip
  }

  # Pre-create standard directories to avoid creation permissions and nested-directory issues
  provisioner "remote-exec" {
    inline = [
      "mkdir -p ${local.home_remote_path}/bin"
    ]
  }

  # 1. Copy the test and examples directories recursively (which creates /test and /examples)
  provisioner "file" {
    source      = "${path.root}/../../test"
    destination = "${local.home_remote_path}/test"
  }

  provisioner "file" {
    source      = "${path.root}/../../examples"
    destination = "${local.home_remote_path}/examples"
  }

  # 2. Copy the precompiled test binary directly inside the newly created /test folder
  provisioner "file" {
    source      = "${path.root}/../spinning.test"
    destination = "${local.home_remote_path}/test/spinning.test"
  }

  # 3. Copy the provider source code to compile natively inside the SLES VM with Go 1.26.0
  provisioner "file" {
    source      = "${path.root}/../../main.go"
    destination = "${local.home_remote_path}/main.go"
  }

  provisioner "file" {
    source      = "${path.root}/../../go.mod"
    destination = "${local.home_remote_path}/go.mod"
  }

  provisioner "file" {
    source      = "${path.root}/../../go.sum"
    destination = "${local.home_remote_path}/go.sum"
  }

  provisioner "file" {
    source      = "${path.root}/../../internal"
    destination = "${local.home_remote_path}/internal"
  }

  # Copy the generated .terraformrc file natively
  provisioner "file" {
    source      = "${path.root}/.terraformrc_remote"
    destination = "${local.home_remote_path}/test/.terraformrc"
  }

  # 4. Setup dependencies and execute the validation test
  provisioner "remote-exec" {
    inline = [<<-EOT
      set -e
      
      if command -v apt-get >/dev/null 2>&1; then
        echo "==> Detected Ubuntu/Debian, installing packages..."
        sudo apt-get update -y > /dev/null
        sudo apt-get install -y git unzip curl procps htop jq > /dev/null
      elif command -v zypper >/dev/null 2>&1; then
        echo "==> Detected SLES/SUSE, installing packages..."
        sudo zypper --non-interactive install unzip > /dev/null
      else
        echo "Error: Unknown OS package manager"
        exit 1
      fi

      echo "==> Installing Terraform 1.5.7..."
      curl -fsSL -O https://releases.hashicorp.com/terraform/1.5.7/terraform_1.5.7_linux_amd64.zip
      unzip -o terraform_1.5.7_linux_amd64.zip > /dev/null
      sudo mv terraform /usr/local/bin/
      rm terraform_1.5.7_linux_amd64.zip

      echo "==> Installing Go 1.26.0..."
      curl -fsSL -O https://go.dev/dl/go1.26.0.linux-amd64.tar.gz
      sudo rm -rf /usr/local/go
      sudo tar -C /usr/local -xzf go1.26.0.linux-amd64.tar.gz
      rm go1.26.0.linux-amd64.tar.gz
      export PATH=/usr/local/go/bin:$PATH

      echo "==> Compiling provider binary natively with Go 1.26.0..."
      cd ${local.home_remote_path}
      go build -o ${local.home_remote_path}/bin/terraform-provider-file .

      echo "==> Configuring execution permissions..."
      chmod +x ${local.home_remote_path}/bin/terraform-provider-file
      chmod +x ${local.home_remote_path}/test/spinning.test

      echo "==> Running high-concurrency validation test on remote Linux kernel..."
      cd ${local.home_remote_path}/test
      export REPO_ROOT="${local.home_remote_path}"
      export TF_CLI_CONFIG_FILE="${local.home_remote_path}/test/.terraformrc"

      # Execute the precompiled test binary directly on the Linux server!
      ./spinning.test -test.v -test.run=TestLocalSpinningConcurrency -test.timeout=300s
    EOT
    ]
  }
}
