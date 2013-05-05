#/
## Environment variables for `bc`.
##
## @author Joshua Spence
## @file   ~/.shell/environment/bc.sh
#\

BC_ENV_ARGS=

## Define the standard math library.
BC_ENV_ARGS+='-l '

## Do not print the normal GNU `bc` welcome.
BC_ENV_ARGS+='-q '

## Add a startup file.
if [[ -f ${HOME}/.bcrc && -r ${HOME}/.bcrc ]]; then
    BC_ENV_ARGS+="${HOME}/.bcrc"
fi

export BC_ENV_ARGS
