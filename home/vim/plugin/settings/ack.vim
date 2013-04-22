"/
"" @author Joshua Spence
"" @file   ~/.vim/plugins/ack.vim
"\

"" Mappings. "{{{
    noremap <LocalLeader># "ayiw:Ack <C-r>a<CR>
    vnoremap <LocalLeader># "ay:Ack <C-r>a<CR>
"" "}}}

if executable('ack-grep')
    let g:ackprg="ack-grep -H --nocolor --nogroup --column"
    Bundle 'mileszs/ack.vim'
elseif executable('ack')
    Bundle 'mileszs/ack.vim'
elseif executable('ag')
    Bundle 'mileszs/ack.vim'
    let g:ackprg = 'ag --nogroup --nocolor --column'
endif
