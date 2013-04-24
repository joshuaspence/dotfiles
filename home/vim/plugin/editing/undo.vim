"/
"" Undo/redo options for {@link http://www.vim.org/ vim}.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/editing/undo.vim
"\

if has('persistent_undo')
    set undolevels=1000
    set undoreload=10000
endif
