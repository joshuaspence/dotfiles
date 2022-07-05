# Auto generated binary variables helper managed by https://github.com/bwplotka/bingo v0.5.2. DO NOT EDIT.
# All tools are designed to be build inside $GOBIN.
BINGO_DIR := $(dir $(lastword $(MAKEFILE_LIST)))
GOPATH ?= $(shell go env GOPATH)
GOBIN  ?= $(firstword $(subst :, ,${GOPATH}))/bin
GO     ?= $(shell which go)

# Below generated variables ensure that every time a tool under each variable is invoked, the correct version
# will be used; reinstalling only if needed.
# For example for bingo variable:
#
# In your main Makefile (for non array binaries):
#
#include .bingo/Variables.mk # Assuming -dir was set to .bingo .
#
#command: $(BINGO)
#	@echo "Running bingo"
#	@$(BINGO) <flags/args..>
#
BINGO := $(GOBIN)/bingo-v0.6.0
$(BINGO): $(BINGO_DIR)/bingo.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/bingo-v0.6.0"
	@cd $(BINGO_DIR) && $(GO) build -mod=mod -modfile=bingo.mod -o=$(GOBIN)/bingo-v0.6.0 "github.com/bwplotka/bingo"

DEVCONTAINER := $(GOBIN)/devcontainer-v0.1.2493445248
$(DEVCONTAINER): $(BINGO_DIR)/devcontainer.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/devcontainer-v0.1.2493445248"
	@cd $(BINGO_DIR) && $(GO) build -mod=mod -modfile=devcontainer.mod -o=$(GOBIN)/devcontainer-v0.1.2493445248 "github.com/stuartleeks/devcontainer-cli/cmd/devcontainer"

DOCKER_COMPOSE := $(GOBIN)/docker-compose-v1.0.5
$(DOCKER_COMPOSE): $(BINGO_DIR)/docker-compose.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/docker-compose-v1.0.5"
	@cd $(BINGO_DIR) && $(GO) build -mod=mod -modfile=docker-compose.mod -o=$(GOBIN)/docker-compose-v1.0.5 "github.com/docker/compose-switch"

GOLANGCI_LINT := $(GOBIN)/golangci-lint-v1.46.2
$(GOLANGCI_LINT): $(BINGO_DIR)/golangci-lint.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/golangci-lint-v1.46.2"
	@cd $(BINGO_DIR) && $(GO) build -mod=mod -modfile=golangci-lint.mod -o=$(GOBIN)/golangci-lint-v1.46.2 "github.com/golangci/golangci-lint/cmd/golangci-lint"

HUB_TOOL := $(GOBIN)/hub-tool-v0.4.4
$(HUB_TOOL): $(BINGO_DIR)/hub-tool.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/hub-tool-v0.4.4"
	@cd $(BINGO_DIR) && $(GO) build -mod=mod -modfile=hub-tool.mod -o=$(GOBIN)/hub-tool-v0.4.4 "github.com/docker/hub-tool"

JIRA := $(GOBIN)/jira-v1.0.28
$(JIRA): $(BINGO_DIR)/jira.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/jira-v1.0.28"
	@cd $(BINGO_DIR) && $(GO) build -mod=mod -modfile=jira.mod -o=$(GOBIN)/jira-v1.0.28 "github.com/go-jira/jira/cmd/jira"

SKOPEO := $(GOBIN)/skopeo-v1.8.0
$(SKOPEO): $(BINGO_DIR)/skopeo.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/skopeo-v1.8.0"
	@cd $(BINGO_DIR) && $(GO) build -mod=mod -modfile=skopeo.mod -o=$(GOBIN)/skopeo-v1.8.0 "github.com/containers/skopeo/cmd/skopeo"

TFLINT := $(GOBIN)/tflint-v0.38.1
$(TFLINT): $(BINGO_DIR)/tflint.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/tflint-v0.38.1"
	@cd $(BINGO_DIR) && $(GO) build -mod=mod -modfile=tflint.mod -o=$(GOBIN)/tflint-v0.38.1 "github.com/terraform-linters/tflint"

YQ := $(GOBIN)/yq-v4.25.3
$(YQ): $(BINGO_DIR)/yq.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/yq-v4.25.3"
	@cd $(BINGO_DIR) && $(GO) build -mod=mod -modfile=yq.mod -o=$(GOBIN)/yq-v4.25.3 "github.com/mikefarah/yq/v4"

