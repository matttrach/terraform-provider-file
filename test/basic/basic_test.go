// Copyright (c) HashiCorp, Inc.

package basic

import (
	"path/filepath"
	"testing"

	"github.com/gruntwork-io/terratest/modules/terraform"
	util "github.com/matttrach/terraform-provider-file/test"
)

func TestBasic(t *testing.T) {
	t.Parallel()
	id := util.GetId()
	directory := "basic"
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
	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: exampleDir,
		Vars:         map[string]interface{}{},
		BackendConfig: map[string]interface{}{
			"path": statePath,
		},
		EnvVars: map[string]string{
			"TF_DATA_DIR":         testDir,
			"REPO_ROOT":           repoRoot,
			"TF_IN_AUTOMATION":    "1",
			"TF_CLI_ARGS_init":    "-no-color",
			"TF_CLI_ARGS_plan":    "-no-color",
			"TF_CLI_ARGS_apply":   "-no-color",
			"TF_CLI_ARGS_destroy": "-no-color",
			"TF_CLI_ARGS_output":  "-no-color",
		},
		RetryableTerraformErrors: util.GetRetryableTerraformErrors(),
		NoColor:                  true,
		Upgrade:                  true,
	})

	_, err = terraform.InitAndApplyE(t, terraformOptions)
	if err != nil {
		t.Log("Test failed, tearing down...")
		util.TearDown(t, testDir, terraformOptions)
		t.Fatalf("Error creating cluster: %s", err)
	}

	if t.Failed() {
		t.Log("Test failed...")
	} else {
		t.Log("Test passed...")
	}
	util.TearDown(t, testDir, terraformOptions)
}
