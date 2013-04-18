"/
"" Key mappings for {@link http://www.vim.org/ vim}.
""
"" @author Joshua Spence
"" @file   ~/.vim/mappings.vim
"\


"" Set leader. Note: This line MUST come before any '<leader>' mappings.
let mapleader=","

"" Set local leader. Note: This line MUST come before any '<leader>' mappings.
let maplocalleader="\"

"" vimrc "{{{
  "" @todo Reload all vim files.
  nnoremap <silent> <localleader>rs :source ~/.vimrc<CR>
  nnoremap <silent> <localleader>rt :tabnew ~/.vimrc<CR>
  nnoremap <silent> <localleader>re :e ~/.vim/vimrc<CR>
  nnoremap <silent> <localleader>rd :e ~/.vim/ <CR>
"" "}}}

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
