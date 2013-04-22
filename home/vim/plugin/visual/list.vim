"/
"" Show/hide hidden characters.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/visual/list.vim
"\

"" Display unprintable characters.
set nolist

"" Unprintable chars mapping.
set listchars=
set listchars=tab:·\ 
set listchars+=eol:¶
set listchars+=trail:·
set listchars+=extends:»
set listchars+=precedes:«

"" Show/hide hidden characters.
map <silent> <F12> :set invlist<CR>
