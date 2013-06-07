"/
"" Configuration for automatic formatting.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/editing/format-options.vim
"\

set formatoptions=

"" Auto-wrap comments using textwidth.
set formatoptions+=c

"" Support for numbered/bullet lists.
set formatoptions+=n

"" Automatically insert the current comment leader after hitting 'o' or 'O'
"" in Normal mode.
set formatoptions+=o

"" Do not automatically insert a comment leader after an enter.
set formatoptions-=r

"" Do not auto-wrap text using textwidth (does not apply to comments).
set formatoptions-=t
