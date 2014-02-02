#/
## A shell function to extract archived files and mount disk images.
#\

## Extracts archived files and mounts disk images.
##
## @param [List] The path to the archive file.
##
## @link http://nparikh.org/notes/zshrc.txt
function extract() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: extract <path> ...' >&2
        return 1
    fi

    local failures=0
    local file; for file in $@; do
        if [[ ! -f $file ]]; then
            echo "'${file}' is not a valid file" >&2
            failures=$(( $failures + 1 ))
        else
            case $file in
                *.tar.bz2)  tar -jxvf "${file}" ;;
                *.tar.gz)   tar -zxvf "${file}" ;;
                *.bz2)      bunzip2 "${file}" ;;
                *.dmg)      hdiutil mount "${file}" ;;
                *.gz)       gunzip "${file}" ;;
                *.tar)      tar -xvf "${file}" ;;
                *.tbz2)     tar -jxvf "${file}" ;;
                *.tgz)      tar -zxvf "${file}" ;;
                *.zip)      unzip "${file}" ;;
                *.pax)      cat "${file}" | pax -r ;;
                *.pax.Z)    uncompress "${file}" --stdout | pax -r ;;
                *.Z)        uncompress "${file}" ;;
                *)
                    echo "'${file}' cannot be extracted/mounted via extract()" >&2
                    failures=$(( $failures + 1 ))
                    ;;
            esac
        fi
    done
    return $(( $failures + 2 ))
}
