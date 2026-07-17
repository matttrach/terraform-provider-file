// SPDX-License-Identifier: MPL-2.0

package file_local_directory

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"

	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringdefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/hashicorp/terraform-plugin-log/tflog"
	c "github.com/rancher/terraform-provider-file/internal/provider/directory_client"
)

// The `var _` is a special Go construct that results in an unusable variable.
// The purpose of these lines is to make sure our LocalDirectoryFileResource correctly implements the `resource.Resource“ interface.
// These will fail at compilation time if the implementation is not satisfied.
var _ resource.Resource = &LocalDirectoryResource{}
var _ resource.ResourceWithImportState = &LocalDirectoryResource{}

func NewLocalDirectoryResource() resource.Resource {
	return &LocalDirectoryResource{
		client: &c.OsDirectoryClient{},
	}
}

type LocalDirectoryResource struct {
	client c.DirectoryClient
}

// LocalDirectoryResourceModel describes the resource data model.
type LocalDirectoryResourceModel struct {
	Id          types.String `tfsdk:"id"`
	Path        types.String `tfsdk:"path"`
	Permissions types.String `tfsdk:"permissions"`
	Created     types.String `tfsdk:"created"`
}

func (r *LocalDirectoryResource) Metadata(ctx context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_local_directory" // file_local_directory resource
}

func (r *LocalDirectoryResource) Schema(ctx context.Context, req resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Local Directory resource.",

		Attributes: map[string]schema.Attribute{
			"path": schema.StringAttribute{
				MarkdownDescription: "Directory path, required. All subdirectories will also be created. Changing this forces recreate.",
				Required:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"permissions": schema.StringAttribute{
				MarkdownDescription: "The directory permissions to assign to the directory, defaults to '0700'. " +
					"In order to automatically create subdirectories the owner must have execute access, " +
					"ie. '0600' or less prevents the provider from creating subdirectories.",
				Optional: true,
				Computed: true,
				Default:  stringdefault.StaticString("0700"),
			},
			"id": schema.StringAttribute{
				MarkdownDescription: "Identifier derived from sha256 hash of path. ",
				Computed:            true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"created": schema.StringAttribute{
				MarkdownDescription: "The top level directory created. " +
					"eg. if 'path' = '/path/to/new/directory' and '/path/to' already exists, " +
					"but the rest doesn't, then 'created' will be '/path/to/new'. " +
					"This path will be recursively removed during destroy and recreate actions.",
				Computed: true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
		},
	}
}

// Configure the provider for the resource if necessary.
func (r *LocalDirectoryResource) Configure(ctx context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	// Prevent panic if the provider has not been configured.
	if req.ProviderData == nil {
		return
	}
}

// We should:
// - generate reality and state in the Create function
// - update state to match reality in the Read function
// - update state to config and update reality to config in the Update function by looking for differences in the state and the config (trust read to collect reality)
// - destroy reality and state in the Destroy function

func (r *LocalDirectoryResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	tflog.Debug(ctx, fmt.Sprintf("Request Object: %#v", req))
	var err error

	var plan LocalDirectoryResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}
	path := plan.Path.ValueString()
	permString := plan.Permissions.ValueString()

	hasher := sha256.New()
	hasher.Write([]byte(path))
	id := hex.EncodeToString(hasher.Sum(nil))
	plan.Id = types.StringValue(id)

	cutPath, err := r.client.Create(path, permString)
	if err != nil {
		resp.Diagnostics.AddError("Error creating file: ", err.Error())
		return
	}
	plan.Created = types.StringValue(cutPath)

	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
	tflog.Debug(ctx, fmt.Sprintf("Response Object: %#v", *resp))
}

func (r *LocalDirectoryResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	tflog.Debug(ctx, fmt.Sprintf("Request Object: %#v", req))

	var state LocalDirectoryResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}
	sPath := state.Path.ValueString()
	sPerm := state.Permissions.ValueString()
	sCreated := state.Created.ValueString()
	sId := state.Id.ValueString()

	if (state.Id.IsUnknown() || state.Id.IsNull()) && sId == "" {
		tflog.Debug(ctx, "Unknown or null state Id.")
		hasher := sha256.New()
		hasher.Write([]byte(sPath))
		id := hex.EncodeToString(hasher.Sum(nil))
		state.Id = types.StringValue(id)
	}

	if (state.Created.IsUnknown() || state.Created.IsNull()) && sCreated == "" {
		resp.Diagnostics.AddError("Bad State", "Unknown or null state for Created attribute.")
		return
	}

	perm, data, err := r.client.Read(sPath)
	if err != nil && os.IsNotExist(err) {
		// force recreate if directory not found
		tflog.Debug(ctx, fmt.Sprintf("Directory not found: %#v", err))
		resp.State.RemoveResource(ctx)
		return
	}
	tflog.Debug(ctx, fmt.Sprintf("Read data: %#v", data))

	if perm != sPerm {
		// update the state with the actual mode
		state.Permissions = types.StringValue(perm)
	}

	// Only update permissions because id, path, and created should never change.
	// The directory resource manages a new directory, it is not meant to pull file information.
	// To retrieve file information in a directory, use the directory data source.

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
	tflog.Debug(ctx, fmt.Sprintf("Response Object: %#v", *resp))
}

func (r *LocalDirectoryResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	tflog.Debug(ctx, fmt.Sprintf("Request Object: %#v", req))

	var config LocalDirectoryResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &config)...)
	if resp.Diagnostics.HasError() {
		return
	}

	cPath := config.Path.ValueString()
	cPerm := config.Permissions.ValueString()

	// Read updates state with reality, so state = reality
	var reality LocalDirectoryResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &reality)...)
	if resp.Diagnostics.HasError() {
		return
	}
	rPerm := reality.Permissions.ValueString()

	if cPerm != rPerm {
		// Only update permissions because id, path, and created should never change.
		err := r.client.Update(cPath, cPerm)
		if err != nil {
			resp.Diagnostics.AddError("Error updating directory permissions: ", err.Error())
			return
		}
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, &config)...)
	tflog.Debug(ctx, fmt.Sprintf("Response Object: %#v", *resp))
}

func (r *LocalDirectoryResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	tflog.Debug(ctx, fmt.Sprintf("Request Object: %#v", req))

	var state LocalDirectoryResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	sCutPath := state.Created.ValueString()

	if err := r.client.Delete(sCutPath); err != nil {
		resp.Diagnostics.AddError("Failed to delete directory: ", err.Error())
		return
	}

	tflog.Debug(ctx, fmt.Sprintf("Response Object: %#v", *resp))
}

func (r *LocalDirectoryResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}
