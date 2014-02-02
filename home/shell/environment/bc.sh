#/
## Environment variables for `bc`.
#\

command -v bc &>/dev/null && {
    export BC_ENV_ARGS='-lq'
}
