Reading Materials
=================
- http://amix.dk/vim/vimrc.html
- http://dougireton.com/blog/2013/02/23/layout-your-vimrc-like-a-boss/
- https://github.com/sorin-ionescu/prezto
- https://github.com/rtomayko/shocco/blob/master/shocco.sh#commit
- https://pypi.python.org/pypi/Stallion
- http://www.git-legit.org/


Packages
========
- apt-get
- perlrun
- ruby
- python
- sudo
- tar
- crontab
- df
- hub


Shell
=====
```
## @link https://github.com/mikemcquaid/dotfiles

# 077 would be more secure, but 022 is more useful.
umask 022

## @link https://github.com/thomasf/dotfiles-thomasf-base/blob/master/.bin/home-fix
# Ensure sane file modes for some important files and directories
if [ -d "${HOME}/.ssh" ]; then
    chmod 700 ~/.ssh
    chmod 600 ~/.ssh/*
fi
if [ -d "${HOME}/.gnupg" ]; then
    chmod 700 -R ~/.gnupg
fi

[ -d "${HOME}/.subversion" ] && chmod 700 "${HOME}/.subversion"
```


vim
===
```
" Tell vim to remember certain things when we exit
"  '10  :  marks will be remembered for up to 10 previously edited files
"  "100 :  will save up to 100 lines for each register
"  :20  :  up to 20 lines of command-line history will be remembered
"  %    :  saves and restores the buffer list
"  n... :  where to save the viminfo files
set viminfo='10,\"100,:20,%,n~/.viminfo


set cf                                " error files / jumping
set ffs=unix,dos,mac                  " support these files
set isk+=_,$,@,%,#,-                  " none word dividers
set viminfo='1000,f1,:100,@100,/20

if &t_Co > 2 || has("gui_running")
  if has("terminfo")
    set t_Co=16
    set t_AB=[%?%p1%{8}%<%t%p1%{40}%+%e%p1%{92}%+%;%dm
    set t_AF=[%?%p1%{8}%<%t%p1%{30}%+%e%p1%{82}%+%;%dm
  else
    set t_Co=16
    set t_Sf=[3%dm
    set t_Sb=[4%dm
  endif
  syntax on
  set hlsearch
  colorscheme slate2
endif

" Highlight
highlight Comment         ctermfg=DarkGrey guifg=#444444
highlight StatusLineNC    ctermfg=Black ctermbg=DarkGrey cterm=bold
highlight StatusLine      ctermbg=Black ctermfg=LightGrey

" Highlight Trailing Whitespace
set list listchars=trail:.,tab:>.
highlight SpecialKey ctermfg=DarkGray ctermbg=Black

" jump to last position of buffer when opening
au BufReadPost * if line("'\"") > 0 && line("'\"") <= line("$") |
                         \ exe "normal g'\"" | endif

" ---------------------------------------------------------------------------
"  sh config
" ---------------------------------------------------------------------------

au Filetype sh,bash set ts=4 sts=4 sw=4 expandtab
let g:is_bash = 1


" ---------------------------------------------------------------------------
"  Misc mappings
" ---------------------------------------------------------------------------

" duplicate current tab with same file+line
map ,t :tabnew %<CR>

" open directory dirname of current file, and in new tab
map ,d :e %:h/<CR>
map ,dt :tabnew %:h/<CR>

" open gf under cursor in new tab
map ,f :tabnew <cfile><CR>

" open tag under cursor in new tab
map <C-\> :tab split<CR>:exec("tag ".expand("<cword>"))<CR>

function! Browser ()
    let line0 = getline (".")
    let line = matchstr (line0, "http[^ )]*")
    let line = escape (line, "#?&;|%")
    exec ':silent !open ' . "\"" . line . "\""
endfunction
map ,w :call Browser ()<CR>

" ---------------------------------------------------------------------------
"  Strip all trailing whitespace in file
" ---------------------------------------------------------------------------

function! StripWhitespace ()
    exec ':%s/ \+$//gc'
endfunction
map ,s :call StripWhitespace ()<CR>

au Filetype gitcommit set tw=68  spell
au Filetype ruby      set tw=80  ts=2

" make file executable
command -nargs=* Xe !chmod +x <args>
command! -nargs=0 Xe !chmod +x %

#===============================================================================
# Dotfiles
#===============================================================================
https://github.com/vim-scripts/pythoncomplete
https://github.com/vim-scripts/python_match.vim
http://www.vim.org/scripts/script.php?script_id=790
https://github.com/arnaud-lb/vim-php-namespace
https://github.com/honza/vim-snippets
https://github.com/garbas/vim-snipmate
https://github.com/mbbill/undotree
https://github.com/jistr/vim-nerdtree-tabs
https://github.com/bogado/file-line
http://dotfiles.org/.vimrc
https://github.com/ervandew/supertab
https://github.com/Shougo/neocomplcache
https://github.com/twe4ked/vim-diff-toggle
https://github.com/vim-scripts/bufkill.vim
https://github.com/dterei/VimBookmarking
https://github.com/Lokaltog/vim-easymotion
https://github.com/linsong/dot_vim

#===============================================================================
# Bundles
#===============================================================================
Bundle "othree/html5.vim"
Bundle "kchmck/vim-coffee-script"
Bundle "hail2u/vim-css3-syntax"
Bundle "tpope/vim-haml"
Bundle "pangloss/vim-javascript"
Bundle "nelstrom/vim-markdown-folding"
Bundle "vim-scripts/argtextobj.vim"
Bundle "vim-scripts/delimitMate.vim"
Bundle "troydm/easybuffer.vim"
Bundle "vim-scripts/FuzzyFinder"
Bundle "mattn/gist-vim"
Bundle "Valloric/MatchTagAlways"
Bundle "fs111/pydoc.vim"
Bundle "sjl/splice.vim"
Bundle "AndrewRadev/splitjoin.vim"
Bundle "vim-scripts/taglist.vim"
Bundle "vim-scripts/TaskList.vim"

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

" Snippets
Bundle "http://github.com/gmarik/snipmate.vim.git"

" Git integration
Bundle "git.zip"

" (HT|X)ml tool
Bundle "ragtag.vim"

" Utility
Bundle "repeat.vim"
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

Bundle 'nvie/vim-flake8'
Bundle 'mattsacks/vim-fuzzee'
Bundle 'tpope/vim-git'
Bundle 'henrik/vim-indexed-search'
Bundle 'tpope/vim-speeddating'
Bundle 'mattn/webapi-vim'
Bundle 'Valloric/YouCompleteMe'
Bundle 'mattn/zencoding-vim'

" Don't show the mode since Powerline shows it.
set noshowmode

" Navigation
Bundle 'ZoomWin'
" This fork is required due to remapping ; to :
Bundle 'christoomey/vim-space'
Bundle 'Lokaltog/vim-easymotion'
Bundle 'kien/ctrlp.vim'
" UI Additions
Bundle 'Rykka/colorv.vim'
Bundle 'nanotech/jellybeans.vim'
Bundle 'mhinz/vim-signify'
" Commands
Bundle 'rking/ag.vim'
Bundle 'milkypostman/vim-togglelist'
Bundle 'AndrewRadev/sideways.vim'
Bundle 'scratch.vim'
Bundle 'mattn/zencoding-vim'
Bundle 'mutewinter/GIFL'
Bundle 'swaroopch/vim-markdown-preview'
Bundle 'AndrewRadev/switch.vim'
Bundle 'itspriddle/vim-marked'
Bundle 'mutewinter/UnconditionalPaste'
Bundle 'skalnik/vim-vroom'
Bundle 'HelpClose'
Bundle 'mattn/gist-vim'
Bundle 'nelstrom/vim-visual-star-search'
" Automatic Helpers
Bundle 'IndexedSearch'
Bundle 'xolox/vim-session'
Bundle 'Raimondi/delimitMate'
Bundle 'Valloric/MatchTagAlways'
Bundle 'Valloric/YouCompleteMe'
" Language Additions
"   Ruby
Bundle 'vim-ruby/vim-ruby'
Bundle 'tpope/vim-haml'
Bundle 'tpope/vim-rails'
Bundle 'tpope/vim-rake'
"   JavaScript
Bundle 'pangloss/vim-javascript'
Bundle 'kchmck/vim-coffee-script'
Bundle 'leshill/vim-json'
"   HTML
Bundle 'nono/vim-handlebars'
Bundle 'othree/html5.vim'
Bundle 'indenthtml.vim'
"   TomDoc
Bundle 'mutewinter/tomdoc.vim'
Bundle 'jc00ke/vim-tomdoc'
"   Other Languages
Bundle 'msanders/cocoa.vim'
Bundle 'mutewinter/taskpaper.vim'
Bundle 'mutewinter/nginx.vim'
Bundle 'timcharper/textile.vim'
Bundle 'mutewinter/vim-css3-syntax'
Bundle 'acustodioo/vim-tmux'
Bundle 'plasticboy/vim-markdown'
Bundle 'groenewege/vim-less'
Bundle 'wavded/vim-stylus'
Bundle 'tpope/vim-cucumber'
" MatchIt
Bundle 'matchit.zip'
Bundle 'kana/vim-textobj-user'
Bundle 'nelstrom/vim-textobj-rubyblock'
" Libraries
Bundle 'L9'
Bundle 'tpope/vim-repeat'
Bundle 'mattn/webapi-vim'

" ----------------------------------------
" Plugin Configuration
" ----------------------------------------

" ---------------
" space.vim
" ---------------
" Disables space mappings in select mode to fix snipMate.
let g:space_disable_select_mode=1

" ---------------
" Syntastic
" ---------------
let g:syntastic_enable_signs=1
let g:syntastic_auto_loc_list=1
let g:syntastic_mode_map = { 'mode': 'active',
                           \ 'active_filetypes': [],
                           \ 'passive_filetypes': ['scss'] }

" Platform-specific config files
if has('win32') || has('win64')
  let g:syntastic_jsl_conf=$HOME.'/.vim/config/windows/syntastic/jsl.conf'
  let g:syntastic_disabled_filetypes=['sh'] " Disable .sh on Windows
endif

" ---------------
" NERDTree
" ---------------
nmap <silent> <leader>d :execute 'NERDTreeToggle ' . getcwd()<CR>
nnoremap <leader>nn :NERDTreeToggle<CR>
nnoremap <leader>nf :NERDTreeFind<CR>
let g:NERDTreeShowBookmarks=1
let g:NERDTreeChDirMode=2 " Change the NERDTree directory to the root node
let g:NERDTreeMinimalUI=1
autocmd bufenter * if (winnr("$") == 1 && exists("b:NERDTreeType")
  \&& b:NERDTreeType == "primary") | q | endif

" ---------------
" Indent Guides
" ---------------
let g:indent_guides_enable_on_vim_startup=1

" ---------------
" Session
" ---------------
let g:session_autosave=0
let g:session_autoload=0
nnoremap <leader>os :OpenSession<CR>

" ---------------
" SpeedDating
" ---------------
let g:speeddating_no_mappings=1 " Remove default mappings (C-a etc.)
nmap <silent><leader>dm <Plug>SpeedDatingDown
nmap <silent><leader>dp <Plug>SpeedDatingUp
nmap <silent><leader>dn <Plug>SpeedDatingNowUTC

" ---------------
" Tabular
" ---------------
nmap <Leader>t= :Tabularize /=<CR>
vmap <Leader>t= :Tabularize /=<CR>
nmap <Leader>t: :Tabularize /:\zs<CR>
vmap <Leader>t: :Tabularize /:\zs<CR>
nmap <Leader>t, :Tabularize /,\zs<CR>
vmap <Leader>t, :Tabularize /,\zs<CR>
nmap <Leader>t> :Tabularize /=>\zs<CR>
vmap <Leader>t> :Tabularize /=>\zs<CR>
nmap <Leader>t- :Tabularize /-<CR>
vmap <Leader>t- :Tabularize /-<CR>
nmap <Leader>t" :Tabularize /"<CR>
vmap <Leader>t" :Tabularize /"<CR>

" ---------------
" Fugitive
" ---------------
nmap <Leader>gc :Gcommit -v<CR>
nmap <Leader>gw :Gwrite<CR>
nmap <Leader>gs :Gstatus<CR>
nmap <Leader>gp :Git push<CR>
 " Mnemonic, gu = Git Update
nmap <Leader>gu :Git pull<CR>
nmap <Leader>gd :Gdiff<CR>
" Exit a diff by closing the diff window
nmap <Leader>gx :wincmd h<CR>:q<CR>

" ---------------
" Zoomwin
" ---------------
" Zoom Window to Full Size
nmap <silent> <leader>wo :ZoomWin<CR>

" ---------------
" ctrlp.vim
" ---------------
" Ensure Ctrl-P isn't bound by default
let g:ctrlp_map = ''

" Ensure max height isn't too large. (for performance)
let g:ctrlp_max_height = 10

" Leader Commands
nnoremap <leader>t :CtrlPRoot<CR>
nnoremap <leader>b :CtrlPBuffer<CR>
nnoremap <leader>u :CtrlPCurFile<CR>
nnoremap <leader>m :CtrlPMRUFiles<CR>
nnoremap <leader>b :CtrlPBuffer<CR>

" ---------------
" Powerline
" ---------------
" Keep ^B from showing on Windows in Powerline
if has('win32') || has('win64')
  let g:Powerline_symbols = 'compatible'
elseif has('gui_macvim')
  let g:Powerline_symbols = 'fancy'
endif
call Pl#Theme#InsertSegment('ws_marker', 'after', 'lineinfo')

" Abbreviate All of the Mode Names
let g:Powerline_mode_n = 'N'
let g:Powerline_mode_i = 'I'
let g:Powerline_mode_R = 'R'
let g:Powerline_mode_v = 'V'
let g:Powerline_mode_V = 'VL'
let g:Powerline_mode_cv = 'VB'
let g:Powerline_mode_s = 'S'
let g:Powerline_mode_S = 'SL'
let g:Powerline_mode_cs = 'SB'

" ---------------
" jellybeans.vim colorscheme tweaks
" ---------------
" Make cssAttrs (center, block, etc.) the same color as units
hi! link cssAttr Constant

" ---------------
" Ag.vim
" ---------------
nmap <silent> <leader>as :AgFromSearch<CR>
nmap <leader>ag :Ag<space>

" ---------------
" surround.vim
" ---------------
" Use # to get a variable interpolation (inside of a string)}
" ysiw#   Wrap the token under the cursor in #{}
" Thanks to http://git.io/_XqKzQ
let g:surround_35  = "#{\r}"

" ---------------
" Gifl - Google I'm Feeling Lucky URL Grabber
" ---------------
let g:LuckyOutputFormat='markdown'
" I sometimes run vim without ruby support.
let g:GIFLSuppressRubyWarning=1

" ------------
" sideways.vim
" ------------
noremap gs :SidewaysRight<cr>
noremap gS :SidewaysLeft<cr>

" ---------------
" Markdown-Preview
" ---------------
nmap <Leader>md :MarkdownPreview<CR>
vmap <Leader>md :MarkdownPreview<CR>

" ---------------
" switch.vim
" ---------------
nnoremap - :Switch<cr>

" ---------------
" indenthtml
" ---------------
" Setup indenthtml to propertly indent html. Without this, formatting doesn't
" work on html.
let g:html_indent_inctags = "html,body,head,tbody"
let g:html_indent_script1 = "inc"
let g:html_indent_style1 = "inc"

" ---------------
" vim-markdown
" ---------------
let g:vim_markdown_folding_disabled=1

" ---------------
" Unconditional Paste
" ---------------
let g:UnconditionalPaste_NoDefaultMappings=1
nmap gcP <Plug>UnconditionalPasteCharBefore
nmap gcp <Plug>UnconditionalPasteCharAfter

" ---------------
" Gist.vim
" ---------------
if has('macunix') || has('mac')
  let g:gist_clip_command = 'pbcopy'
endif
let g:gist_post_private=1

" ---------------
" MatchTagAlways
" ---------------
let g:mta_filetypes = {
    \ 'html' : 1,
    \ 'xhtml' : 1,
    \ 'xml' : 1,
    \ 'handlebars' : 1,
    \}

" ---------------
" YouCompleteMe
" ---------------
let g:ycm_complete_in_comments_and_strings=1
let g:ycm_collect_identifiers_from_comments_and_strings=1

" ---------------
" vim-signify
" ---------------
let g:signify_mapping_next_hunk="<leader>sn"
let g:signify_mapping_prev_hunk="<leader>sp"
let g:signify_mapping_toggle_highlight="<nop>"
let g:signify_mapping_toggle="<nop>"

" ---------------
" vim-abolish
" ---------------
nnoremap <leader>su :Subvert/
nnoremap <leader>ss :%Subvert/

nmap <silent> <leader>g :GitGutterToggle<CR>
nmap <C-c> <ESC>:TComment<CR>

autocmd FileType make     set noexpandtab
autocmd FileType python   set noexpandtab

"===============================================================================
" Mappings
"===============================================================================

" Unload current buffer and delete it from the buffer list.
nnoremap <silent> <localleader>- :bd<CR>


" Split line (opposite to S-J joining line).
nnoremap <silent> <C-J> gEa<CR><ESC>ew


" http://vimbits.com/bits/16
noremap H ^
noremap L $

nnoremap # :let @/='\<<C-R>=expand("<cword>")<CR>\>'<CR>:set hls<CR>
nnoremap * #

map <S-CR> A<CR><ESC>

" Control+S and Control+Q are flow-control characters: disable them in your terminal settings.
" $ stty -ixon -ixoff
noremap <C-S> :update<CR>
vnoremap <C-S> <C-C>:update<CR>
inoremap <C-S> <C-O>:update<CR>

" generate HTML version current buffer using current color scheme
map <silent> <localleader>2h :runtime! syntax/2html.vim<CR>

" j and k inverted for colemak
noremap k gj
noremap j gk

" Less keystrokes
nnoremap ; :
vnoremap ; :
nnoremap ' i
vnoremap ' i
nnoremap U <C-r>
nnoremap Y y$
map <Leader>d :bd<CR>

" folds
nnoremap <Space> za
vnoremap <Space> za

" remove search highlights
nnoremap <CR> :nohlsearch<CR>

" unfuck the screen
nnoremap <leader>u :syntax sync fromstart<cr>:redraw!<cr>

" select (charwise) the contents of the current line, excluding indentation.
" great for pasting Python lines into REPLs.
nnoremap vv ^vg_

" keep the cursor in place while joining lines
nnoremap J mzJ`z

