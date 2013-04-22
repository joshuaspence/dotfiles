"/
"" @author Joshua Spence
"" @file   ~/.vim/plugin/persistent_undo.vim
"\

if has("persistent_undo")
  set undofile
  set undodir=~/.vim/.undo

  set undolevels=1000         " Maximum number of changes that can be undone
  set undoreload=10000        " Maximum number lines to save for undo on a buffer reload
endif
