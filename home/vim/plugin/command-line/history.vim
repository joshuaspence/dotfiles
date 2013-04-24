"/
"" Command-line history for {@link http://www.vim.org/ vim}.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/command-line/history.vim
"\

if has('cmdline_hist')
    "" Number of lines of command line history to keep.
    set history=1000
endif