" insert mode completion
inoremap <c-f> <c-x><c-f>
inoremap <c-]> <c-x><c-]>}

" don't move on *
nnoremap * *<C-o>

" Easy window navigation
" @link http://nvie.com/posts/how-i-boosted-my-vim/
map <C-h> <C-w>h
map <C-k> <C-w>j
map <C-j> <C-w>k
map <C-l> <C-w>l

" emacs bindings in insert and command
inoremap <C-a> <home>
inoremap <C-e> <end>
cnoremap <C-a> <home>
cnoremap <C-e> <end>

" buffer nav
nnoremap <Right> :bnext<CR>
nnoremap <Left>  :bprev<CR>

" List nav
nnoremap <Up>    :cprev<CR>zvzz
nnoremap <Down>  :cnext<CR>zvzz

" plugins and stuff
nmap <Leader>T= :Tabularize /=<CR>
vmap <Leader>T= :Tabularize /=<CR>
nmap <Leader>T<Space> :Tabularize /<Space><CR>
vmap <Leader>T<Space> :Tabularize /<Space><CR>
nmap <Leader>T: :Tabularize /:\zs<CR>
vmap <Leader>T: :Tabularize /:\zs<CR>
nmap sk :SplitjoinSplit<CR>
nmap sj :SplitjoinJoin<CR>
map <Leader>w :w<CR>
map <Leader>W :SudoWrite<CR>
map <Leader>a :Ack!
map <Leader>m :Rename
map <Leader>rb :RunRubyFocusedTest<CR>
map <Leader>c :VimuxPromptCommand<CR>
map <Leader>r :VimuxRunLastCommand<CR>
map <Leader>vq :VimuxCloseRunner<CR>
map <Leader>vx :VimuxInterruptRunner<CR>
nnoremap <Leader>b :silent !open <C-R>=escape("<C-R><C-F>", "#?&;\|%")<CR><CR> " open URLs
autocmd FileType python map <Leader>8 :call Flake8()<CR>
let g:ctrlp_map = '<Leader>p'
nnoremap <Leader>t :CtrlPTag<CR>
```
