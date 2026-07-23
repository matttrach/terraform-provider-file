# Rancher Terraform Provider File: Testing Guide & Test Relay Harness

This document provides a comprehensive guide to the testing framework, test harness, and multi-tier AWS Test Relay infrastructure in this repository. It is designed to be highly detailed so that developers and AI agents can understand, execute, and extend the testing capabilities of this provider.

---

## 1. Testing Framework Overview

This project uses **Go (1.24+)** and **Terratest** to write and run end-to-end integration and acceptance tests. 
The tests are split into:
*   **Unit/Local Integration Tests:** Run on the developer's local machine against local file systems.
*   **AWS Test Relay Validation Tests:** Automatically deploy resources on AWS, upload the provider source and test binaries, run native OS-level concurrency and validation tests, and monitor them remotely over SSH.

---

## 2. Local Testing & Dev Overrides

To test code changes immediately without compiling, packaging, and publishing the provider to a registry, we use **Terraform Developer Overrides**.

### The `.terraformrc` Configuration
In the `test/` directory, there is a local `.terraformrc` configuration file:

```hcl
provider_installation {
  dev_overrides {
    "rancher/file" = "../../../bin"
  }
  direct {
    exclude = []
  }
}
```

This instructs the local Terraform CLI to bypass registry resolution for `"rancher/file"` and instead load the precompiled provider binary directly from the `./bin` folder at the root of the repository.

### Execution Workflow
All tests are run via the `GNUmakefile` at the project root:

1.  **Unit/Integration Tests:**
    ```bash
    make test
    ```
2.  **Acceptance Tests (including AWS Relay tests if credentials are set):**
    ```bash
    make testacc
    ```

Both targets first run the `build` step to compile the latest code into `./bin/terraform-provider-file` and then trigger `gotestsum` inside the `test/` directory.

---

## 3. Dynamic Test Isolation (`util.Setup` & `util.TearDown`)

To allow tests to run concurrently (`t.Parallel()`) without colliding on state or file paths, the test harness enforces dynamic directory isolation.

### Lifecycle of a Test Case
When a test starts:
1.  **Generate Unique ID:** The test calls `util.GetId()`, which retrieves or generates an execution identifier combining custom prefixes and a random suffix (e.g., `val-Hk9rtT-CxCG7R`).
2.  **Initialize Workspace:** `util.Setup(t, id, "test/data")` is called. This programmatically creates an isolated directory `test/data/<id>` on the host.
3.  **Define Options:** The test defines `terraform.Options` with:
    *   `TF_DATA_DIR` pointing to the isolated test directory.
    *   `TF_CLI_CONFIG_FILE` pointing to the local `./test/.terraformrc` to enable developer overrides.
    *   The backend state path mapped to `test/data/<id>/tfstate`.
4.  **Tear Down:** Upon test completion (success or failure), a deferred `util.TearDown(t, testDir, terraformOptions)` is executed. This:
    *   Runs `terraform destroy` to clean up any created provider resources.
    *   Removes `.terraform.lock.hcl`.
    *   Recursively deletes the dynamic `test/data/<id>` workspace.

---

## 4. The AWS Test Relay Harness (`test/test_relay`)

Certain tests (e.g., high-concurrency stress testing, multi-user file lockups, and kernel-level wait channel checks) cannot be reliably reproduced on standard workstations (like macOS) or restricted CI environments. 

The **AWS Test Relay** is a multi-tier test execution harness designed to deploy real-world AWS infrastructure, cross-compile and copy test suites, run tests natively on SLES (or other Linux kernels), monitor them remotely, and guarantee a clean teardown on exit.

```
┌──────────────────────────────────────┐          Deploy VPC/Subnets/EC2        ┌──────────────────────────────────────┐
│        Local Workstation/CI          ├───────────────────────────────────────>│               AWS EC2                │
│                                      │                                        │             (SLES 15 VM)             │
│  1. Programmatic linux/amd64 build   │                                        │                                      │
│  2. Generate keypair & SSH Agent     │          Copy Source & Binaries        │  1. Installs Go 1.26.0 & TF 1.5.7    │
│  3. Poll server_info.json (Select)   ├───────────────────────────────────────>│  2. Compiles provider natively       │
│  4. Run remote ps & monitor CPU/WCHAN│                                        │  3. Runs test binary natively        │
│  5. Terminate and trigger Destroy    │<───────────────────────────────────────┤                                      │
└──────────────────────────────────────┘             SSH Poll & Control         └──────────────────────────────────────┘
```

