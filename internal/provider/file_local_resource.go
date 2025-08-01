// SPDX-License-Identifier: MPL-2.0

package provider

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"

	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringdefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/hashicorp/terraform-plugin-log/tflog"
)

// The `var _` is a special Go construct that results in an unusable variable.
// The purpose of these lines is to make sure our LocalFileResource correctly implements the `resource.Resource“ interface.
// These will fail at compilation time if the implementation is not satisfied.
var _ resource.Resource = &LocalResource{}
var _ resource.ResourceWithImportState = &LocalResource{}

func NewLocalResource() resource.Resource {
	return &LocalResource{}
}

// LocalResource defines the resource implementation.
// This facilitates the LocalResource class, it can now be used in functions with *LocalResource.
type LocalResource struct{}

// LocalResourceModel describes the resource data model.
type LocalResourceModel struct {
	Name          types.String `tfsdk:"name"`
	Contents      types.String `tfsdk:"contents"`
	Directory     types.String `tfsdk:"directory"`
	Mode          types.String `tfsdk:"mode"`
	HmacSecretKey types.String `tfsdk:"hmac_secret_key"`
	Id            types.String `tfsdk:"id"`
}

func (r *LocalResource) Metadata(ctx context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_local" // file_local resource
}

func (r *LocalResource) Schema(ctx context.Context, req resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Local File resource",

		Attributes: map[string]schema.Attribute{
			"name": schema.StringAttribute{
				MarkdownDescription: "File name, required.",
				Required:            true,
			},
			"contents": schema.StringAttribute{
				MarkdownDescription: "File contents, required.",
				Required:            true,
			},
			"directory": schema.StringAttribute{
				MarkdownDescription: "The directory where the file will be placed, defaults to the current working directory.",
				Optional:            true,
				Computed:            true, // whenever an argument has a default value it should have Computed: true
				Default:             stringdefault.StaticString("."),
			},
			"mode": schema.StringAttribute{
				MarkdownDescription: "The file permissions to assign to the file, defaults to '0600'.",
				Optional:            true,
				Computed:            true,
				Default:             stringdefault.StaticString("0600"),
			},
			"hmac_secret_key": schema.StringAttribute{
				MarkdownDescription: "A string used to generate the file identifier, " +
					"adding your own will improve the security of your implementation.\n" +
					"You can pass this value in the environment variable `TF_FILE_HMAC_SECRET_KEY`, " +
					"the environment variable will override what is placed in this argument.",
				Optional: true,
				Computed: true,
				Default:  stringdefault.StaticString("super-secret-key"),
			},
			"id": schema.StringAttribute{
				MarkdownDescription: "Identifier",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
		},
	}
}

// Configure the provider for the resource if necessary.
func (r *LocalResource) Configure(ctx context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	// Prevent panic if the provider has not been configured.
	if req.ProviderData == nil {
		return
	}
}

func (r *LocalResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	tflog.Debug(ctx, fmt.Sprintf("Request Object: %v", req))
	var data LocalResourceModel

	// Set up diagnostics and fill data with plan data.
	resp.Diagnostics.Append(req.Plan.Get(ctx, &data)...)
	if resp.Diagnostics.HasError() {
		return
	}
	name := data.Name.ValueString()
	directory := data.Directory.ValueString()
	contents := data.Contents.ValueString()
	modeString := data.Mode.ValueString()
	hmacSecretKey := data.HmacSecretKey.ValueString()
	localFilePath := filepath.Join(directory, name)
	modeInt, err := strconv.ParseUint(modeString, 8, 32)
	if err != nil {
		tflog.Error(ctx, "Error reading file mode: "+err.Error())
		return
	}

	if err = os.WriteFile(localFilePath, []byte(contents), os.FileMode(modeInt)); err != nil {
		tflog.Error(ctx, "Error writing file: "+err.Error())
		return
	}

	// Generate a secure unique ID for the file //
	id, err := calculateId(localFilePath, hmacSecretKey)
	if err != nil {
		tflog.Error(ctx, "Error generating file id: "+err.Error())
		return
	}
	data.Id = types.StringValue(id)
	resp.Diagnostics.Append(resp.State.Set(ctx, &data)...)
	tflog.Debug(ctx, fmt.Sprintf("Response Object: %v", *resp))
}

