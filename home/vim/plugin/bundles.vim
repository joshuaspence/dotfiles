"/
"" Plugin configuration for {@link http://www.vim.org/ vim}.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/bundles.vim
"\

"" Vundle "{{{
  "" Required. "{{{
    set nocompatible
    filetype off
  "" "}}}

  set rtp+=~/.vim/bundle/vundle/
  call vundle#rc()

  "" Let Vundle manage Vundle (required).
  Bundle 'gmarik/vundle'

  "" Mappings "{{{
    
  "" "}}}
"" "}}}

"" Bundles "{{{
  Bundle 'abolish.vim'
  Bundle 'ack.vim'
  Bundle 'commentary.vim'
  Bundle 'endwise.vim'
  Bundle 'fugitive.vim'
  Bundle 'scrooloose/nerdtree'
  Bundle 'surround.vim'
  Bundle 'tope/eunuch'

  "Bundle "airblade/vim-gitgutter"
  "Bundle "tpope/vim-markdown"
  "Bundle "powerline"
  "Bundle "rsi.vim"
  "Bundle "scriptease.vim"
  "Bundle "sleuth.vim"
  "Bundle "synastic.vim"
"" "}}}

"" "{{{
  "" Automatically detect file types. Must turn on after Vundle.
  filetype plugin indent on
"" "}}}
