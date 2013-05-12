#/
## A shell function to test the speed of the Internet connection.
##
## @author Joshua Spence
## @file   ~/.shell/functions/web/speedtest.sh
#\

## Test the speed of the Internet connection.
##
## @link https://github.com/jacobwg/dotfiles/blob/master/zsh/aliases.zsh
function speedtest() {
    wget -O /dev/null 'http://speedtest.wdc01.softlayer.com/downloads/test500.zip'
}
