"/
"" Searching options.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/search.vim
"\

if has('extra_search')
    "" Highlight search.
    set hlsearch

    "" Case insensitive matching.
    set incsearch
endif

"" Case sensitive matching when there's a capital letter.
set ignorecase

"" Show the 'best match so far' as search strings are typed.
set smartcase
