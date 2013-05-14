#/
## Environment variables for {@link http://bzip.org/ bzip}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/bzip.sh
#\

command -v bzip2 &>/dev/null && {
    unset BZIP
    unset BZIP2
}
