" https://github.com/norman/vim-files/blob/master/filetype.vim

if exists("did_load_filetypes")
  finish
endif

augroup filetypedetect
  " JSON
  au BufNewFile,BufRead *.json setf json

  " Ruby
  au BufNewFile,BufRead *.rb,*.rbw,*.gem,*.gemspec,*.ru,*.irbrc,Capfile,Gemfile,[rR]akefile,*.builder,*.rxml,*.rjs setf ruby
  au BufNewFile,BufRead *.erb,*.rhtml setf eruby
  au Filetype ruby nmap <F3> :!echo; zeus rspec %<CR>
  au Filetype ruby nmap <F4> :!ruby -I. -Itest -Ispec -Ilib %<CR>
  au Filetype ruby setlocal makeprg=ruby\ -c\ %
  au Filetype ruby setlocal errorformat=
      \%+E%f:%l:\ parse\ error,
      \%W%f:%l:\ warning:\ %m,
      \%E%f:%l:in\ %*[^:]:\ %m,
      \%E%f:%l:\ %m,
      \%-C%\tfrom\ %f:%l:in\ %.%#,
      \%-Z%\tfrom\ %f:%l,
      \%-Z%p^,
      \%-G%.%#

  " Lua
  au BufNewFile,BufRead *.lua,*rockspec setlocal filetype=lua makeprg=luac\ -p\ % errorformat=luac\:\ %f:%l:\ %m
  au Filetype lua nmap <F2> :!echo;make spec<CR>
  au Filetype lua nmap <F3> :!echo;make test<CR>
  au Filetype lua nmap <F4> :!lua %<CR>
  au Filetype lua nmap <F6> :!shake %<CR>

  " HTML
  au Filetype html nmap <F4> :!open -a 'Google Chrome' %<CR>

  " C
  au Filetype c setlocal shiftwidth=4 tabstop=4
  au Filetype c nmap <F3> :!echo; make test<CR>

augroup END
