"" Configuration for {@link http://github.com/gmarik/vundle Vundle}.

set nocompatible
filetype off

" Set the runtime path to include Vundle and initialize.
set rtp+=~/.vim/bundle/vundle/
call vundle#begin()

" Let Vundle manage Vundle.
Bundle 'gmarik/vundle'

" Bundles
Bundle 'airblade/vim-gitgutter'
Bundle 'flazz/vim-colorschemes'
Bundle 'godlygeek/tabular'
Bundle 'nathanaelkane/vim-indent-guides'
Bundle 'scrooloose/nerdtree'
Bundle 'scrooloose/syntastic'
Bundle 'tpope/vim-fugitive'
Bundle 'trailing-whitespace'

call vundle#end()
filetype plugin indent on
