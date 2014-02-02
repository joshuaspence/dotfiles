#/
## Environment variables for {@link http://bzip.org/ bzip}.
#\

command -v bzip2 &>/dev/null && {
    unset BZIP
    unset BZIP2
}
