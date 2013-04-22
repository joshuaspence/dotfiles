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
"" "}}}

"" Bundles "{{{
  Bundle 'abolish.vim'
  Bundle 'airblade/vim-gitgutter'
  Bundle 'ack.vim'
  Bundle 'closetag.vim'
  Bundle 'commentary.vim'
  Bundle 'endwise.vim'
  Bundle 'fugitive.vim'
  Bundle 'Indent-Guides'
  Bundle 'kablamo/vim-git-log'
  Bundle 'lastpos.vim'
  Bundle 'Lokaltog/powerline'
  Bundle 'Markdown'
  Bundle 'scrooloose/nerdcommenter'
  Bundle 'scrooloose/nerdtree'
  Bundle 'scrooloose/syntastic'
  Bundle 'sickill/vim-pasta'
  Bundle 'surround.vim'
  Bundle 'Tabular'
  Bundle 'tpope/vim-abolish'
  Bundle 'tpope/vim-eunuch'
  Bundle 'tpope/vim-rsi'
  Bundle 'tpope/vim-scriptease'
  Bundle 'tpope/vim-sleuth'
  Bundle 'trailing-whitespace'
  Bundle 'upAndDown'
  Bundle 'ZoomWin'
"" "}}}

"" "{{{
  "" Automatically detect file types. Must turn on after Vundle.
  filetype plugin indent on
"" "}}}
