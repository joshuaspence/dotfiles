#/
## A shell function to start a web server using `php`.
##
## @author Joshua Spence
## @file   ~/.shell/functions/web/php-webserver.sh
#\

## Starts a web server using `php`. Requires `php --version` >= 5.4.
##
## @param [optional, Integer] Bind port number, default 8000.
function php-webserver() {
    php -S localhost:${1:-8000}
}
