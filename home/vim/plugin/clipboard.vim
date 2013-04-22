"/
"" @author Joshua Spence
"" @file   ~/.vim/plugin/clipboard.vim
"\

if has ('x') && has ('gui')
  "" On Linux use + register for copy-paste.
  set clipboard=unnamedplus
elseif has ('gui')
  "" On mac and Windows, use * register for copy-paste
  set clipboard=unnamed
endif
