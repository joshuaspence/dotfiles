"/
"" Undo/redo configuration.
"\

if has('persistent_undo')
    " Maximum number of changes that can be undone.
    set undolevels=1000

    " Maximum number lines to save for undo on a buffer reload.
    set undoreload=10000
endif
