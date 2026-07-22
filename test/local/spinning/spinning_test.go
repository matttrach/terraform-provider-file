package spinning

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/gruntwork-io/terratest/modules/ssh"
	"github.com/gruntwork-io/terratest/modules/terraform"
	util "github.com/rancher/terraform-provider-file/test"
)

// TestLocalSpinningConcurrency validates the high-concurrency behavior locally.
// On non-vulnerable operating systems (like macOS), it is designed to fail if no lockup is found,
// acting as a true regression test.
func TestLocalSpinningConcurrency(t *testing.T) {
	t.Parallel()

	id := util.GetId()
	directory := "local_spinning"
	repoRoot, err := util.GetRepoRoot(t)
	if err != nil {
		t.Fatalf("Error getting git root directory: %v", err)
	}
	exampleDir := filepath.Join(repoRoot, "examples", "use-cases", directory)
	testDir := filepath.Join(repoRoot, "test", "data", id)

	err = util.Setup(t, id, "test/data")
	if err != nil {
		t.Log("Test failed, tearing down...")
		util.TearDown(t, testDir, &terraform.Options{})
		t.Fatalf("Error creating test data directories: %s", err)
	}
	statePath := filepath.Join(testDir, "tfstate")

	resourceCount := 40

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: exampleDir,
		Vars: map[string]interface{}{
			"directory":      testDir,
			"resource_count": resourceCount,
		},
		BackendConfig: map[string]interface{}{
			"path": statePath,
		},
		EnvVars: map[string]string{
			"TF_DATA_DIR":         testDir,
			"TF_CLI_CONFIG_FILE":  filepath.Join(repoRoot, "test", ".terraformrc"),
			"TF_IN_AUTOMATION":    "1",
			"TF_CLI_ARGS_init":    "-no-color",
			"TF_CLI_ARGS_plan":    "-no-color",
			"TF_CLI_ARGS_apply":   "-no-color",
			"TF_CLI_ARGS_destroy": "-no-color",
			"TF_CLI_ARGS_output":  "-no-color",
		},
		Parallelism:              resourceCount,
		RetryableTerraformErrors: util.GetRetryableTerraformErrors(),
		NoColor:                  true,
		Upgrade:                  true,
	})

	// Start terraform Init and Apply asynchronously in a background goroutine
	applyErrChan := make(chan error, 1)
	go func() {
		_, applyErr := terraform.InitAndApplyE(t, terraformOptions)
		applyErrChan <- applyErr
	}()

	// Monitor the provider process to verify high CPU lockup (Go 1.26 Scheduler/gRPC deadlock)
	detectedLockup := false
	timeout := 45 * time.Second
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	startTime := time.Now()

	for time.Since(startTime) < timeout {
		select {
		case err := <-applyErrChan:
			// If the apply finished without us detecting high CPU or killing the process
			if err == nil {
				util.TearDown(t, testDir, terraformOptions)
				t.Fatalf("FAIL: Terraform apply succeeded but NO CPU lockup was detected! The Go 1.26 scheduler spinning bug did not reproduce.")
			} else {
				util.TearDown(t, testDir, terraformOptions)
				t.Fatalf("FAIL: Terraform apply failed early with error: %v (no CPU lockup detected)", err)
			}
		case <-ticker.C:
			pid, err := findProviderPID()
			if err != nil {
				continue
			}

			cpu, err := getProcessCPU(pid)
			if err != nil {
				t.Logf("Failed to retrieve CPU usage for PID %d: %v", pid, err)
				continue
			}

			t.Logf("Monitoring: found provider PID %d, CPU usage: %.1f%%", pid, cpu)

			if cpu > 40.0 {
				t.Logf("WARNING: High CPU detected (%.1f%%) on provider PID %d! Verifying sustained lockup...", cpu, pid)

				time.Sleep(2 * time.Second)
				cpu2, err := getProcessCPU(pid)
				if err == nil && cpu2 > 40.0 {
					t.Logf("SUCCESS: Sustained CPU lockup confirmed! CPU usage was %.1f%%, now %.1f%%", cpu, cpu2)
					detectedLockup = true

					t.Logf("Sending SIGQUIT (signal 3) to PID %d to generate goroutine traces...", pid)
					_ = syscall.Kill(pid, syscall.SIGQUIT)
					time.Sleep(500 * time.Millisecond)

					t.Logf("Killing provider process %d with SIGKILL (signal 9)...", pid)
					_ = syscall.Kill(pid, syscall.SIGKILL)
					break
				}
			}
		}
		if detectedLockup {
			break
		}
	}

	if !detectedLockup {
		util.TearDown(t, testDir, terraformOptions)
		t.Fatalf("FAIL: Timeout of %v reached and NO CPU lockup/spinning was detected! Go 1.26 bug did not reproduce.", timeout)
	}

	t.Log("SUCCESS: Go 1.26 Scheduler/gRPC spinning deadlock successfully reproduced, validated, and terminated.")
	util.TearDown(t, testDir, terraformOptions)
}

