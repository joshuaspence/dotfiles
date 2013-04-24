#/
## @author Joshua Spence
## @file   ~/.shell/functions/path/remove.sh
#\

## Removes all instances of paths in a search path.
##
## @param [String] Path variable to manipulate (eg: "PATH", "PYTHONPATH", etc).
## @param [List]   Space-separated list of system paths to remove.
##
## @link http://github.com/fnichol/bashrc/blob/master/bashrc
function remove-path() {
    local path_var="$1" && shift
    local new_path

    # Remove paths from path_var, working in new_path.
    local p
    for p in $@; do
        new_path=$(
            eval "echo \"\${${path_var}}\"" |
            tr ':' '\n' |
            grep -v "^${p}$" |
            tr '\n' ':' |
            sed -e 's/:$//'
        )
    done

    # Reassign path_var from new_path.
    eval $path_var="${new_path}"
}
