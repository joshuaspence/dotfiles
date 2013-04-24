"/
"" Folding configuration.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/folding.vim
"\

if has('folding')
    set foldenable
    set foldcolumn=3
    set foldmethod=marker
    set foldlevel=100
    set foldopen=block,hor,mark,percent,quickfix,tag
endif
