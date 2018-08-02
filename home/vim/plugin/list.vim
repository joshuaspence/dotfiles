" Define unprintable characters.
set listchars=
set listchars+=eol:↲
set listchars+=extends:»
set listchars+=precedes:«
set listchars+=tab:▸\
set listchars+=trail:·

" Don't display unprintable characters by default.
set nolist

" Show unprintable characters when requested.
nmap <silent> <leader>s :set nolist!<CR>
