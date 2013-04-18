#!/bin/sh
# https://github.com/jacobwg/dotfiles/blob/master/bin/deadsymlinks
find . -type l ! -exec test -r {} \; -print
