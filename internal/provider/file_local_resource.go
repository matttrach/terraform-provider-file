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
// These will fail a compilation time if the implementation is not satisfied.
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

// Create the local file here.
func (r *LocalResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var data LocalResourceModel

	// Set up diagnostics and fill data with plan data.
	resp.Diagnostics.Append(req.Plan.Get(ctx, &data)...)
	if resp.Diagnostics.HasError() {
		return
	}

	localFilePath := filepath.Join(data.Directory.String(), data.Name.String())

	perm, err := strconv.ParseUint(data.Mode.String(), 8, 32)
	if err != nil {
		tflog.Error(ctx, "Error reading file mode: "+err.Error())
		return
	}
	fileMode := os.FileMode(perm)

	// Create the file here.
	err = os.WriteFile(
		localFilePath,
		[]byte(data.Contents.String()),
		fileMode,
	)
	if err != nil {
		tflog.Error(ctx, "Error writing file: "+err.Error())
		return
	}

	// Generate a secure unique ID for the file //

	// env overrides the config
	secureKey := os.Getenv("TF_FILE_HMAC_SECRET_KEY")
	if secureKey == "" {
		// the hmac_secret_key has a default value, so it can't be null after this
		secureKey = data.HmacSecretKey.String()
	}
	id, err := generateHMACFile(localFilePath, []byte(secureKey))
	if err != nil {
		tflog.Error(ctx, "Error generating file id: "+err.Error())
		return
	}

	data.Id = types.StringValue(id)

	tflog.Trace(ctx, "created file local resource")

	// Save data into Terraform state.
	resp.Diagnostics.Append(resp.State.Set(ctx, &data)...)
}

func (r *LocalResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var data LocalResourceModel

	// Read Terraform prior state data into the model.
	resp.Diagnostics.Append(req.State.Get(ctx, &data)...)

	if resp.Diagnostics.HasError() {
		return
	}

	// Save updated data into Terraform state.
	resp.Diagnostics.Append(resp.State.Set(ctx, &data)...)
}

func (r *LocalResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var data LocalResourceModel

	// Read Terraform plan data into the model.
	resp.Diagnostics.Append(req.Plan.Get(ctx, &data)...)
	if resp.Diagnostics.HasError() {
		return
	}

	// Update File Here

	// Save updated data into Terraform state.
	resp.Diagnostics.Append(resp.State.Set(ctx, &data)...)
}

func (r *LocalResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var data LocalResourceModel

	// Read Terraform prior state data into the model.
	resp.Diagnostics.Append(req.State.Get(ctx, &data)...)
	if resp.Diagnostics.HasError() {
		return
	}

	// Delete the file here
}

func (r *LocalResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

// **** Internal Functions **** //

// generates an HMAC-SHA256 hash of a file using a secret key.
func generateHMACFile(filePath string, key []byte) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open file for generating hmac: %w", err)
	}
	defer file.Close()
	hasher := hmac.New(sha256.New, key)
	// copy the file contents to the hasher without reading them into memory.
	if _, err := io.Copy(hasher, file); err != nil {
		return "", fmt.Errorf("failed to copy file content to hmac hasher: %w", err)
	}
	hmacHash := hex.EncodeToString(hasher.Sum(nil))
	return hmacHash, nil
}
