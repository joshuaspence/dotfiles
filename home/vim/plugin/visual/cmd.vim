"/
"" Show command in the last line of the screen.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/visual/cmd.vim
"\

if has ('cmdline_info')
    "" Display an incomplete command in the lower right corner of the vim
    "" window.
    set showcmd

    "" Make the command area two lines high.
    set cmdheight=2
endif
