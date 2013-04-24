"/
"" Folding configuration.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/folding.vim
"\

if has('folding')
    "" Turn on folding.
    set foldenable

    "" A column with the specified width is shown at the side of the window
    "" which indicates open and closed folds.
    set foldcolumn=3

    "" Fold on the marker.
    set foldmethod=marker
      
    "" Don't autofold anything (but I can still fold manually).
    set foldlevel=100

    "" What movements open folds.
    set foldopen=block,hor,mark,percent,quickfix,tag
endif
