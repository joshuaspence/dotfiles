"/
"" Plugin configuration for {@link http://www.vim.org/ vim}.
""
"" @author Joshua Spence
"" @file   ~/.vim/bundles.vim
"\


"" Vundle "{{{
  set nocompatible
  filetype off " required

  set rtp+=~/.vim/bundle/vundle/
  call vundle#rc()

  " Let Vundle manage Vundle (required).
  Bundle "gmarik/vundle"
"" "}}}

" Features "{{{
    " Ack "{{{
        Bundle "ack.vim"
        noremap <LocalLeader># "ayiw:Ack <C-r>a<CR>
        vnoremap <LocalLeader># "ay:Ack <C-r>a<CR>
    " "}}}
" "}}}

" "{{{
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
" "}}}
