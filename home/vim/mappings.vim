" Set leader to ','. Note: This line MUST come before any '<leader>' mappings.
let mapleader=","

nnoremap <silent> <LocalLeader>rs :source ~/.vimrc<CR>
nnoremap <silent> <LocalLeader>rt :tabnew ~/.vim/vimrc<CR>
nnoremap <silent> <LocalLeader>re :e ~/.vim/vimrc<CR>
nnoremap <silent> <LocalLeader>rd :e ~/.vim/ <CR>

" Tabs "{{{
    nnoremap <silent> <LocalLeader>[ :tabprev<CR>
    nnoremap <silent> <LocalLeader>] :tabnext<CR>
" "}}}

" Duplication "{{{
    vnoremap <silent> <LocalLeader>= yP
    nnoremap <silent> <LocalLeader>= YP
" "}}}

" Buffers "{{{
    nnoremap <silent> <LocalLeader>- :bd<CR>
" "}}}

" Split line(opposite to S-J joining line).
nnoremap <silent> <C-J> gEa<CR><ESC>ew 

"map <silent> <C-W>v :vnew<CR>
"map <silent> <C-W>s :snew<CR>

nnoremap # :let @/='\<<C-R>=expand("<cword>")<CR>\>'<CR>:set hls<CR>
nnoremap * #

map <S-CR> A<CR><ESC>
"
" Control+S and Control+Q are flow-control characters: disable them in your terminal settings.
" $ stty -ixon -ixoff
noremap <C-S> :update<CR>
vnoremap <C-S> <C-C>:update<CR>
inoremap <C-S> <C-O>:update<CR>
"
" show/Hide hidden Chars
map <silent> <F12> :set invlist<CR>     
"
" generate HTML version current buffer using current color scheme
map <silent> <LocalLeader>2h :runtime! syntax/2html.vim<CR> 
" " }}}

" This came from Greg V's dotfiles:
"      https://github.com/myfreeweb/dotfiles
" Feel free to steal it, but attribution is nice
" 
" Thanks: see vimrc

" Change the mapleader from '\' to ','.
let mapleader=","
let maplocalleader = "\\"

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

" http://vimbits.com/bits/16
noremap H ^
noremap L $

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

" case-insensitive
command! E e
command! W w
command! Q q
command! Wq wq
command! WQ wq

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

" Motion for numbers.  Great for CSS.  Lets you do things like this:
" margin-top: 200px; -> daN -> margin-top: px;
onoremap N :<c-u>call <SID>NumberTextObject(0)<cr>
xnoremap N :<c-u>call <SID>NumberTextObject(0)<cr>
onoremap aN :<c-u>call <SID>NumberTextObject(1)<cr>
xnoremap aN :<c-u>call <SID>NumberTextObject(1)<cr>
onoremap iN :<c-u>call <SID>NumberTextObject(1)<cr>
xnoremap iN :<c-u>call <SID>NumberTextObject(1)<cr>
function! s:NumberTextObject(whole)
    normal! v
    while getline('.')[col('.')] =~# '\v[0-9]'
        normal! l
    endwhile
    if a:whole
        normal! o
        while col('.') > 1 && getline('.')[col('.') - 2] =~# '\v[0-9]'
            normal! h
        endwhile
    endif
endfunction

" Tired of clearing highlighted searches by searching for “ldsfhjkhgakjks”? Use this:
" @link http://nvie.com/posts/how-i-boosted-my-vim/
nmap <silent> ,/ :nohlsearch<CR>
