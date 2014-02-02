#/
## A shell function to test the speed of the Internet connection.
#\

## Test the speed of the Internet connection.
##
## @link https://github.com/jacobwg/dotfiles/blob/master/zsh/aliases.zsh
function speedtest() {
    wget -O /dev/null 'http://speedtest.wdc01.softlayer.com/downloads/test500.zip'
}
