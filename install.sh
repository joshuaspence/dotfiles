#!/bin/bash
#===============================================================================
# File:   install_all.sh
# Author: Joshua Spence <josh@joshuaspence.com>
#===============================================================================
# Creates symbolic links for all of my configuration files.
#-------------------------------------------------------------------------------

#=================================================
# Configuration
#=================================================
SUBDIRS="
    bash
    bless
    git
    gtk-bookmarks
    recordMyDesktop
    skypecallrecorder
    vim
    xmonad
"
#-------------------------------------------------

#=================================================
# Usage information
#=================================================
usage() {
    cat << EOF
usage:
    $0 [OPTIONS...] [JOBS...]

This scripts creates symbolic links to all of my configuration files.

OPTIONS
    -h, --help
        Show this message.
    -n, --no-root
        Do not install any configuration files that require root access.
    -v, --verbose
        Verbose mode. Verbose messages will be output to stderr.

JOBS $SUBDIRS
EOF
}
#-------------------------------------------------

#=================================================
# Get program command line options
#=================================================
VERBOSE=        # verbose output? [default: no]
DO_ROOT=1		# install root configuration files? [default: yes]
ARGS=			# arguments to pass to install.sh scripts
JOBS=           # subdirs to install

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
        	ARGS="$ARGS --no-root"
        	;;

        -v | --verbose)
            # enable verbose output to stderr
            VERBOSE="--verbose"
            ARGS="$ARGS --verbose"
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
#-------------------------------------------------

for DIR in $SUBDIRS; do
	# Echo the header.
	$ECHO "================================================================================"
	$ECHO $DIR
	$ECHO "================================================================================"
	
	# Execute the script.
	SCRIPT="$DIR/install.sh"
	if [[ -f $SCRIPT ]]; then
		./$SCRIPT $ARGS
	else
		$ECHO "Could not find $SCRIPT" >&2
	fi
	
	# Echo the footer.
	$ECHO "--------------------------------------------------------------------------------"
	$ECHO
done
