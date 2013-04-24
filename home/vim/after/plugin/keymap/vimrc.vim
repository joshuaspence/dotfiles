"/
"" Key mappings to load and edit the {@link http://www.vim.org/ vim}
"" configuration files.
""
"" @author Joshua Spence
"" @file   ~/.vim/after/plugin/keymap/vimrc.vim
"\

nnoremap <silent> <LocalLeader>rs :source ~/.vimrc<CR>
nnoremap <silent> <LocalLeader>rt :tabnew ~/.vimrc<CR>
nnoremap <silent> <LocalLeader>re :e ~/.vim/vimrc<CR>
nnoremap <silent> <LocalLeader>rd :e ~/.vim/ <CR>
