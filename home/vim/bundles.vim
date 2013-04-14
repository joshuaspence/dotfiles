" Vundle "{{{
    set nocompatible
    filetype off " required

    set rtp+=~/.vim/bundle/vundle/
    call vundle#rc()

    " Let Vundle manage Vundle (required).
    Bundle "gmarik/vundle"
" "}}}

" Languages "{{{
    Bundle "othree/html5.vim"
    Bundle "kchmck/vim-coffee-script"
    Bundle "hail2u/vim-css3-syntax"
    Bundle "tpope/vim-haml"
    Bundle "pangloss/vim-javascript"
    Bundle "tpope/vim-markdown"
    Bundle "nelstrom/vim-markdown-folding"
" "}}}

" Features "{{{
    Bundle "mileszs/ack.vim"
    Bundle "vim-scripts/argtextobj.vim"
    Bundle "vim-scripts/delimitMate.vim"
    Bundle "troydm/easybuffer.vim"
    Bundle "vim-scripts/FuzzyFinder"
    Bundle "mattn/gist-vim"
    Bundle "Valloric/MatchTagAlways"
    Bundle "scrooloose/nerdtree"
    Bundle "fs111/pydoc.vim"
    Bundle "sjl/splice.vim"
    Bundle "AndrewRadev/splitjoin.vim"
    Bundle "ervandew/supertab"
    Bundle "scrooloose/syntastic"
    Bundle "godlygeek/tabular"
    Bundle "vim-scripts/taglist.vim"
    Bundle "vim-scripts/TaskList.vim"
" "}}}
" tComment
Bundle 'tomtom/tcomment_vim'
Bundle "tComment"
nnoremap // :TComment<CR>
vnoremap // :TComment<CR>

" trying this 
Bundle "YankRing.vim"
Bundle "http://github.com/thinca/vim-quickrun.git"
Bundle "http://github.com/thinca/vim-poslist.git"
Bundle "http://github.com/mattn/gist-vim.git"
Bundle "http://github.com/rstacruz/sparkup.git", {'rtp': 'vim/'}

" Programming
Bundle "jQuery"
Bundle "rails.vim"

" Snippets
Bundle "http://github.com/gmarik/snipmate.vim.git"

" Syntax highlight
Bundle "cucumber.zip"
Bundle "Markdown"

" Git integration
Bundle "git.zip"
Bundle "fugitive.vim"

" (HT|X)ml tool
Bundle "ragtag.vim"

" Utility
Bundle "repeat.vim"
Bundle "surround.vim"
Bundle "SuperTab"
Bundle "file-line"
Bundle "Align"

" FuzzyFinder
Bundle "L9"
Bundle "FuzzyFinder"
let g:fuf_modesDisable = [] " {{{
nnoremap <silent> <LocalLeader>h :FufHelp<CR>
nnoremap <silent> <LocalLeader>2  :FufFileWithCurrentBufferDir<CR>
nnoremap <silent> <LocalLeader>@  :FufFile<CR>
nnoremap <silent> <LocalLeader>3  :FufBuffer<CR>
nnoremap <silent> <LocalLeader>4  :FufDirWithCurrentBufferDir<CR>
nnoremap <silent> <LocalLeader>$  :FufDir<CR>
nnoremap <silent> <LocalLeader>5  :FufChangeList<CR>
nnoremap <silent> <LocalLeader>6  :FufMruFile<CR>
nnoremap <silent> <LocalLeader>7  :FufLine<CR>
nnoremap <silent> <LocalLeader>8  :FufBookmark<CR> 
nnoremap <silent> <LocalLeader>*  :FuzzyFinderAddBookmark<CR><CR>
nnoremap <silent> <LocalLeader>9  :FufTaggedFile<CR> 
" " }}}

" Zoomwin
Bundle "ZoomWin"
noremap <LocalLeader>o :ZoomWin<CR>
vnoremap <LocalLeader>o <C-C>:ZoomWin<CR>
inoremap <LocalLeader>o <C-O>:ZoomWin<CR>
noremap <C-W>+o :ZoomWin<CR>

" Ack
Bundle "ack.vim"
noremap <LocalLeader># "ayiw:Ack <C-r>a<CR>
vnoremap <LocalLeader># "ay:Ack <C-r>a<CR>


Bundle 'tpope/vim-commentary'
Bundle 'tpope/vim-endwise'
Bundle 'tpope/vim-eunuch'
Bundle 'nvie/vim-flake8'
Bundle 'tpope/vim-fugitive'
Bundle 'mattsacks/vim-fuzzee'
Bundle 'tpope/vim-git'
Bundle 'airblade/vim-gitgutter'
Bundle 'henrik/vim-indexed-search'
Bundle 'sickill/vim-pasta'
Bundle 'tpope/vim-rsi'
Bundle 'tpope/vim-speeddating'
Bundle 'tpope/vim-surround'
Bundle 'mattn/webapi-vim'
Bundle 'Valloric/YouCompleteMe'
Bundle 'mattn/zencoding-vim'

filetype plugin indent on " required

" Automatically detect file types. (must turn on after Vundle)
filetype plugin indent on

"
" Brief help
" :BundleList          - list configured bundles
" :BundleInstall(!)    - install(update) bundles
" :BundleSearch(!) foo - search(or refresh cache first) for foo
" :BundleClean(!)      - confirm(or auto-approve) removal of unused bundles
"
" see :h vundle for more details or wiki for FAQ
" NOTE: comments after Bundle command are not allowed.


" Don't show the mode since Powerline shows it.
    set noshowmode
