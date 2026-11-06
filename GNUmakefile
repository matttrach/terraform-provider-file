SHELL := /bin/bash

default: fmt lint build install generate test testacc

fmt: fmt-go fmt-prettier

fmt-go:
	gofmt -s -w -e .

fmt-prettier:
	prettier --write .

lint: lint-go lint-scripts lint-format

lint-go:
	golangci-lint run

lint-scripts:
	npx eslint .github/workflows/scripts/ .gemini/hooks/ .gemini/orchestrator/ .gemini/skills/

lint-format:
	prettier --check .

build:
	go build -o ./bin/ -v ./...

buildrace:
	go build -race -o ./bin/ -v ./...

testcompile:
	@pushd ./test > /dev/null; go test -c -o /dev/null ./...; popd > /dev/null;

compile: build testcompile

generate:
	cd tools; go generate ./...

dt: # run specific unit test
	gotestsum --format standard-verbose -- $(t)

test:
	gotestsum --format standard-verbose --jsonfile report.json --post-run-command "./test/summarize.sh" -- ./... -v -p=10 -timeout=300s -cover

testacc: build
	export REPO_ROOT="../../../."; \
	pushd ./test; \
	gotestsum --format standard-verbose --jsonfile report.json --post-run-command "./summarize.sh" -- ./... -v -p=1 -timeout=900s; \
	popd;

testaccrelay: build
	export REPO_ROOT="../../../."; \
	pushd ./test; \
	gotestsum --format standard-verbose --jsonfile report.json --post-run-command "./summarize.sh" -- ./... -v -p=1 -tags=relay -timeout=1800s; \
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

unit: test

acc: testacc

test-scripts:
	node --test ".github/workflows/scripts/tests/**/*.test.js" ".gemini/orchestrator/lib/**/*.test.js" ".gemini/hooks/**/*.test.js" ".gemini/skills/**/tests/**/*.test.js"

test-all: test test-scripts

.PHONY: fmt lint lint-go lint-scripts lint-format build buildrace compile testcompile install generate test testacc testaccrelay debug unit acc test-scripts test-all
