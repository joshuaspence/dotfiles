" This came from Greg V's dotfiles:
"      https://github.com/myfreeweb/dotfiles
" Feel free to steal it, but attribution is nice
"
" Thanks: see vimrc

au BufRead,BufNewFile {Gem,Rake,Cap,Vagrant,Thor,Guard}file,config.ru setf ruby
au BufRead,BufNewFile *.{md,markdown,mdown,mkd,mkdn,ronn} setf markdown
au BufRead,BufNewFile {SConstruct,SConscript,*.py} setf python.django
au BufRead,BufNewFile *.{nu,nujson},Nukefile setf nu
au BufRead,BufNewFile *.json setf javascript
au BufRead,BufNewFile *.emblem setf slim
au BufRead,BufNewFile *.conf setf config
au BufRead,BufNewFile *.ledger setf ledger | comp ledger
au BufRead,BufNewFile *gitconfig setf gitconfig
au BufRead,BufNewFile nginx.conf setf nginx
au BufRead,BufNewFile *.gradle setf groovy
au BufRead,BufNewFile *.sbt setf scala
au BufRead,BufNewFile *.scaml setf haml
au BufRead,BufNewFile *muttrc setf muttrc
au BufRead,BufNewFile quakelive.cfg setf quake
au BufRead,BufNewFile *.{css,sass,scss,less,styl} setlocal omnifunc=csscomplete#CompleteCSS
au BufRead,BufNewFile *.{css,sass,scss,less,styl} setlocal iskeyword+=-
au BufRead,BufNewFile {*.go,Makefile,.git*,*gitconfig} setlocal noexpandtab
au BufRead,BufNewFile *.{jar,war,ear,sar} setf zip
au BufRead,BufNewFile {,.}zshrc,*.fish setlocal foldmethod=marker
au BufRead,BufNewFile *.fish setf tcsh
au BufWritePost {g,.g,,.}vimrc source $MYVIMRC | exe ":PowerlineReloadColorscheme"
au BufReadPost fugitive://* setlocal bufhidden=delete
au BufReadPost * if line("'\"") > 1 && line("'\"") <= line("$") | exe "normal! g`\"" | endif
au VimResized * exe "normal! \<c-w>="
au FileType {vim,javascript} setlocal foldmethod=marker
au BufWinEnter *.txt if &ft == 'help' | wincmd L | endif
au InsertEnter * set number
au InsertLeave * set relativenumber

autocmd BufNewFile,BufRead *.css set fdm=marker fmr={,}
autocmd BufNewFile,BufRead *.md set spell
autocmd BufNewFile,BufRead *.markdown set spell


autocmd BufRead *.json set filetype=javascript " clojure filetype:
autocmd BufRead *.as set filetype=actionscript " actionscript syntax:
autocmd BufRead *.clj set filetype=clojure     " clojure filetype:
autocmd BufRead *.mxml set filetype=mxml       " mxml files:


au BufRead,BufNewFile *.rpdf       set ft=ruby
au BufRead,BufNewFile *.rxls       set ft=ruby
au BufRead,BufNewFile *.ru         set ft=ruby
au BufRead,BufNewFile *.god        set ft=ruby
au BufRead,BufNewFile *.rtxt       set ft=html spell
au BufRead,BufNewFile *.sql        set ft=pgsql
au BufRead,BufNewFile *.rl         set ft=ragel
au BufRead,BufNewFile *.svg        set ft=svg
au BufRead,BufNewFile *.haml       set ft=haml
au BufRead,BufNewFile *.md         set ft=mkd tw=80 ts=2 sw=2 expandtab
au BufRead,BufNewFile *.markdown   set ft=mkd tw=80 ts=2 sw=2 expandtab
au BufRead,BufNewFile *.ronn       set ft=mkd tw=80 ts=2 sw=2 expandtab

au Filetype gitcommit set tw=68  spell
au Filetype ruby      set tw=80  ts=2
au Filetype html,xml,xsl,rhtml source $HOME/.vim/scripts/closetag.vim

" Set File type to 'text' for files ending in .txt
autocmd BufNewFile,BufRead *.txt setfiletype text

" Enable soft-wrapping for text files
autocmd FileType text,markdown,html,xhtml,eruby setlocal wrap linebreak nolist

" Automatically load .vimrc source when saved
autocmd BufWritePost .vimrc source $MYVIMRC




" Command and Auto commands " {{{
" Sudo write
comm! W exec 'w !sudo tee % > /dev/null' | e!

"Auto commands
au BufRead,BufNewFile {Gemfile,Rakefile,Capfile,*.rake,config.ru}     set ft=ruby
au BufRead,BufNewFile {*.md,*.mkd,*.markdown}                         set ft=markdown
au BufRead,BufNewFile {COMMIT_EDITMSG}                                set ft=gitcommit

au BufReadPost * if line("'\"") > 0 && line("'\"") <= line("$") | execute "normal g'\"" | endif " restore position in file
" " }}}
