#/
## @author Joshua Spence
## @file   ~/.shell/functions/navigation/dead_symllinks.sh
#\

## Find dead symlinks.
##
## @param [optional, String] The base directory. Defaults to the current
##                           directory.
##
## @link http://github.com/jacobwg/dotfiles/blob/master/bin/deadsymlinks
function dead_symlinks() {
    find "${1:-.}" -type l ! -exec test -r {} \; -print
}
