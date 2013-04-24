"/
"" Enable syntax highlighting.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/syntax.vim
"\

if has('syntax')
    syntax on

    "" Don't highlight really wide files such as minified js.
    set synmaxcol=500
endif
