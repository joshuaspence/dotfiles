"/
"" Undo/redo options for {@link http://www.vim.org/ vim}.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/editing/undo.vim
"\

if has('persistent_undo')
    " Maximum number of changes that can be undone.
    set undolevels=1000

    " Maximum number lines to save for undo on a buffer reload.
    set undoreload=10000
endif
