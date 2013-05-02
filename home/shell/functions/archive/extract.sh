#/
## A shell function to extract archived files and mount disk images.
##
## @author Joshua Spence
## @file   ~/.shell/functions/archive/extract.sh
#\

## Extracts archived files and mounts disk images.
##
## @param  [String]  The path to the archive file.
##
## @link http://nparikh.org/notes/zshrc.txt
function extract() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: extract <path>' >&2
        return 1
    elif [[ $# > 0 && ! -f $1 ]]; then
        echo "'$1' is not a valid file" >&2
        return 2
    fi

    case "$1" in
        *.tar.bz2)  tar -jxvf "$1" ;;
        *.tar.gz)   tar -zxvf "$1" ;;
        *.bz2)      bunzip2 "$1" ;;
        *.dmg)      hdiutil mount "$1" ;;
        *.gz)       gunzip "$1" ;;
        *.tar)      tar -xvf "$1" ;;
        *.tbz2)     tar -jxvf "$1" ;;
        *.tgz)      tar -zxvf "$1" ;;
        *.zip)      unzip "$1" ;;
        *.pax)      cat "$1" | pax -r ;;
        *.pax.Z)    uncompress "$1" --stdout | pax -r ;;
        *.Z)        uncompress "$1" ;;
        *)
            echo "'$1' cannot be extracted/mounted via extract()" >&2
            return 3
            ;;
    esac
}
