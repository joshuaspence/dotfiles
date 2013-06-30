#/
## A shell function to find dead symbolic links.
##
## @author Joshua Spence
## @file   ~/.shell/functions/navigation/dead_symlinks.sh
#\

## Find dead symbolic links.
##
## @param [optional, String] The base directory. Defaults to the current directory.
##
## @link https://github.com/jacobwg/dotfiles/blob/master/bin/deadsymlinks
function dead_symlinks() {
    find "${@:-.}" -type l ! -exec test -r {} \; -print
}
