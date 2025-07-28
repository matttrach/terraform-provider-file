// SPDX-License-Identifier: MPL-2.0

package provider

import (
	"context"
	"testing"

	"github.com/hashicorp/terraform-plugin-framework/provider"
)

func TestProviderMetadata(t *testing.T) {
	testCases := []struct {
		name string
		fit  FileProvider
		want provider.MetadataResponse
	}{
		{"Metadata name", FileProvider{version: "test"}, provider.MetadataResponse{TypeName: "file", Version: "test"}},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			req := provider.MetadataRequest{}
			res := provider.MetadataResponse{}
			tc.fit.Metadata(ctx, req, &res)
			got := res
			if got != tc.want {
				t.Errorf("%#v.Metadata() is %v; want %v", tc.fit, got, tc.want)
			}
		})
	}
}
