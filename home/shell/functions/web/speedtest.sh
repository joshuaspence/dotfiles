#/
## @author Joshua Spence
## @file   ~/.shell/functions/web/speedtest.sh
#\

## Speedtest.
##
## @link https://github.com/jacobwg/dotfiles/blob/master/zsh/aliases.zsh
function speedtest() {
    wget --config=/dev/null --output-document=/dev/null 'http://speedtest.wdc01.softlayer.com/downloads/test500.zip'
}