// TestAWSRelaySpinningConcurrency deploys the simplified AWS test relay,
// transfers precompiled binaries, and monitors remote CPU lockup remotely over SSH.
func TestAWSRelaySpinningConcurrency(t *testing.T) {
	t.Parallel()

	id := util.GetId()
	repoRoot, err := util.GetRepoRoot(t)
	if err != nil {
		t.Fatalf("Error getting git root directory: %v", err)
	}
	testRelayDir := filepath.Join(repoRoot, "test", "test_relay")
	serverInfoPath := filepath.Join(testRelayDir, "server_info.json")
	tempPrivateKeyPath := filepath.Join(testRelayDir, fmt.Sprintf("id_rsa_temp_%s", id))

	// 1. Generate SSH Keypair using Terratest's built-in module
	t.Log("Generating temporary SSH key pair using Terratest...")
	keyPair := ssh.GenerateRSAKeyPair(t, 2048)

	// 2. Start an in-memory SSH Agent using Terratest
	t.Log("Starting in-memory SSH Agent...")
	sshAgent := ssh.SshAgentWithKeyPair(t, keyPair)
	defer sshAgent.Stop()

	// Write private key to file with 0600 permissions so local SSH commands can use it
	err = os.WriteFile(tempPrivateKeyPath, []byte(keyPair.PrivateKey), 0600)
	if err != nil {
		t.Fatalf("Failed to write private key to file: %v", err)
	}

	// Clean up stale files on test exit
	defer func() {
		t.Log("Cleaning up temporary local files...")
		_ = os.Remove(tempPrivateKeyPath)
		_ = os.Remove(serverInfoPath)
	}()

	// 3. Set up Terratest options propagating SSH_AUTH_SOCK and dynamically generated keys
	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: testRelayDir,
		Vars: map[string]interface{}{
			"identifier":       fmt.Sprintf("val-%s", id),
			"public_key":       keyPair.PublicKey,
			"private_key_path": tempPrivateKeyPath,
		},
		EnvVars: map[string]string{
			"SSH_AUTH_SOCK": sshAgent.SocketFile(),
		},
		NoColor: true,
		Upgrade: true,
	})

	// Clean up any stale server info file
	_ = os.Remove(serverInfoPath)

	// Start terraform apply asynchronously in a background goroutine
	applyErrChan := make(chan error, 1)
	go func() {
		_, applyErr := terraform.InitAndApplyE(t, terraformOptions)
		applyErrChan <- applyErr
	}()

	// Cleanup AWS resources on test exit
	defer func() {
		t.Log("Tearing down AWS Test Relay resources...")
		terraform.Destroy(t, terraformOptions)
	}()

	// 4. Poll and wait for server_info.json to be created by Terraform local_file resource
	t.Log("Waiting for AWS server to boot and write server_info.json...")
	var serverInfo struct {
		IP   string `json:"ip"`
		User string `json:"user"`
	}
	bootTimeout := 5 * time.Minute
	bootStartTime := time.Now()
	booted := false

	for time.Since(bootStartTime) < bootTimeout {
		content, err := os.ReadFile(serverInfoPath)
		if err == nil {
			err = json.Unmarshal(content, &serverInfo)
			if err == nil && serverInfo.IP != "" && serverInfo.User != "" {
				booted = true
				break
			}
		}
		time.Sleep(2 * time.Second)
	}

	if !booted {
		t.Fatalf("Timeout reached waiting for AWS server to boot and write server_info.json")
	}

	t.Logf("AWS Server Booted successfully! IP: %s, User: %s", serverInfo.IP, serverInfo.User)

	// 5. Monitor the remote provider process to verify CPU lockup and Futex blocks
	detectedLockup := false
	monitorTimeout := 5 * time.Minute
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	monitorStartTime := time.Now()

	for time.Since(monitorStartTime) < monitorTimeout {
		select {
		case err := <-applyErrChan:
			if err == nil {
				t.Fatalf("FAIL: Remote test completed successfully but NO remote CPU lockup was detected!")
			} else {
				t.Fatalf("FAIL: Remote apply failed early with error: %v (no lockup detected)", err)
			}
		case <-ticker.C:
			pid, err := remoteFindProviderPID(t, serverInfo.User, serverInfo.IP, tempPrivateKeyPath)
			if err != nil {
				// Provider has not started executing the test yet, keep waiting
				continue
			}

			cpu, err := remoteGetProcessCPU(t, serverInfo.User, serverInfo.IP, tempPrivateKeyPath, pid)
			if err != nil {
				t.Logf("Failed to retrieve remote CPU usage: %v", err)
				continue
			}

			t.Logf("[Remote Monitor] Provider PID: %d, CPU: %.1f%%", pid, cpu)

			if cpu > 40.0 {
				t.Logf("WARNING: High remote CPU detected (%.1f%%) on PID %d! Confirming lockup...", cpu, pid)

				// Verify sustained spinning
				time.Sleep(3 * time.Second)
				cpu2, err := remoteGetProcessCPU(t, serverInfo.User, serverInfo.IP, tempPrivateKeyPath, pid)
				if err == nil && cpu2 > 40.0 {
					t.Logf("SUCCESS: Remote CPU lockup confirmed! Sustained CPU usage: %.1f%% -> %.1f%%", cpu, cpu2)

					// Retrieve and print thread-level Wait Channels (WCHAN) to validate futex locking/blocks
					wchan, err := remoteGetProcessWchan(t, serverInfo.User, serverInfo.IP, tempPrivateKeyPath, pid)
					if err == nil {
						t.Logf("[Remote Monitor] Thread Wait Channels (WCHAN) verifying futex blocks:\n%s", wchan)
					} else {
						t.Logf("Failed to retrieve thread wait channels: %v", err)
					}

					detectedLockup = true

					// Force a remote goroutine dump
					t.Logf("Sending SIGQUIT (signal 3) to remote provider PID %d to generate traces...", pid)
					remoteKillProcess(t, serverInfo.User, serverInfo.IP, tempPrivateKeyPath, pid, 3)
					time.Sleep(1 * time.Second)

					// Terminate the remote lockup so the remote script can exit and apply can wrap up
					t.Logf("Killing remote provider PID %d to unblock apply...", pid)
					remoteKillProcess(t, serverInfo.User, serverInfo.IP, tempPrivateKeyPath, pid, 9)
					break
				}
			}
		}
		if detectedLockup {
			break
		}
	}

	if !detectedLockup {
		t.Fatalf("FAIL: Timeout of %v reached and NO remote CPU lockup was detected!", monitorTimeout)
	}

	// Wait for the background apply to fully exit (which it will now do since we killed the remote process)
	t.Log("Waiting for remote apply to fully terminate...")
	<-applyErrChan

	t.Log("SUCCESS: Remote Go 1.26 Scheduler/gRPC spinning deadlock successfully verified on AWS!")
}

