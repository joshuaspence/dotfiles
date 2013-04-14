" Restore position in file.
" @link https://wiki.archlinux.org/index.php/Vim#Make_Vim_restore_cursor_position_in_files
autocmd BufReadPost * if line("'\"") > 0 && line("'\"") <= line("$") | execute "normal g'\"" | endif

" Filetypes "{{{
    source ~/.vim/filetype.vim
" "}}}
