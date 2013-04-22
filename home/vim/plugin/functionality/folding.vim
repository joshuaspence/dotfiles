"/
"" @author Joshua Spence
"" @file   ~/.vim/plugin/functionality/folding.vim
"\

if has("folding")
  "" Turn on folding.
  set foldenable

  "" A column with the specified width is shown at the side of the window
  "" which indicates open and closed folds.
  set foldcolumn=3

  "" Fold on the marker.
  set foldmethod=marker
      
  "" Don't autofold anything (but I can still fold manually).
  set foldlevel=100

  "" What movements open folds "{{{
    set foldopen=
    set foldopen+=block
    set foldopen+=hor
    set foldopen+=mark
    set foldopen+=percent
    set foldopen+=quickfix
    set foldopen+=tag
  "" "}}}
  endif
