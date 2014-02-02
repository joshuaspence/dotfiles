#/
## A shell function to start a web server using `python`.
#\

## Starts a web server using `python`.
##
## @param [optional, Integer] Bind port number, default 8000.
##
## @link https://github.com/fnichol/bashrc/blob/master/bashrc
function python-webserver() {
    python -m SimpleHTTPServer ${1:-8000}
}
