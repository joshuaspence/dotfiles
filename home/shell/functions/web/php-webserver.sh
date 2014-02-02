#/
## A shell function to start a web server using `php`.
#\

## Starts a web server using `php`. Requires `php --version` >= 5.4.
##
## @param [optional, Integer] Bind port number, default 8000.
function php-webserver() {
    php -S localhost:${1:-8000}
}
