"/
"" Indenting options.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/indent.vim
"\

"" Copy indent from current line when starting a new line.
set autoindent

if has('smartindent')
    "" Do smart indenting when starting a new line.
    set smartindent
endif

if has('cindent')
    "" Use the C indenting rules.
    set cindent
endif

"" C indenting options.
set cinoptions=:s,ps,ts,cs

"" These keywords start an extra indent in the next line.
set cinwords=if,else,while,do,for,switch,case
