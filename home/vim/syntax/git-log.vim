" https://github.com/norman/vim-files/blob/master/syntax/git-log.vim
syntax match gitLogCommit +^commit \x\{40}+

highlight link gitLogCommit Statement