### Core Architecture & Components
*   **The Relay Terraform Configuration (`test/test_relay/main.tf`):**
    *   Sets up dualstack networking and security groups via `rancher/access/aws`.
    *   Deploys an AWS EC2 instance running SLES 15 (`rancher/server/aws`).
    *   Generates `server_info.json` containing the VM's public IP and username.
    *   Generates `.terraformrc_remote` to set up developer overrides on the VM.
    *   Uses Terraform `file` provisioners to copy:
        *   The complete `test/` and `examples/` source directories.
        *   The precompiled test suite binary (`spinning.test`).
        *   The provider's Go source code (`main.go`, `go.mod`, `go.sum`, `internal/`).
    *   Uses a `remote-exec` provisioner to bootstrap the VM:
        1.  Installs Terraform 1.5.7 and Go 1.26.0.
        2.  Compiles the provider natively on the SLES kernel with the exact Go version.
        3.  Runs the remote-side test binary natively.
*   **The Go Controller (`test/local/spinning/spinning_test.go` pattern):**
    *   Coordinates the entire multi-tier execution on the host machine.
    *   Directly handles SSH credential setup and in-memory key agents.
    *   Asynchronously executes the workstation-side Terraform Apply in a background goroutine so that the main thread can actively poll, monitor, and manage the remote execution.

---

## 5. How to Implement a New Test Relay Test

This section outlines the exact implementation pattern required to write a new AWS Test Relay test. Both human engineers and AI agents must follow this structure to ensure robust execution, fast early-failure detection, and perfect resource cleanup.

### Step 1: Declare the `relay` Go Build Constraint (Isolation standard)
To prevent the test relay test from compiling or executing during standard, lightweight workstation test runs or standard CI pull request workflows (which lack AWS access keys), you **must** specify the `relay` build tag as the very first line of your test file:

```go
//go:build relay

package your_feature
```

This isolates the test, ensuring it is only executed during explicit relay-specific acceptance test runs via:
*   `make testaccrelay`
*   `bash .github/workflows/scripts/test.sh acc-relay`

### Step 2: Check AWS Credentials (Friendliness & CI Integration)
At the very beginning of your test, ensure it skips gracefully if AWS credentials are not configured:

```go
if os.Getenv("AWS_ACCESS_KEY_ID") == "" && os.Getenv("AWS_PROFILE") == "" {
    t.Skip("Skipping TestName because AWS credentials are not set in the environment.")
}
```

### Step 3: Programmatic Cross-Compilation
To avoid relying on brittle external scripts, the workstation-side Go test must programmatically cross-compile the target remote test suite binary before deploying the relay:

```go
t.Log("Cross-compiling remote test suite binary for linux/amd64 (CGO_ENABLED=0)...")
compileCmd := exec.Command("go", "test", "-c", "-o", "./your_feature.test", "./local/your_feature")
compileCmd.Env = append(os.Environ(), "CGO_ENABLED=0", "GOOS=linux", "GOARCH=amd64")
compileCmd.Dir = filepath.Join(repoRoot, "test")

if output, err := compileCmd.CombinedOutput(); err != nil {
    t.Fatalf("Failed to cross-compile remote test binary: %v\nOutput: %s", err, string(output))
}

// Clean up the compiled binary on exit
defer func() {
    _ = os.Remove(filepath.Join(repoRoot, "test", "your_feature.test"))
}()
```

### Step 4: Start In-Memory SSH Agent
Generate a dynamic SSH keypair and start an in-memory SSH agent using Terratest to communicate with the AWS VM securely:

```go
keyPair := ssh.GenerateRSAKeyPair(t, 2048)
sshAgent := ssh.SshAgentWithKeyPair(t, keyPair)
defer sshAgent.Stop()

// Write private key with 0600 permissions so local SSH CLI can use it
err = os.WriteFile(tempPrivateKeyPath, []byte(keyPair.PrivateKey), 0600)
if err != nil {
    t.Fatalf("Failed to write private key to file: %v", err)
}
defer func() {
    _ = os.Remove(tempPrivateKeyPath)
}()
```