// findProviderPID searches the process list for the file provider plugin process.
func findProviderPID() (int, error) {
	// We search for process names starting with "terraform-prov" to uniquely match the executed binary
	// and completely avoid matching the "go build" compiler process.
	cmd := exec.Command("pgrep", "^terraform-prov")
	output, err := cmd.Output()
	if err != nil {
		return 0, err
	}
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	if len(lines) == 0 || lines[0] == "" {
		return 0, fmt.Errorf("provider process not found")
	}
	return strconv.Atoi(strings.TrimSpace(lines[0]))
}

// getProcessCPU retrieves the current CPU utilization of a PID using ps.
func getProcessCPU(pid int) (float64, error) {
	cmd := exec.Command("ps", "-p", strconv.Itoa(pid), "-o", "%cpu")
	output, err := cmd.Output()
	if err != nil {
		return 0, err
	}
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	if len(lines) < 2 {
		return 0, fmt.Errorf("unexpected ps output format: %s", string(output))
	}
	val := strings.TrimSpace(lines[1])
	if val == "" {
		return 0, fmt.Errorf("no cpu value found in ps output")
	}
	return strconv.ParseFloat(val, 64)
}

func remoteFindProviderPID(t *testing.T, user, ip, keyPath string) (int, error) {
	// We search for process names starting with "terraform-prov" to uniquely match the executed binary
	// and completely avoid matching the "go build" compiler process.
	cmd := exec.Command("ssh", "-i", keyPath, "-o", "StrictHostKeyChecking=no", fmt.Sprintf("%s@%s", user, ip), "pgrep ^terraform-prov")
	output, err := cmd.Output()
	if err != nil {
		return 0, err
	}
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	if len(lines) == 0 || lines[0] == "" {
		t.Logf("Remote provider process not found on %s@%s", user, ip)
		return 0, fmt.Errorf("remote provider process not found")
	}
	return strconv.Atoi(strings.TrimSpace(lines[0]))
}

