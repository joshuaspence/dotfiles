"===============================================================================
" General
"===============================================================================

" Behave like Vim instead of Vi.
set nocompatible

" We plan to use a dark background.
set background=dark

" Turn on color syntax highlighting.
syntax on

" Always switch to the current file directory.
set autochdir

" Allow backspace in insert mode.
set backspace=indent,eol,start

" Use the OS clipboard by default (on versions compiled with `+clipboard`).
set clipboard=unnamed

" Enhance command-line completion.
set wildmenu
set wildmode=longest,list

" Allow cursor keys in insert mode.
set esckeys

" Disable error bells.
set noerrorbells

" Don’t reset cursor to start of line when moving around.
set nostartofline

" When a file has been detected to have been changed outside of Vim and it has
" not been changed inside of Vim, automatically read it again.
set autoread

" Number of lines of command line history to keep.
set history=100

" Use UTF-8 without BOM.
set encoding=utf-8 nobomb

" Use ack-grep  instead of grep.
set grepprg=ack-grep\ -a

"===============================================================================
" Advanced
"===============================================================================

" Optimize for fast terminal connections. Sends more characters for redraws.
set ttyfast

" Keep a backup file.
set backup
set backupdir=~/.vim/backups

" Centralize backups, swapfiles and undo history
set backupdir=~/.vim/backups
"set directory=~/.vim/swaps
"if exists("&undodir")
"    set undodir=~/.vim/undo
"endif

"===============================================================================
" Vundle
"===============================================================================

filetype off
set rtp+=~/.vim/bundle/vundle/
call vundle#rc()
filetype plugin indent on
Bundle 'gmarik/vundle'

"===============================================================================
" Plugins
"===============================================================================

Bundle 'tpope/vim-fugitive'
Bundle 'mattn/webapi-vim'
Bundle 'mattn/gist-vim'
Bundle 'henrik/vim-indexed-search'
Bundle 'scrooloose/nerdtree'
Bundle 'Valloric/YouCompleteMe'
Bundle 'godlygeek/tabular'
Bundle 'tomtom/tcomment_vim'
Bundle 'motemen/git-vim'
Bundle 'airblade/vim-gitgutter'
Bundle 'tpope/vim-surround'
Bundle 'sickill/vim-pasta'
Bundle 'tpope/vim-markdown'

" Gist
" https://github.com/mattn/gist-vim
let g:gist_clip_command = 'xclip -selection clipboard'
let g:gist_detect_filetype = 1
let g:gist_browser_command = 'google-chrome %URL% &'
let g:gist_open_browser_after_post = 1

" Better surround.
let g:surround_40 = "(\r)"
let g:surround_91 = "[\r]"
let g:surround_60 = "<\r>"

"===============================================================================
" User Interface
"===============================================================================

" Highlight the current column.
set cursorcolumn

" Highlight current line.
"set cursorline

" Do highlight as you type you search phrase.
set incsearch

" Nice statusbar.
set laststatus=2
set statusline=
set statusline+=%F            " full path to file in the buffer
set statusline+=%m            " modified flag in square brackets
set statusline+=%r            " readonly flag in square brackets
set statusline+=%h            " help flag in square brackets
set statusline+=%w            " preview flag in square brackets
set statusline+=%=            " right align
set statusline+=[%L]          " number of lines
set statusline+=[%{&ff}]      " current fileformat
set statusline+=%y            " current syntax in square brackets
set statusline+=[%p%%]        " current % into file
set statusline+=[%04l,%04v]   " current row, current column

" Do not redraw while running macros.
set lazyredraw

" We do want to show tabs.
set list

" How many tenths of a second to blink matching brackets for.
set matchtime=5

" Turn on line numbers.
set number

" Always show current positions along the bottom.
set ruler

" Show matching brackets.
set showmatch

" Show the filename title in xterms.
set title

" Enable mouse use in all modes.
set mouse=a
set ttymouse=xterm2

" The completion menu is controlled by completeopt. You can set multiple values
" to combine behaviours.
set completeopt=menu,menuone,preview

"===============================================================================
" Text formatting and layout
"===============================================================================

" No real tabs.
set expandtab

" Do not wrap lines.
set nowrap

" Auto-indent amount when using cindent, >>, << and stuff like that.
set shiftwidth=4

" When hitting tab or backspace, how many spaces should a tab be (see expandtab).
set softtabstop=4

" Real tabs should be 8, and they will show with set list on.
set tabstop=4

" Highlight unwanted spaces.
set listchars=tab:▸\ ,trail:·,eol:¬,nbsp:_

"===============================================================================
" Automatic commands
"===============================================================================

autocmd BufNewFile,BufRead *.css set fdm=marker fmr={,}
autocmd BufNewFile,BufRead *.md set spell
autocmd BufNewFile,BufRead *.markdown set spell