### Step 5: Asynchronous Apply & Bulletproof Cleanup Deferral
Start the Terraform Apply in a background goroutine and register a deferred `terraform.Destroy` block *immediately* afterward:

```go
applyErrChan := make(chan error, 1)
go func() {
    _, applyErr := terraform.InitAndApplyE(t, terraformOptions)
    applyErrChan <- applyErr
}()

// Cleanup AWS resources on test exit (crucial to prevent orphaned resources)
defer func() {
    t.Log("Tearing down AWS Test Relay resources...")
    terraform.Destroy(t, terraformOptions)
}()
```

### Step 6: Fast Early-Failure Detection (The Select Polling Loop)
**CRITICAL:** When waiting for the AWS VM to boot and write `server_info.json`, you must NOT use a simple `time.Sleep` loop. If the Terraform apply fails early (e.g., due to networking, AWS service quota, or file copy issues), a sleep loop will hang for the full timeout (e.g., 5 minutes) and exceed the global test runner timeout. This causes the test runner to SIGKILL the process, bypassing the deferred `terraform.Destroy` and leaving orphaned AWS resources.

Instead, implement a select-based polling loop that monitors both `applyErrChan` and a ticker:

```go
t.Log("Waiting for AWS server to boot and write server_info.json...")
var serverInfo struct {
    IP   string `json:"ip"`
    User string `json:"user"`
}
bootTimeout := 5 * time.Minute
bootStartTime := time.Now()
booted := false

bootTicker := time.NewTicker(2 * time.Second)
defer bootTicker.Stop()

Loop:
for time.Since(bootStartTime) < bootTimeout {
    select {
    case err := <-applyErrChan:
        // Detect early provisioning failure and exit immediately to trigger teardown
        if err == nil {
            t.Fatalf("FAIL: Terraform apply completed early without error, but server_info.json was not created.")
        } else {
            t.Fatalf("FAIL: Terraform apply failed early: %v", err)
        }
    case <-bootTicker.C:
        content, err := os.ReadFile(serverInfoPath)
        if err == nil {
            err = json.Unmarshal(content, &serverInfo)
            if err == nil && serverInfo.IP != "" && serverInfo.User != "" {
                booted = true
                break Loop
            }
        }
    }
}

if !booted {
    t.Fatalf("Timeout reached waiting for AWS server to boot and write server_info.json")
}
```

### Step 7: Remote Monitoring & Control
Once the server is booted, the test can run process monitoring loops via SSH commands to extract performance statistics and thread wait channels (WCHAN) or trigger native signals:

```go
// Run SSH commands remotely to find and monitor the process
cmd := exec.Command("ssh", "-i", keyPath, "-o", "StrictHostKeyChecking=no", fmt.Sprintf("%s@%s", user, ip), "pgrep ^terraform-prov")
output, err := cmd.Output()
```

---

## 6. The Orchestrator Engine (`test/test_relay/orchestrator`)

At the core of the multi-step remote deployments is the **Orchestrator Engine** located in `test/test_relay/orchestrator/`.

The Orchestrator is a reusable Terraform module that utilizes the provider's own `file_local`, `file_local_directory`, and `file_local_snapshot` resources to orchestrate other nested Terraform deployments.

### Key Orchestration Mechanics
*   **State Persistence Across Boundaries:**
    *   It uses `file_local_snapshot` to capture a base64 encoded snapshot of the nested Terraform state file (`tfstate`) and outputs (`outputs.json`).
    *   If the local workspace undergoes modification or moves across physical machines, the state is safely reconstructed on the next apply from the base64 snapshot string stored inside the parent Terraform state.
*   **Create and Destroy Lifecycle Scripts:**
    *   It programmatically renders `create.sh` and `destroy.sh` scripts using Terraform templates.
    *   The `destroy` script is invoked via a `terraform_data` destroy-time provisioner:
        ```hcl
        provisioner "local-exec" {
          when    = destroy
          command = "${self.triggers_replace.dp}/destroy.sh"
        }
        ```
    *   This guarantees that nested resources are cleanly deleted in the reverse order before the parent orchestrator wraps up.
