#/
## @author Joshua Spence
## @file   ~/.shell/functions/web/php-webserver.sh
#\

## Starts a web server using PHP. Requires PHP >= 5.4.
##
## @param [optional, Integer] Bind port number, default 8000.
function php-webserver() {
    php -S localhost:${1:-8000}
}
