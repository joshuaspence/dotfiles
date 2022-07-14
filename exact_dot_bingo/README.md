# Project Development Dependencies.

This is directory which stores Go modules with pinned buildable package that is used within this repository, managed by https://github.com/bwplotka/bingo.

* Run `bingo get` to install all tools having each own module file in this directory.
* Run `bingo get <tool>` to install <tool> that have own module file in this directory.
* For Makefile: Make sure to put `include exact_dot_bingo//Variables.mk` in your Makefile, then use $(<upper case tool name>) variable where <tool> is the exact_dot_bingo//<tool>.mod.
* For shell: Run `source exact_dot_bingo//variables.env` to source all environment variable for each tool.
* For go: Import `exact_dot_bingo//variables.go` to for variable names.
* See https://github.com/bwplotka/bingo or -h on how to add, remove or change binaries dependencies.

## Requirements

* Go 1.14+
