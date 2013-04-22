"/
"" @author Joshua Spence
"" @file   ~/.vim/plugin/persistent_undo.vim
"\

if has("persistent_undo")
  set undofile
  set undodir=~/.vim/.undo
endif
