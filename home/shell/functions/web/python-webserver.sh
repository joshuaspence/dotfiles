#/
## A shell function to start a web server using `python`.
## @author Joshua Spence
## @file   ~/.shell/functions/web/python-webserver.sh
#\

## Starts a web server using `python`.
##
## @param [optional, Integer] Bind port number, default 8000.
##
## @link http://github.com/fnichol/bashrc/blob/master/bashrc
function python-webserver() {
    python -m SimpleHTTPServer ${1:-8000}
}
