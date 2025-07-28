// Copyright (c) HashiCorp, Inc.

package basic

import (
	"path/filepath"
	"testing"

	"github.com/gruntwork-io/terratest/modules/git"
	"github.com/gruntwork-io/terratest/modules/terraform"
	util "github.com/matttrach/terraform-provider-file/test"
)

func TestBasic(t *testing.T) {
	t.Parallel()
	id := util.GetId()
	// owner := util.GetOwner()
	directory := "basic"
	repoRoot, err := filepath.Abs(git.GetRepoRoot(t))
	if err != nil {
		t.Fatalf("Error getting git root directory: %v", err)
	}
	exampleDir := repoRoot + "/examples/use-cases/" + directory
	testDir := repoRoot + "/test/data"

	err = util.Setup(t, id, "test/data")
	if err != nil {
		t.Log("Test failed, tearing down...")
		util.TearDown(t, testDir, &terraform.Options{})
		t.Fatalf("Error creating test data directories: %s", err)
	}

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: exampleDir,
		// Variables to pass to our Terraform code using -var options
		Vars: map[string]interface{}{
			// "identifier": id,
			// "owner":      owner,
		},
		// Environment variables to set when running Terraform
		EnvVars: map[string]string{
			"TF_DATA_DIR":         testDir,
			"TF_IN_AUTOMATION":    "1",
			"TF_CLI_ARGS_init":    "-no-color -backend-config=\"path=\"" + testDir + "\"",
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
