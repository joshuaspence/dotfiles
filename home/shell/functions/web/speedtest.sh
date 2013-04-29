#/
## A shell function to test the speed of the internet connection.
##
## @author Joshua Spence
## @file   ~/.shell/functions/web/speedtest.sh
#\

## Speedtest.
##
## @link http://github.com/jacobwg/dotfiles/blob/master/zsh/aliases.zsh
function speedtest() {
    wget --config=/dev/null --output-document=/dev/null \
        'http://speedtest.wdc01.softlayer.com/downloads/test500.zip'
}
