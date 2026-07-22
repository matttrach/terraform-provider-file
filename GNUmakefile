SHELL := /bin/bash

default: fmt lint build install generate test testacc

fmt:
	gofmt -s -w -e .

lint:
	golangci-lint run

build:
	go build -o ./bin/ -v ./...

buildrace:
	go build -race -o ./bin/ -v ./...

generate:
	cd tools; go generate ./...

dt: # run specific unit test
	gotestsum --format standard-verbose -- $(t)

test:
	gotestsum --format standard-verbose --jsonfile report.json --post-run-command "./test/summarize.sh" -- ./... -v -p=10 -timeout=300s -cover

testacc: build
	export REPO_ROOT="../../../."; \
	pushd ./test; \
	gotestsum --format standard-verbose --jsonfile report.json --post-run-command "./summarize.sh" -- ./... -v -p=1 -timeout=300s; \
	popd;

testracc: buildrace
	export REPO_ROOT="../../../."; \
	pushd ./test; \
	gotestsum --format standard-verbose --jsonfile report.json --post-run-command "./summarize.sh" -- ./... -v -p=100 -timeout=3000s; \
	popd;

et: build
	export REPO_ROOT="../../../."; \
	pushd ./test; \
	gotestsum --format standard-verbose --jsonfile report.json --post-run-command "./summarize.sh" -- ./... -v -p=1 -timeout=300s -run=$(t); \
	popd;

rt: buildrace
	export REPO_ROOT="../../../."; \
	pushd ./test; \
	gotestsum --format standard-verbose --jsonfile report.json --post-run-command "./summarize.sh" -- ./... -v -p=100 -timeout=3000s -run=$(t); \
	popd;

.PHONY: fmt lint build install generate test testacc debug
