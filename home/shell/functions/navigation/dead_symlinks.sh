#/
## @author Joshua Spence
## @file   ~/.shell/functions/navigation/dead_symllinks.sh
#\

## @link http://github.com/jacobwg/dotfiles/blob/master/bin/deadsymlinks
function dead_symlinks() {
    find . -type l ! -exec test -r {} \; -print
}
