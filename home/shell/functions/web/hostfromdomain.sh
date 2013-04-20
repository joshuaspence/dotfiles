#/
## @author Joshua Spence
## @file   ~/.shell/functions/web/hostfromdomain.sh
#\

## Determines the primary hostname of another domain name. Often used to resolve
## a website url (like "www.example.com") to a server hostname (like
## "webserver1.domainhosting.com").
##
## @params [String] Domain name to look up.
##
## @link http://github.com/fnichol/bashrc/blob/master/bashrc
function hostfromdomain() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: hostfromdomain <domainname>' >&2
        return 1
    fi

    dig -x $(dig "$1" +short) +short
}
