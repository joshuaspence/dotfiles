"/
"" Show/hide hidden characters.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/visual/list.vim
"\

"" Do not display unprintable characters.
set nolist

"" Unprintable chars mapping. "{{{
    set listchars=
    set listchars+=tab:·\ 
    set listchars+=eol:¶
    set listchars+=trail:·
    set listchars+=extends:»
    set listchars+=precedes:«
"" "}}}
