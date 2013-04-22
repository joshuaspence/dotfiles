"/
"" Plugin configuration for {@link http://www.vim.org/ vim}.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/bundles.vim
"\

"" Vundle "{{{
  "" Ensure that the `~/.vim/bundle/` system works. "{{{
    set nocompatible
    filetype off
    set rtp+=~/.vim/bundle/vundle/
    call vundle#rc()
  "" "}}}
"" "}}}
 
"" Let Vundle manage Vundle (required).
Bundle 'gmarik/vundle'

"" Bundles "{{{
  Bundle 'airblade/vim-gitgutter'
  Bundle 'flazz/vim-colorschemes'
  Bundle 'godlygeek/tabular'
  Bundle 'kablamo/vim-git-log'
  Bundle 'Lokaltog/powerline'
  Bundle 'mattn/gist-vim'
  Bundle 'mattn/webapi-vim'
  Bundle 'mileszs/ack.vim'
  Bundle 'myusuf3/numbers.vim'
  Bundle 'nathanaelkane/vim-indent-guides'
  Bundle 'scrooloose/nerdcommenter'
  Bundle 'scrooloose/nerdtree'
  Bundle 'scrooloose/syntastic'
  Bundle 'sickill/vim-pasta'
  Bundle 'thinca/vim-template'
  Bundle 'tpope/vim-abolish'
  Bundle 'tpope/vim-commentary'
  Bundle 'tpope/vim-endwise'
  Bundle 'tpope/vim-eunuch'
  Bundle 'tpope/vim-fugitive'
  Bundle 'tpope/vim-markdown'
  Bundle 'tpope/vim-rsi'
  Bundle 'tpope/vim-scriptease'
  Bundle 'tpope/vim-sleuth'
  Bundle 'tpope/vim-surround'
  Bundle 'trailing-whitespace'
  Bundle 'vim-scripts/closetag.vim'
  Bundle 'vim-scripts/lastpos.vim'
  Bundle 'vim-scripts/SearchComplete'
  Bundle 'vim-scripts/upAndDown'
  Bundle 'vim-scripts/ZoomWin'

  "" Languages "{{{
    Bundle 'elzr/vim-json'
    Bundle 'groenewege/vim-less'
    Bundle 'pangloss/vim-javascript'
    Bundle 'puppetlabs/puppet-syntax-vim'
  "" "}}}
"" "}}}

"" "{{{
  "" Automatically detect file types. Must turn on after Vundle.
  filetype plugin indent on
"" "}}}
