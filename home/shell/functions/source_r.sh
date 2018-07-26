# A recursive `source` function which also takes into consideration the file
# extension, to allow for shell-specific files to be sourced.
#
# All files with the extension `*.sh` will be sourced, regardless of the
# current shell. Additionally, this function will source files with the 
# extension `*.${SHELL}`.
#
# If the argument to this function is a (single) file, then this file will be
# sourced regardless of its extension.
#
# @param [List] The paths of the files or directories to source.
function source_r() {
  local file

  for file in $(find $@ ! -type d -readable -name '*.sh' -o -name "*.$(basename "${SHELL}")"); do
    source "${file}"
  done
}
