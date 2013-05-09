#/
## A shell function to find dead symbolic links.
##
## @author Joshua Spence
## @file   ~/.shell/functions/navigation/dead_symlinks.sh
#\

## Find dead symbolic links.
##
## @param [optional, String] The base directory. Defaults to the current
##                           directory.
##
## @link  http://github.com/jacobwg/dotfiles/blob/master/bin/deadsymlinks
function dead_symlinks() {
    if [[ $# > 0 && ! -d $1 ]]; then
        echo "'$1' is not a valid directory" >&2
        return 2
    fi

    find "${1:-.}" -type l ! -exec test -r {} \; -print
}