func remoteGetProcessCPU(t *testing.T, user, ip, keyPath string, pid int) (float64, error) {
	cmd := exec.Command("ssh", "-i", keyPath, "-o", "StrictHostKeyChecking=no", fmt.Sprintf("%s@%s", user, ip), fmt.Sprintf("ps -p %d -o %%cpu", pid))
	output, err := cmd.Output()
	if err != nil {
		return 0, err
	}
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	if len(lines) < 2 {
		t.Logf("Unexpected remote ps output for PID %d on %s@%s: %s", pid, user, ip, string(output))
		return 0, fmt.Errorf("unexpected remote ps output: %s", string(output))
	}
	val := strings.TrimSpace(lines[1])
	if val == "" {
		t.Logf("No CPU value found in remote ps output for PID %d on %s@%s", pid, user, ip)
		return 0, fmt.Errorf("no cpu value found in remote ps output")
	}
	return strconv.ParseFloat(val, 64)
}

func remoteGetProcessWchan(t *testing.T, user, ip, keyPath string, pid int) (string, error) {
	t.Logf("Retrieving thread-level wait channels (WCHAN) for remote PID %d on %s@%s", pid, user, ip)
	cmd := exec.Command("ssh", "-i", keyPath, "-o", "StrictHostKeyChecking=no", fmt.Sprintf("%s@%s", user, ip), fmt.Sprintf("ps -L -p %d -o lwp,wchan", pid))
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}

func remoteKillProcess(t *testing.T, user, ip, keyPath string, pid int, sig int) {
	t.Logf("Sending signal %d to remote PID %d on %s@%s", sig, pid, user, ip)
	cmd := exec.Command("ssh", "-i", keyPath, "-o", "StrictHostKeyChecking=no", fmt.Sprintf("%s@%s", user, ip), fmt.Sprintf("kill -%d %d", sig, pid))
	_ = cmd.Run()
}
