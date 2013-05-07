"/
"" Enable syntax highlighting.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/syntax.vim
"\

if has('syntax')
    "" Enable syntax highlighting.
    syntax on

    "" Don't highlight really wide files such as minified JavaScript.
    set synmaxcol=500
endif
