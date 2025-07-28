// SPDX-License-Identifier: MPL-2.0

package provider

import (
	"context"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/provider"
	"github.com/hashicorp/terraform-plugin-framework/provider/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource"
)

// The `var _` is a special Go construct that results in an unusable variable.
// The purpose of these lines is to make sure our class implements the provider.Provider interface.
// These will fail at compilation time if the implementation is not satisfied.
var _ provider.Provider = &FileProvider{}

// var _ provider.ProviderWithFunctions = &FileProvider{} // don't want to introduce custom functions
// var _ provider.ProviderWithEphemeralResources = &FileProvider{} // don't want to use ephemeral resources

type FileProvider struct {
	version string
}

type FileProviderModel struct{}

func (p *FileProvider) Metadata(ctx context.Context, req provider.MetadataRequest, resp *provider.MetadataResponse) {
	resp.TypeName = "file"
	resp.Version = p.version
}

func (p *FileProvider) Schema(ctx context.Context, req provider.SchemaRequest, resp *provider.SchemaResponse) {
	resp.Schema = schema.Schema{
		Attributes: map[string]schema.Attribute{},
	}
}

func (p *FileProvider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
	var data FileProviderModel

	resp.Diagnostics.Append(req.Config.Get(ctx, &data)...)

	if resp.Diagnostics.HasError() {
		return
	}
}

func (p *FileProvider) Resources(ctx context.Context) []func() resource.Resource {
	return []func() resource.Resource{
		NewLocalResource,
	}
}

func (p *FileProvider) DataSources(ctx context.Context) []func() datasource.DataSource {
	return []func() datasource.DataSource{
		// NewExampleDataSource,
	}
}

func New(version string) func() provider.Provider {
	return func() provider.Provider {
		return &FileProvider{
			version: version,
		}
	}
}