// Some objects in Terraform can't be fully owned by the config.
// When objects can't be owned by Terraform the read function updates the Terraform state.
// In this case, for now, we expect the file not to change without our knowledge.
// That means we don't need to read the file's contents or anything like that.
func (r *LocalResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	tflog.Debug(ctx, fmt.Sprintf("Request Object: %v", req))

	var state LocalResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}
	// sName      := state.Name.ValueString()
	// sDirectory := state.Directory.ValueString()

	// // If the file doesn't exist on disk, then we need to (re)create it
	// if _, err := os.Stat(filepath.Join(directory, name)); os.IsNotExist(err) {
	// 	resp.State.RemoveResource(ctx)
	// 	return
	// }

	// If Possible, we should avoid reading the file into memory (tell don't ask)

	// // If the contents doesn't match what we have in state, then we need to (re)create
	// contents, err := os.ReadFile(filepath.Join(directory, name))
	// if err != nil {
	//   tflog.Error(ctx, "Error reading file: " + err.Error())
	//   return
	// }
	// if string(contents) != data.Contents.ValueString() {
	//   resp.State.RemoveResource(ctx)
	//   return
	// }

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
	tflog.Debug(ctx, fmt.Sprintf("Response Object: %v", *resp))
}

// For now, we are assuming Terraform has complete control over the file
// This means we don't need know anything about the actual file for updates, we just change the file if the plan doesn't match the state.
// The plan has the authority here, state and reality needs to match the plan.
func (r *LocalResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	tflog.Debug(ctx, fmt.Sprintf("Request Object: %v", req))

	var plan LocalResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}
	pName := plan.Name.ValueString()
	pDirectory := plan.Directory.ValueString()
	pMode := plan.Mode.ValueString()
	pContents := plan.Contents.ValueString()
	pFilePath := filepath.Join(pDirectory, pName)

	var state LocalResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}
	sName := state.Name.ValueString()
	sDirectory := state.Directory.ValueString()
	sMode := state.Mode.ValueString()
	sContents := state.Contents.ValueString()
	sFilePath := filepath.Join(sDirectory, sName)

	// If the plan's path doesn't match what is in state then we should move the file to its new path and update the state.
	if pFilePath != sFilePath {
		if err := os.Rename(sFilePath, pFilePath); err != nil {
			tflog.Error(ctx, "Error moving file: "+err.Error())
			return
		}
		if sName != pName {
			state.Name = types.StringValue(pName)
		}
		if sDirectory != pDirectory {
			state.Directory = types.StringValue(pDirectory)
		}
	}

	// If the plan's mode doesn't match what is in state then we should change the file's mode and update the state.
	if pMode != sMode {
		modeInt, err := strconv.ParseUint(pMode, 8, 32)
		if err != nil {
			tflog.Error(ctx, "Error reading file mode: "+err.Error())
			return
		}
		if err := os.Chmod(pFilePath, os.FileMode(modeInt)); err != nil {
			tflog.Error(ctx, "Error changing file mode: "+err.Error())
			return
		}
		state.Mode = types.StringValue(pMode)
	}

	// If the plan's contents don't match what is in state then we should write the new content to the file and update the state.
	if pContents != sContents {
		modeInt, err := strconv.ParseUint(pMode, 8, 32)
		if err != nil {
			tflog.Error(ctx, "Error reading file mode: "+err.Error())
			return
		}
		if err = os.WriteFile(pFilePath, []byte(pContents), os.FileMode(modeInt)); err != nil {
			tflog.Error(ctx, "Error writing file: "+err.Error())
			return
		}
		state.Contents = types.StringValue(pContents)
	}

	// Save updated state into Terraform state.
	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
	tflog.Debug(ctx, fmt.Sprintf("Response Object: %v", *resp))
}

func (r *LocalResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	tflog.Debug(ctx, fmt.Sprintf("Request Object: %v", req))

	var state LocalResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	name := state.Name.ValueString()
	directory := state.Directory.ValueString()
	localFilePath := filepath.Join(directory, name)
	if err := os.Remove(localFilePath); err != nil {
		tflog.Error(ctx, fmt.Sprintf("Failed to delete file %s: %v", localFilePath, err))
		resp.Diagnostics.AddError(
			"File Deletion Failed",
			fmt.Sprintf("Failed to delete file %s: %v", localFilePath, err),
		)
		return
	}

	tflog.Debug(ctx, fmt.Sprintf("Response Object: %v", *resp))
}

func (r *LocalResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

// **** Internal Functions **** //

// generates an HMAC-SHA256 hash of a file using a secret key.
func calculateId(filePath string, hmacSecretKey string) (string, error) {
	// env overrides the config
	secureKey := os.Getenv("TF_FILE_HMAC_SECRET_KEY")
	if secureKey == "" {
		// the hmac_secret_key argument has a default value, so it can't be null
		secureKey = hmacSecretKey
	}
	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open file for generating hmac: %w", err)
	}
	defer file.Close()
	hasher := hmac.New(sha256.New, []byte(secureKey))
	// Copy the file contents to the hasher without reading it into memory.
	if _, err := io.Copy(hasher, file); err != nil {
		return "", fmt.Errorf("failed to copy file content to hmac hasher: %w", err)
	}
	hmacHash := hex.EncodeToString(hasher.Sum(nil))
	return hmacHash, nil
}
