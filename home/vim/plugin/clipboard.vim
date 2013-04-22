"/
"" Clipboard configuration for {@link http://www.vim.org/ vim}.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/clipboard.vim
"\

if has ('x') && has ('gui')
  "" On Linux use + register for copy-paste.
  set clipboard=unnamedplus
elseif has ('gui')
  "" On Mac and Windows, use * register for copy-paste
  set clipboard=unnamed
endif
