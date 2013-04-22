"/
"" @author Joshua Spence
"" @file   ~/.vim/plugin/functionality/list.vim
"\

"" Display unprintable characters (<F12> switches).
set nolist

"" Unprintable chars mapping
set listchars=tab:·\ ,eol:¶,trail:·,extends:»,precedes:«

"" Show/hide hidden characters.
map <silent> <F12> :set invlist<CR>
