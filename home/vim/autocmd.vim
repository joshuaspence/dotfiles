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
