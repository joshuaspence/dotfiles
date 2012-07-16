"=========================
" GENERAL
"=========================

" explicitly get out of vi-compatible mode
set nocompatible

" we plan to use a dark background
set background=dark

" syntax highlighting on
syntax on

" load filetype plugins/indent settings
filetype plugin indent on 

" always switch to the current file directory
set autochdir

" make backspace more flexible
set backspace=indent,eol,start

" make backup files
set backup

" Keep history
set history=100

" support all three, in this order
set fileformats=unix,dos,mac

" none of these are word dividers
set iskeyword+=_,$,@,%,#

" Make the autocompletion of filenames,etc behave like bash
set wildmode=longest,list

"=========================
" VIM UI
"=========================
" highlight the current column
set cursorcolumn

" highlight current line
"set cursorline

" do highlight as you type you search phrase
set incsearch 

" always show the status line
set laststatus=2

" do not redraw while running macros
set lazyredraw

" don't insert any extra pixel lines between rows
"set linespace=0 

" we do want to show tabs
set list

" show tabs and trailing spaces
set listchars=tab:>-,trail:-

" how many tenths of a second to blink matching brackets for
set matchtime=5

" turn on line numbers
set number

" We are good up to 99999 lines
set numberwidth=5

" Always show current positions along the bottom
set ruler

" show matching brackets
set showmatch

" Show the filename title in xterms
set title

set statusline=%F%m%r%h%w[%L][%{&ff}]%y[%p%%][%04l,%04v]
"              | | | | |  |   |      |  |     |    |
"              | | | | |  |   |      |  |     |    + current column
"              | | | | |  |   |      |  |     +-- current line
"              | | | | |  |   |      |  +-- current % into file
"              | | | | |  |   |      +-- current syntax in square brackets
"              | | | | |  |   +-- current fileformat
"              | | | | |  +-- number of lines
"              | | | | +-- preview flag in square brackets
"              | | | +-- help flag in square brackets
"              | | +-- readonly flag in square brackets
"              | +-- modified flag in square brackets
"              +-- full path to file in the buffer

"=========================
" TEXT FORMATTING / LAYOUT
"=========================
" no real tabs
set expandtab

"case insensitive by defaulted
set ignorecase

" case inferred by default
set infercase

"do not wrap line
set nowrap

" if there are caps, go case-sensitive
set smartcase

" auto-indent amount when using cindent, >>, << and stuff like that
set shiftwidth=4

" when hitting tab or backspace, how many spaces should a tab be (see expandtab)
set softtabstop=4

" real tabs should be 8, and they will show with set list on
set tabstop=8

" Automatically continue indentation across lines .
" Keep indentation structure (tabs, spaces, etc) when autoindenting.
" Automatically indent new lines after specific keywords or braces.
set autoindent
set copyindent

"=========================
" OTHER
"=========================
let g:tex_flavor = "latex"
