" Config files "{{{
    autocmd BufRead,BufNewFile {*.cfg,*.conf,*.config} set filetype=config
" "}}}

" Git "{{{
    " Commit "{{{
        autocmd BufRead,BufNewFile {COMMIT_EDITMSG} set filetype=gitcommit
        autocmd Filetype gitcommit set textwidth=68 spell
    " "}}}
    
    " Config "{{{
        autocmd BufRead,BufNewFile {*gitconfig} set filetype=gitconfig
    " "}}}
" "}}}

" JSON "{{{
    autocmd BufRead,BufNewFile {*.json} set filetype=json
" "}}}

" Makefile "{{{
    autocmd BufRead,BufNewFile {Makefile} set filetype=make
    autocmd Filetype make setlocal noexpandtab
" "}}}

" Markdown "{{{
    autocmd BufRead,BufNewFile {*.md,*.mkd,*.markdown} set filetype=markdown
    autocmd Filetype markdown setlocal spell wrap linebreak nolist
" "}}}

" Nginx "{{{
    autocmd BufRead,BufNewFile {nginx.conf} set filetype=nginx
" "}}}

" Ruby "{{{
    autocmd BufRead,BufNewFile {Gemfile,Rakefile,Capfile,*.rake,config.ru} set filetype=ruby
" "}}}

" Text "{{{
    autocmd BufRead,BufNewFile {*.txt} set filetype=text
    autocmd FileType text setlocal wrap linebreak nolist
" "}}}

" Vimrc "{{{
    autocmd BufWritePost {g,.g,,.}vimrc source $MYVIMRC | exe ":PowerlineReloadColorscheme"
" "}}}
