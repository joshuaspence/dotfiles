"/
"" Plugin configuration for {@link http://www.vim.org/ vim} with
"" {@link http://github.com/gmarik/vundle Vundle}.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/bundles.vim
"\

"" Vundle pre-commands. @{{{
    "" Ensure that the `~/.vim/bundle/` system works. @{{{
        set nocompatible
        filetype off
        set rtp+=~/.vim/bundle/vundle/
        call vundle#rc()
    "" @}}}

    "" Let Vundle manage Vundle.
    Bundle 'gmarik/vundle'
"" @}}}

"" Bundles @{{{
    Bundle 'airblade/vim-gitgutter'
    Bundle 'flazz/vim-colorschemes'
    Bundle 'godlygeek/tabular'
    Bundle 'mattn/gist-vim'
    Bundle 'mattn/webapi-vim'
    Bundle 'mileszs/ack.vim'
    Bundle 'nathanaelkane/vim-indent-guides'
    Bundle 'scrooloose/nerdtree'
    Bundle 'scrooloose/syntastic'
    Bundle 'sickill/vim-pasta'
    Bundle 'thinca/vim-template'
    Bundle 'tpope/vim-commentary'
    Bundle 'tpope/vim-endwise'
    Bundle 'tpope/vim-eunuch'
    Bundle 'tpope/vim-fugitive'
    Bundle 'tpope/vim-markdown'
    Bundle 'tpope/vim-scriptease'
    Bundle 'tpope/vim-sleuth'
    Bundle 'tpope/vim-surround'
    Bundle 'trailing-whitespace'
    Bundle 'vim-scripts/closetag.vim'
    Bundle 'vim-scripts/lastpos.vim'
    Bundle 'vim-scripts/upAndDown'
"" @}}}

"" Vundle post-commands. @{{{
    "" Automatically detect file types. Must turn on after Vundle.
    filetype plugin indent on
"" @}}}
