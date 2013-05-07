"/
"" Undo/redo functionality.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/command-line/undo.vim
"\

if has('persistent_undo')
    set undofile
    set undodir=~/.vim/undo
endif
