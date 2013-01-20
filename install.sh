#!/bin/bash

CONFIGURATIONS=( $(find . -mindepth 1 -maxdepth 1 -type d \( ! -name ".*" \) -printf '%P\n') )

#===============================================================================
# Usage information
#===============================================================================
usage() {
    cat << EOF
usage:
    $0 [OPTIONS...] [CONFIGURATIONS...]

This scripts creates symbolic links to all of my configuration files.

OPTIONS
    -a, --all
            Install all configurations.
    -d, --dry-run
            Do not install anything.
    -f, --force
            Force installation by overwriting existing files.
    -h, --help
            Show this message.
    -v, --verbose
            Verbose mode. Verbose messages will be output to stderr.

CONFIGURATIONS
$(for i in ${CONFIGURATIONS[@]}; do echo "    $i"; done)
EOF
}
#-------------------------------------------------------------------------------

#===============================================================================
# Get program command line options
#===============================================================================
FORCE=          # forced installation? [default: no]
VERBOSE=        # verbose output? [default: no]
DRY_RUN=0       # dry run? [default: no]

ARGS=$(getopt --name "$(basename $0)" --long dry-run,force,help,verbose --options dfhv -- $@)
if [[ $? -ne 0 ]]; then
    echo "getopt failed!" >&2
    exit 1
fi

eval set -- $ARGS
while [[ $# -gt 0 ]]; do
    case $1 in
        -a | --all)
            TODO=${JOBS[@]}
            ;;

        -d | --dry-run)
            DRY_RUN=1
            VERBOSE="--verbose"
            ;;

        -f | --force)
            FORCE="--force"
            ;;

        -h | --help)
            usage
            exit 0
            ;;

        -v | --verbose)
            VERBOSE="--verbose"
            ;;

    # OTHER
        --)
            shift
            break
            ;;

        -*)
            usage
            exit 1
            ;;

        *)
            # terminate while loop
            break
            ;;

    esac
    shift
done

# Get the jobs
shift  $(( OPTIND-1 ))
if [[ -z "${TODO}" ]]; then
    TODO=$@
fi
#-------------------------------------------------------------------------------

#===============================================================================
# Utility functions
#===============================================================================

# Cleans up path names a little bit.
function clean_path() {
    local path=$1
    path=$(echo ${path} | sed -e 's/\/\.\//\//')
    echo "${path}"
    return 0
}

# Check if an array ($1) contains a specified value ($2).
function contains() {
    local n=$#
    local value=${!n}

    for ((i=1; i < $#; i++)) {
        if [[ "${!i}" == "${value}" ]]; then
            echo "1"
            return 1
        fi
    }

    echo "0"
    return 0
}

# Returns $2 relative to $1
function relative_path() {
    local source=$(readlink --canonicalize $1)/
    local target=$(readlink --canonicalize $2)/
    local common=${source}
    local back="."

    while [[ "${target#$common}" = "${target}" ]]; do
        common=$(dirname ${common})
        back="../${back}"
    done

    echo ${back}${target#${common}}
    return 0
}
#-------------------------------------------------------------------------------

#===============================================================================
# Install functions
#===============================================================================
function install() {
    local conf=$1
    local source_user_dir=$(readlink --canonicalize $(dirname $0)/${conf}/~/)
    local source_root_dir=$(readlink --canonicalize $(dirname $0)/${conf}/_/)
    local source_custom_dir=$(readlink --canonicalize $(dirname $0)/${conf}/custom/)
    local failures=0

    _install ${source_user_dir} 0
    failures=$(expr ${failures} + $?)

    _install ${source_root_dir} 1
    failures=$(expr ${failures} + $?)

    #install ${source_custom_dir} 0
    #failures=$(expr ${failures} + $?)

    return ${failures}
}

function _install() {
    local source_dir=$1
    local sudo=$([[ $2 -ne 0 ]] && echo "sudo")
    local failures=0

    if [[ -d "${source_dir}" ]]; then
        #pushd ${source_dir} >/dev/null

        find ${source_dir} -type f -print0 | while read -d $'\0' file; do
            file=$(relative_path ${source_dir} $(dirname ${file}))/$(basename ${file})
            local src=$(relative_path ~/$(dirname ${file}) $(dirname ${file}))/$(basename ${file})
            local dst=$(clean_path $(readlink --canonicalize ~)/${file})
            echo ${src}
            echo ${dst}
            exit 0
            [[ -n "${VERBOSE}" ]] && echo "${dst} --> ${src}" >&2

            if [[ "${DRY_RUN}" -eq 0 ]]; then
                if [[ ! -d $(dirname ${dst}) ]]; then
                    [[ -n "${VERBOSE}" ]] && echo "Creating parent directory: $(dirname ${dst})"
                    ${sudo} mkdir --parents $(dirname ${dst})
                    if [[ $? -ne 0 ]]; then
                        failures=$(expr ${failures} + 1)
                        continue
                    fi
                fi

                ${sudo} ln --symbolic ${FORCE} ${VERBOSE} ${src} ${dst}
                if [[ $? -ne 0 ]]; then
                    failures=$(expr ${failures} + 1)
                    continue
                fi
            fi
        done

        #popd >/dev/null
    fi

    return ${failures}
}

function _execute() {
    local source_dir=$1
    local sudo=$([[ $2 -ne 0 ]] && echo "sudo")
    local failures=0

    if [[ -d "${source_dir}" ]]; then
        pushd ${source_dir} >/dev/null

        find . -type f -print0 | while read -d $'\0' file; do
            local src=$(relative_path ~/$(dirname ${file}) $(dirname ${file}))/$(basename ${file})
            local dst=$(clean_path $(readlink --canonicalize ~)/${file})

            [[ -n "${VERBOSE}" ]] && echo "${dst} --> ${src}" >&2

            if [[ "${DRY_RUN}" -eq 0 ]]; then
                if [[ ! -d $(dirname ${dst}) ]]; then
                    [[ -n "${VERBOSE}" ]] && echo "Creating parent directory: $(dirname ${dst})"
                    ${sudo} mkdir --parents $(dirname ${dst})
                    if [[ $? -ne 0 ]]; then
                        failures=$(expr ${failures} + 1)
                        continue
                    fi
                fi

                ${sudo} ln --symbolic ${FORCE} ${VERBOSE} ${src} ${dst}
                if [[ $? -ne 0 ]]; then
                    failures=$(expr ${failures} + 1)
                    continue
                fi
            fi
        done

        popd >/dev/null
    fi

    return ${failures}
}
#-------------------------------------------------------------------------------

total_failures=0
for CONF in ${TODO}; do
    if [[ $(contains ${CONFIGURATIONS[@]} ${CONF}) -eq 1 ]]; then
    	[[ -n "${VERBOSE}" ]] && echo "================================================================================"
    	echo "${CONF}"
    	[[ -n "${VERBOSE}" ]] && echo "================================================================================"
    	install ${CONF}
        failures=$?
        if [[ ${failures} -gt 0 ]]; then
            total_failures=$(expr ${total_failures} + ${failures})
            [[ -n "${VERBOSE}" ]] && echo "--------------------------------------------------------------------------------"
            echo " FAILURES = ${failures}"
        fi
        [[ -n "${VERBOSE}" ]] && echo "--------------------------------------------------------------------------------"
    	[[ -n "${VERBOSE}" ]] && echo ""
    else
        echo "Configuration not found: ${CONF}" >&2
    fi
done

if [[ ${total_failures} -gt 0 ]]; then
    echo "********************************************************************************"
    echo " TOTAL FAILURES = ${total_failures}"
    echo "********************************************************************************"
fi
exit ${total_failures}