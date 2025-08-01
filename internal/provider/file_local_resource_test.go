// SPDX-License-Identifier: MPL-2.0

package provider

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/tfsdk"
	"github.com/hashicorp/terraform-plugin-go/tftypes"
)

const (
	contents        = "A file to test on."
	updatedContents = "This is the updated file contents."
	directory       = "."
	hmac_secret_key = "super-secret-key"
	mode            = "0600"
	name            = "temp.txt"
	id              = "8496b882326f1bc931dc8b8d305898a62f56cd4729236df515be35f393ee8b9c"
)

func TestLocalResourceMetadata(t *testing.T) {
	t.Run("Metadata function", func(t *testing.T) {
		testCases := []struct {
			name string
			fit  LocalResource
			want resource.MetadataResponse
		}{
			{"Basic test", LocalResource{}, resource.MetadataResponse{TypeName: "file_local"}},
		}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				res := resource.MetadataResponse{}
				tc.fit.Metadata(context.Background(), resource.MetadataRequest{ProviderTypeName: "file"}, &res)
				got := res
				if got != tc.want {
					t.Errorf("%#v.Metadata() is %v; want %v", tc.fit, got, tc.want)
				}
			})
		}
	})
}

func TestLocalResourceCreate(t *testing.T) {
	t.Run("Create function", func(t *testing.T) {
		testCases := []struct {
			name string
			fit  LocalResource
			want resource.CreateResponse
		}{
			{"Basic test", LocalResource{}, getCreateResponse()},
		}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				r := getCreateResponseContainer()
				tc.fit.Create(context.Background(), getCreateRequest(), &r)
				defer teardown()
				got := r
				if diff := cmp.Diff(tc.want, got); diff != "" {
					t.Errorf("Create() mismatch (-want +got):\n%s", diff)
				}
			})
		}
	})
}

func TestLocalResourceRead(t *testing.T) {
	t.Run("Read function", func(t *testing.T) {
		testCases := []struct {
			name string
			fit  LocalResource
			want resource.ReadResponse
		}{
			{"Basic test", LocalResource{}, getReadResponse()},
		}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				setup()
				defer teardown()
				r := getReadResponseContainer()
				tc.fit.Read(context.Background(), getReadRequest(), &r)
				got := r
				if diff := cmp.Diff(tc.want, got); diff != "" {
					t.Errorf("Read() mismatch (-want +got):\n%s", diff)
				}
			})
		}
	})
}

func TestLocalResourceUpdate(t *testing.T) {
	t.Run("Update function", func(t *testing.T) {
		testCases := []struct {
			name string
			fit  LocalResource
			want resource.UpdateResponse
		}{
			{"Basic test", LocalResource{}, getUpdateResponse()},
		}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				setup()
				defer teardown()
				r := getUpdateResponseContainer()
				tc.fit.Update(context.Background(), getUpdateRequest(), &r)
				got := r
				updatedFileBytes, err := os.ReadFile(filepath.Join(directory, name))
				if err != nil {
					t.Fatalf("Failed to read file for update verification: %s", err)
				}
				if string(updatedFileBytes) != updatedContents {
					t.Errorf("File content was not updated correctly. Got %q, want %q", string(updatedFileBytes), updatedContents)
				}
				if diff := cmp.Diff(tc.want, got); diff != "" {
					t.Errorf("Update() mismatch (-want +got):\n%s", diff)
				}
			})
		}
	})
}

func TestLocalResourceDelete(t *testing.T) {
	t.Run("Delete function", func(t *testing.T) {
		testCases := []struct {
			name string
			fit  LocalResource
			want resource.DeleteResponse
		}{
			{"Basic test", LocalResource{}, getDeleteResponse()},
		}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				setup()
				r := getDeleteResponseContainer()
				tc.fit.Delete(context.Background(), getDeleteRequest(), &r)
				got := r
				// Verify the file was actually deleted from disk
				if _, err := os.Stat(filepath.Join(directory, name)); !os.IsNotExist(err) {
					t.Errorf("Expected file to be deleted, but it still exists.")
				}
				if diff := cmp.Diff(tc.want, got); diff != "" {
					t.Errorf("Delete() mismatch (-want +got):\n%s", diff)
				}
			})
		}
	})
}

// *** Test Helper Functions *** //

// --- Response Containers ---

func getCreateResponseContainer() resource.CreateResponse {
	return resource.CreateResponse{
		State: tfsdk.State{Schema: getLocalResourceSchema().Schema},
	}
}

