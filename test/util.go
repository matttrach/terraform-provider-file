// Copyright (c) HashiCorp, Inc.

package test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/gruntwork-io/terratest/modules/git"
	"github.com/gruntwork-io/terratest/modules/random"
	"github.com/gruntwork-io/terratest/modules/terraform"
)

func Setup(t *testing.T, id string, testDirectory string) error {
	path, err := GetRepoRoot(t)
	if err != nil {
		return err
	}
	if err = os.Setenv("REPO_ROOT", path); err != nil {
		return err
	}
	return createTestDirectories(t, testDirectory, id)
}

func TearDown(t *testing.T, testDirectory string, options *terraform.Options) {
	directoryExists := true
	_, err := os.Stat(testDirectory)
	if err != nil {
		if os.IsNotExist(err) {
			directoryExists = false
		}
	}
	if directoryExists {
		_, err := terraform.DestroyE(t, options)
		if err != nil {
			t.Logf("Failed to destroy: %v", err)
		}
		err = os.RemoveAll(testDirectory)
		if err != nil {
			t.Logf("Failed to delete test data directory: %v", err)
		}
	}
	exampleDir := options.TerraformDir
	os.Remove(filepath.Join(exampleDir, ".terraform.lock.hcl"))
}

func GetRetryableTerraformErrors() map[string]string {
	retryableTerraformErrors := map[string]string{
		// The reason is unknown, but eventually these succeed after a few retries.
		".*unable to verify signature.*":             "Failed due to transient network error.",
		".*unable to verify checksum.*":              "Failed due to transient network error.",
		".*no provider exists with the given name.*": "Failed due to transient network error.",
		".*registry service is unreachable.*":        "Failed due to transient network error.",
		".*connection reset by peer.*":               "Failed due to transient network error.",
		".*TLS handshake timeout.*":                  "Failed due to transient network error.",
		".*http2: client connection lost.*":          "Failed due to transient network error.",
	}
	return retryableTerraformErrors
}

func createTestDirectories(t *testing.T, testDirectory string, id string) error {
	gwd := git.GetRepoRoot(t)
	fwd, err := filepath.Abs(gwd)
	if err != nil {
		return err
	}
	paths := []string{
		filepath.Join(fwd, testDirectory),
		filepath.Join(fwd, testDirectory, id),
	}
	for _, path := range paths {
		err = os.Mkdir(path, 0755)
		if err != nil && !os.IsExist(err) {
			return err
		}
	}
	return nil
}

func GetId() string {
	id := os.Getenv("IDENTIFIER")
	if id == "" {
		id = random.UniqueId()
	}
	id += "-" + random.UniqueId()
	return id
}

func GetOwner() string {
	owner := os.Getenv("OWNER")
	if owner == "" {
		owner = "terraform-ci@suse.com"
	}
	return owner
}

func GetRepoRoot(t *testing.T) (string, error) {
	return filepath.Abs(git.GetRepoRoot(t))
}
