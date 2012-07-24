#!/bin/bash
#===============================================================================
# File:   install_all.sh
# Author: Joshua Spence <josh@joshuaspence.com>
#===============================================================================
# Installs all configuration files from the $SUBDIRS subdirectories.
#-------------------------------------------------------------------------------

#=================================================
# Configuration
#=================================================
SUBDIRS="
    bash
    bless
    crontab
    git
    GPG
    gtk-bookmarks
    packages
    recordMyDesktop
    skypecallrecorder
    SSH
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
    -a, --all
        Perform all jobs.
    -b, --backup
        Backup any files that would be replaced by this script. This is the 
        default.
    -c, --copy
        Copy the configuration files to the destination directory instead of 
        using symlinks.
    -h, --help
        Show this message.
    -l, --link
        Symlink the configuration files to the destination directory. This is 
        the default.
    -n, --no-root
        Do not install any configuration files that require root access.
    -u, --no-backup
        Do not backup any files that would be replaced by this script.
    -v, --verbose
        Verbose mode. Verbose messages will be output to stderr.

JOBS $SUBDIRS
EOF
}
#-------------------------------------------------

#=================================================
# Options
#=================================================
BACKUP=1            # backup files? [default: yes]
VERBOSE=            # verbose output? [default: no]
DO_ROOT=1		    # install root configuration files? [default: yes]
SCRIPT_ARGS=		# arguments to pass to install.sh scripts
JOBS=               # subdirs to install
INSTALL="\$LINK"    # command to use for installation
#-------------------------------------------------

#=================================================
# Get program command line options
#=================================================
PROGRAM_NAME=$(basename $0)
ARGS=$(getopt --name "$PROGRAM_NAME" --long "all,backup,copy,help,link,no-backup,no-root,verbose" --options "abchlnuv" -- "$@")

# Bad arguments
if [ $? -ne 0 ]; then
    echo "getopt failed!" >&2
    exit 1
fi

# A little magic. Preserves whitespace within option arguments.
eval set -- $ARGS

while [ $# -gt 0 ]; do
    case $1 in
        -a | --all)
            JOBS="$SUBDIRS"
            ;;
        
        -b | --backup)
            BACKUP=1
            SCRIPT_ARGS="$SCRIPT_ARGS --backup"
            ;;
            
        -c | --copy)
            INSTALL="\$COPY"
            SCRIPT_ARGS="$SCRIPT_ARGS --copy"
            ;;
            
        -h | --help)
            usage
            exit 0
            ;;
        
        -l | --link)
            INSTALL="\$LINK"
            SCRIPT_ARGS="$SCRIPT_ARGS --link"
            ;;
        
        -n | --no-root)
        	DO_ROOT=0
        	SCRIPT_ARGS="$SCRIPT_ARGS --no-root"
        	;;

        -v | --verbose)
            VERBOSE="--verbose"
            SCRIPT_ARGS="$SCRIPT_ARGS --verbose"
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
# ...

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
		./$SCRIPT $SCRIPT_ARGS
	else
		$ECHO "Could not find $SCRIPT" >&2
	fi
	
	# Echo the footer.
	$ECHO "--------------------------------------------------------------------------------"
	$ECHO
done
