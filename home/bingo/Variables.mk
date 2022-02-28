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
BINGO := $(GOBIN)/bingo-v0.5.2
$(BINGO): $(BINGO_DIR)/bingo.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/bingo-v0.5.2"
	@cd $(BINGO_DIR) && $(GO) build -mod=mod -modfile=bingo.mod -o=$(GOBIN)/bingo-v0.5.2 "github.com/bwplotka/bingo"

DOCKER_COMPOSE := $(GOBIN)/docker-compose-v1.0.4
$(DOCKER_COMPOSE): $(BINGO_DIR)/docker-compose.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/docker-compose-v1.0.4"
	@cd $(BINGO_DIR) && $(GO) build -mod=mod -modfile=docker-compose.mod -o=$(GOBIN)/docker-compose-v1.0.4 "github.com/docker/compose-switch"

GOLANGCI_LINT := $(GOBIN)/golangci-lint-v1.44.2
$(GOLANGCI_LINT): $(BINGO_DIR)/golangci-lint.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/golangci-lint-v1.44.2"
	@cd $(BINGO_DIR) && $(GO) build -mod=mod -modfile=golangci-lint.mod -o=$(GOBIN)/golangci-lint-v1.44.2 "github.com/golangci/golangci-lint/cmd/golangci-lint"

JIRA := $(GOBIN)/jira-v1.0.28
$(JIRA): $(BINGO_DIR)/jira.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/jira-v1.0.28"
	@cd $(BINGO_DIR) && $(GO) build -mod=mod -modfile=jira.mod -o=$(GOBIN)/jira-v1.0.28 "github.com/go-jira/jira/cmd/jira"

