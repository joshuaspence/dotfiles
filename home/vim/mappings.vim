"/
"" Key mappings for {@link http://www.vim.org/ vim}.
""
"" @author Joshua Spence
"" @file   ~/.vim/mappings.vim
"\

"" Tab navigation. "{{{
  nnoremap <silent> <localleader>[ :tabprev<CR>
  nnoremap <silent> <localleader>] :tabnext<CR>
"" "}}}

"" Show/hide hidden characters.
map <silent> <F12> :set invlist<CR>

"" Duplicate the current line. "{{{
  vnoremap <silent> <localleader>= yyP
  nnoremap <silent> <localleader>= YYP
"" "}}}

"" Clear highlighted search.
""
"" @link http://nvie.com/posts/how-i-boosted-my-vim/
nmap <silent> <leader>/ :nohlsearch<CR>
