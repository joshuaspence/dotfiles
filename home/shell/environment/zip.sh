#/
## Environment variables for {@link http://www.info-zip.com/ zip}.
#\

command -v zip &>/dev/null && {
    unset ZIPOPT
}

command -v unzip &>/dev/null && {
    unset UNZIP
}
