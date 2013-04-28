#/
## @author Joshua Spence
## @file   ~/.shell/vars/colors.sh
#\

## Normal colors @{{{
    COLOR_NC='\e[0m'
    COLOR_BLACK='\e[0;30m'
    COLOR_RED='\e[0;31m'
    COLOR_GREEN='\e[0;32m'
    COLOR_YELLOW='\e[0;33m'
    COLOR_BLUE='\e[0;34m'
    COLOR_MAGENTA='\e[0;35m'
    COLOR_CYAN='\e[0;36m'
    COLOR_WHITE='\e[0;37m'

    ## Alias to list the defined colors.
    alias colorlist='set | egrep '\''^COLOR_\w*'\'' | sort'
## @}}}

## Bold colors @{{{
    BOLDCOLOR_BLACK='\e[1;30m'
    BOLDCOLOR_RED='\e[1;31m'
    BOLDCOLOR_GREEN='\e[1;32m'
    BOLDCOLOR_YELLOW='\e[1;33m'
    BOLDCOLOR_BLUE='\e[1;34m'
    BOLDCOLOR_MAGENTA='\e[1;35m'
    BOLDCOLOR_CYAN='\e[1;36m'
    BOLDCOLOR_WHITE='\e[1;37m'

    ## Alias to list the defined bold colors.
    alias boldcolorlist='set | egrep '\''^BOLDCOLOR_\w*'\'' | sort'
## @}}}

## Backgrounds @{{{
    BG_BLACK='\e[40m'
    BG_RED='\e[41m'
    BG_GREEN='\e[42m'
    BG_YELLOW='\e[43m'
    BG_BLUE='\e[44m'
    BG_MAGENTA='\e[45m'
    BG_CYAN='\e[46m'
    BG_WHITE='\e[47m'

    ## Alias to list the defined background colors.
    alias backgroundcolorlist='set | egrep '\''^BG_\w*'\'' | sort'
## @}}}

## Styles @{{{
    STYLE_PLAIN='\e[0m'
    STYLE_BOLD='\e[1m'
    STYLE_NOBOLD='\e[22m'
    STYLE_ITALIC='\e[3m'
    STYLE_NOITALIC='\e[23m'
    STYLE_UNDERLINE='\e[4m'
    STYLE_NOUNDERLINE='\e[24m'
    STYLE_BLINKING='\e[5m'
    STYLE_NOBLINKING='\e[25m'
    STYLE_INVERSE='\e[7m'
    STYLE_NOINVERSE='\e[27m'
    STYLE_STRIKETHROUGH='\e[9m'
    STYLE_NOSTRIKETHROUGH='\e[29m'

    ## Alias to list the defined styles.
    alias stylelist='set | egrep '\''^STYLE_\w*'\'' | sort'
## @}}}
