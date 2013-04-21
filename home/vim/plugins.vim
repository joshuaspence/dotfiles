"/
"" Plugin configuration for {@link http://www.vim.org/ vim}.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugins.vim
"\

"" Vundle "{{{
  "" Required. "{{{
      set nocompatible
      filetype off
  "" "}}}

  set rtp+=~/.vim/bundle/vundle/
  call vundle#rc()

  "" Let Vundle manage Vundle (required).
  Bundle "gmarik/vundle"

  "" Mappings "{{{
      nmap <Leader>bi :BundleInstall<CR>
      nmap <Leader>bu :BundleInstall!<CR>
      nmap <Leader>bc :BundleClean<CR>
   "" "}}}
"" "}}}

source ~/.vim/plugins/abolish.vim
source ~/.vim/plugins/ack.vim
source ~/.vim/plugins/endwise.vim
source ~/.vim/plugins/eunuch.vim
source ~/.vim/plugins/fugitive.vim
source ~/.vim/plugins/NERDtree.vim
source ~/.vim/plugins/powerline.vim
source ~/.vim/plugins/rsi.vim
source ~/.vim/plugins/scriptease.vim
source ~/.vim/plugins/sleuth.vim
source ~/.vim/plugins/synastic.vim
source ~/.vim/plugins/vim-commentary.vim
source ~/.vim/plugins/vim-gitgutter.vim
source ~/.vim/plugins/vim-markdown.vim
source ~/.vim/plugins/vim-surround.vim


"" "{{{
    "" Automatically detect file types. Must turn on after Vundle.
    filetype plugin indent on
"" "}}}
