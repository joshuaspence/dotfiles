"/
"" Autocommand-specific configuration for {@link http://www.vim.org/ vim}.
""
"" @author Joshua Spence
"" @file   ~/.vim/autocmd.vim
"\

"" Restore position in file.
""
"" @link http://wiki.archlinux.org/index.php/Vim#Make_Vim_restore_cursor_position_in_files
autocmd BufReadPost * if line("'\"") > 0 && line("'\"") <= line("$") | execute "normal g'\"" | endif
