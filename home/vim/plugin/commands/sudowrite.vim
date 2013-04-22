"/
"" @author Joshua Spence
"" @file   ~/.vim/plugin/commands/sudowrite.vim
"\

"" Sudo write.
comm! W exec 'w !sudo tee % > /dev/null' | e!