func getReadResponseContainer() resource.ReadResponse {
	return resource.ReadResponse{
		State: tfsdk.State{Schema: getLocalResourceSchema().Schema},
	}
}

func getUpdateResponseContainer() resource.UpdateResponse {
	return resource.UpdateResponse{
		State: tfsdk.State{Schema: getLocalResourceSchema().Schema},
	}
}

func getDeleteResponseContainer() resource.DeleteResponse {
	// A delete response does not need a schema as it results in a null state.
	return resource.DeleteResponse{}
}

// --- Expected Responses ---

func getCreateResponse() resource.CreateResponse {
	stateMap := map[string]tftypes.Value{
		"contents":        tftypes.NewValue(tftypes.String, contents),
		"directory":       tftypes.NewValue(tftypes.String, directory),
		"hmac_secret_key": tftypes.NewValue(tftypes.String, hmac_secret_key),
		"id":              tftypes.NewValue(tftypes.String, id),
		"mode":            tftypes.NewValue(tftypes.String, mode),
		"name":            tftypes.NewValue(tftypes.String, name),
	}
	stateValue := tftypes.NewValue(getObjectAttributeTypes(), stateMap)
	return resource.CreateResponse{
		Diagnostics: diag.Diagnostics{},
		State: tfsdk.State{
			Raw:    stateValue,
			Schema: getLocalResourceSchema().Schema,
		},
	}
}

func getReadResponse() resource.ReadResponse {
	stateMap := map[string]tftypes.Value{
		"contents":        tftypes.NewValue(tftypes.String, contents),
		"directory":       tftypes.NewValue(tftypes.String, directory),
		"hmac_secret_key": tftypes.NewValue(tftypes.String, hmac_secret_key),
		"id":              tftypes.NewValue(tftypes.String, id),
		"mode":            tftypes.NewValue(tftypes.String, mode),
		"name":            tftypes.NewValue(tftypes.String, name),
	}
	stateValue := tftypes.NewValue(getObjectAttributeTypes(), stateMap)
	return resource.ReadResponse{
		Diagnostics: diag.Diagnostics{},
		State: tfsdk.State{
			Raw:    stateValue,
			Schema: getLocalResourceSchema().Schema,
		},
	}
}

func getUpdateResponse() resource.UpdateResponse {
	// The response should contain the new, updated state values.
	stateMap := map[string]tftypes.Value{
		"id":              tftypes.NewValue(tftypes.String, id),
		"name":            tftypes.NewValue(tftypes.String, name),
		"directory":       tftypes.NewValue(tftypes.String, directory),
		"mode":            tftypes.NewValue(tftypes.String, mode),
		"contents":        tftypes.NewValue(tftypes.String, updatedContents),
		"hmac_secret_key": tftypes.NewValue(tftypes.String, hmac_secret_key),
	}
	stateValue := tftypes.NewValue(getObjectAttributeTypes(), stateMap)
	return resource.UpdateResponse{
		Diagnostics: diag.Diagnostics{},
		State: tfsdk.State{
			Raw:    stateValue,
			Schema: getLocalResourceSchema().Schema,
		},
	}
}

func getDeleteResponse() resource.DeleteResponse {
	return resource.DeleteResponse{
		Diagnostics: diag.Diagnostics{},
		State: tfsdk.State{
			Raw:    tftypes.Value{},
			Schema: nil,
		},
	}
}

// --- Requests ---

func getCreateRequest() resource.CreateRequest {
	planMap := map[string]tftypes.Value{
		"id":              tftypes.NewValue(tftypes.String, tftypes.UnknownValue), // ID is unknown before creation
		"name":            tftypes.NewValue(tftypes.String, name),
		"directory":       tftypes.NewValue(tftypes.String, directory),
		"mode":            tftypes.NewValue(tftypes.String, mode),
		"contents":        tftypes.NewValue(tftypes.String, contents),
		"hmac_secret_key": tftypes.NewValue(tftypes.String, hmac_secret_key),
	}
	planValue := tftypes.NewValue(getObjectAttributeTypes(), planMap)

	return resource.CreateRequest{
		Plan: tfsdk.Plan{
			Raw:    planValue,
			Schema: getLocalResourceSchema().Schema,
		},
	}
}

