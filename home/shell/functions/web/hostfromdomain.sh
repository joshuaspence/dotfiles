#/
## A shell function to determine the primary hostname of another domain name.
##
## @author Joshua Spence
## @file   ~/.shell/functions/web/hostfromdomain.sh
#\

## Determines the primary hostname of another domain name. Often used to resolve
## a website URL (like `www.example.com`) to a server hostname (like
## `webserver1.domainhosting.com`).
##
## @param [String] Domain name to look up.
##
## @link https://github.com/fnichol/bashrc/blob/master/bashrc
function hostfromdomain() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: hostfromdomain <domain_name>' >&2
        return 1
    fi

    dig -x $(dig "$1" +short) +short
}
