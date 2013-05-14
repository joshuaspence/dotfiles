#/
## Environment variables for {@link http://www.info-zip.com/ zip}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/zip.sh
#\

command -v zip &>/dev/null && {
    unset ZIPOPT
}

command -v unzip &>/dev/null && {
    unset UNZIP
}
