"/
"" Show command in the last line of the screen.
"\

if has ('showcmd')
    "" Display an incomplete command in the lower right corner of the vim
    "" window.
    set showcmd

    "" Make the command area two lines high.
    set cmdheight=2
endif
