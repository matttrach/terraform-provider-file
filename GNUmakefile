default: fmt lint build install generate

fmt:
	gofmt -s -w -e .

lint:
	golangci-lint run

build:
	go build -o ./bin/ -v ./...

install:
	go install -v ./...

generate:
	cd tools; go generate ./...

test:
	go test -v -cover -timeout=120s -parallel=10 ./internal/...

testacc: build
	export REPO_ROOT="../../../."; \
	export TF_CLI_CONFIG_FILE="../../../test/.terraformrc"; \
	pushd ./test; \
	gotestsum --format=standard-verbose ./... -- -failfast=1 -timeout=300m; \
	popd;

.PHONY: fmt lint build install generate test testacc