func getReadRequest() resource.ReadRequest {
	stateMap := map[string]tftypes.Value{
		"id":              tftypes.NewValue(tftypes.String, id),
		"name":            tftypes.NewValue(tftypes.String, name),
		"directory":       tftypes.NewValue(tftypes.String, directory),
		"mode":            tftypes.NewValue(tftypes.String, mode),
		"contents":        tftypes.NewValue(tftypes.String, contents),
		"hmac_secret_key": tftypes.NewValue(tftypes.String, hmac_secret_key),
	}
	stateValue := tftypes.NewValue(getObjectAttributeTypes(), stateMap)

	return resource.ReadRequest{
		State: tfsdk.State{
			Raw:    stateValue,
			Schema: getLocalResourceSchema().Schema,
		},
	}
}

func getUpdateRequest() resource.UpdateRequest {
	priorStateMap := map[string]tftypes.Value{
		"id":              tftypes.NewValue(tftypes.String, id),
		"name":            tftypes.NewValue(tftypes.String, name),
		"directory":       tftypes.NewValue(tftypes.String, directory),
		"mode":            tftypes.NewValue(tftypes.String, mode),
		"contents":        tftypes.NewValue(tftypes.String, contents),
		"hmac_secret_key": tftypes.NewValue(tftypes.String, hmac_secret_key),
	}
	priorStateValue := tftypes.NewValue(getObjectAttributeTypes(), priorStateMap)

	// The new plan with updated values
	planMap := map[string]tftypes.Value{
		"contents":        tftypes.NewValue(tftypes.String, updatedContents),
		"directory":       tftypes.NewValue(tftypes.String, directory),
		"hmac_secret_key": tftypes.NewValue(tftypes.String, hmac_secret_key),
		"id":              tftypes.NewValue(tftypes.String, id), // ID is known from prior state
		"mode":            tftypes.NewValue(tftypes.String, mode),
		"name":            tftypes.NewValue(tftypes.String, name),
	}
	planValue := tftypes.NewValue(getObjectAttributeTypes(), planMap)

	return resource.UpdateRequest{
		State: tfsdk.State{
			Raw:    priorStateValue,
			Schema: getLocalResourceSchema().Schema,
		},
		Plan: tfsdk.Plan{
			Raw:    planValue,
			Schema: getLocalResourceSchema().Schema,
		},
	}
}

func getDeleteRequest() resource.DeleteRequest {
	// A Delete request is based on the last known state.
	stateMap := map[string]tftypes.Value{
		"contents":        tftypes.NewValue(tftypes.String, contents),
		"directory":       tftypes.NewValue(tftypes.String, directory),
		"hmac_secret_key": tftypes.NewValue(tftypes.String, hmac_secret_key),
		"id":              tftypes.NewValue(tftypes.String, id),
		"mode":            tftypes.NewValue(tftypes.String, mode),
		"name":            tftypes.NewValue(tftypes.String, name),
	}
	stateValue := tftypes.NewValue(getObjectAttributeTypes(), stateMap)
	return resource.DeleteRequest{
		State: tfsdk.State{
			Raw:    stateValue,
			Schema: getLocalResourceSchema().Schema,
		},
	}
}

// --- Generic Helpers ---

func getObjectAttributeTypes() tftypes.Object {
	return tftypes.Object{
		AttributeTypes: map[string]tftypes.Type{
			"contents":        tftypes.String,
			"directory":       tftypes.String,
			"hmac_secret_key": tftypes.String,
			"id":              tftypes.String,
			"mode":            tftypes.String,
			"name":            tftypes.String,
		},
	}
}

func getLocalResourceSchema() *resource.SchemaResponse {
	var testResource LocalResource
	r := &resource.SchemaResponse{}
	testResource.Schema(context.Background(), resource.SchemaRequest{}, r)
	return r
}

// func getId(contents string) string {
//   modeInt, _ := strconv.ParseUint(mode, 8, 32)
//   _ = os.WriteFile(filepath.Join(directory, name), []byte(contents), os.FileMode(modeInt))
//   defer os.Remove(filepath.Join(directory, name))
// 	hasher := hmac.New(sha256.New, []byte(hmac_secret_key))
//   file, _ := os.Open(filepath.Join(directory, name))
//   defer file.Close()
//   _, _ = io.Copy(hasher, file)
//   return hex.EncodeToString(hasher.Sum(nil))
// }

func setup() {
	modeInt, _ := strconv.ParseUint(mode, 8, 32)
	_ = os.WriteFile(filepath.Join(directory, name), []byte(contents), os.FileMode(modeInt))
}

func teardown() {
	os.Remove(filepath.Join(directory, name))
}
