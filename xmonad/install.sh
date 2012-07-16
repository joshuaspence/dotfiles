#!/bin/bash
#===============================================================================
# File:   xmonad/install.sh
# Author: Joshua Spence <josh@joshuaspence.com>
#===============================================================================
# Creates symbolic links for my XMonad configuration files.
#-------------------------------------------------------------------------------

#=================================================
# Configuration
#=================================================
SOURCE_HOME_DIR="$(readlink -f $(dirname $0))/~/"			# Files in this directory will go to the current user's home directory
SOURCE_FILESYSTEM_DIR="$(readlink -f $(dirname $0))/_/"		# Files in this directory will go to the root filesystem
#-------------------------------------------------

#=================================================
# Usage information
#=================================================
usage() {
    cat << EOF
usage:
    $0 [OPTIONS...]

This scripts creates symbolic links to my configuration files for XMonad.

OPTIONS
    -h, --help
    		Show this message.
	-n, --no-root
			Do not install any configuration files that require root access.
    -v, --verbose
            Verbose mode. Verbose messages will be output to stderr.
EOF
}
#-------------------------------------------------

#=================================================
# Get program command line options
#=================================================
VERBOSE=        # verbose output? [default: no]
DO_ROOT=1		# install root configuration files? [default: yes]

PROGRAM_NAME=$(basename $0)
ARGS=$(getopt --name "$PROGRAM_NAME" --long help,no-root,verbose --options hnv -- "$@")
if [ $? -ne 0 ]; then
    echo "getopt failed!" >&2
    exit 1
fi

eval set -- $ARGS
while [ $# -gt 0 ]; do
    case $1 in
        -h | --help)
            usage
            exit 0
            ;;
        
        -n | --no-root)
        	DO_ROOT=0
        	;;

        -v | --verbose)
            # enable verbose output to stderr
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
#-------------------------------------------------

#=================================================
# Program configuration
#=================================================
ECHO="echo"
FIND="find"
LINK="ln --symbolic --force $VERBOSE"
MKDIR="mkdir --parents $VERBOSE"
POPD="popd"
PUSHD="pushd"
READ="read"
READLINK="readlink --canonicalize"
SUDO="sudo"
WHICH="which"
XMONAD=
#-------------------------------------------------

$ECHO -n "Searching for XMonad... "
XMONAD="$($WHICH xmonad)"
if [[ -n $XMONAD ]]; then
	$ECHO $XMONAD
else
	$ECHO "FAILED" >&2
	exit 1
fi
$ECHO

if [[ -d $SOURCE_HOME_DIR ]]; then
	$ECHO "Copying personal configuration files..."
	$PUSHD $SOURCE_HOME_DIR >/dev/null
	$FIND . -type f -print0 | while $READ -d $'\0' file; do
		SRC="$(readlink -f $file)"
		DST="$($READLINK ~)/$file"

		if [[ ! -d $(dirname $DST) ]]; then
			$MKDIR $(dirname $DST) || exit $?
		fi

		$LINK $SRC $DST || exit $?
	done
	$POPD >/dev/null
	$ECHO
fi

if [[ $DO_ROOT -eq 1 && -d $SOURCE_FILESYSTEM_DIR ]]; then
	$ECHO "Copying global configuration files..."
	$PUSHD $SOURCE_FILESYSTEM_DIR >/dev/null
	$FIND . -type f -print0 | while $READ -d $'\0' file; do
		SRC="$(readlink -f $file)"
		DST="/$file"

		if [[ ! -d $(dirname $DST) ]]; then
			$SUDO $MKDIR $(dirname $DST) || exit $?
		fi

		$SUDO $LINK $SRC $DST || exit $?
	done
	$POPD >/dev/null
	$ECHO
fi

if [[ -n $XMONAD ]]; then
	$ECHO "Recompiling Xmonad..."
	$XMONAD --recompile || exit $?
	$ECHO
fi


$ECHO "Done!"
exit 0
