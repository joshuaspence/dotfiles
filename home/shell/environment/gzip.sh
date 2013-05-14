#/
## Environment variables for {@link http://www.gzip.org/ gzip}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/gzip.sh
#\

command -v gzip &>/dev/null && {
    unset GZIP
}
