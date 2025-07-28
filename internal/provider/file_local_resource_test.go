// SPDX-License-Identifier: MPL-2.0

package provider

import (
	"context"
	"testing"

	"github.com/hashicorp/terraform-plugin-framework/resource"
)

func TestLocalResourceMetadata(t *testing.T) {
	testCases := []struct {
		name string
		fit  LocalResource
		want resource.MetadataResponse
	}{
		{"Metadata name", LocalResource{}, resource.MetadataResponse{TypeName: "file_local"}},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			req := resource.MetadataRequest{ProviderTypeName: "file"}
			res := resource.MetadataResponse{}
			tc.fit.Metadata(ctx, req, &res)
			got := res
			if got != tc.want {
				t.Errorf("%#v.Metadata() is %v; want %v", tc.fit, got, tc.want)
			}
		})
	}
}
