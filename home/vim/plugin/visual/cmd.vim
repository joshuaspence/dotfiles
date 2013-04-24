"/
"" Show command in the last line of the screen.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/visual/cmd.vim
"\

if has ('cmdline_info')
    set showcmd
    set cmdheight=2
endif
