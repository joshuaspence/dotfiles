if !isdirectory($HOME.'/.vim/backup')
  call mkdir($HOME.'/.vim/backup')
endif
set backupdir=~/.vim/backup

if !isdirectory($HOME.'/.vim/swap')
  call mkdir($HOME.'/.vim/swap')
endif
set directory=~/.vim/swap

if exists('&undodir')
  if !isdirectory($HOME.'/.vim/undo')
    call mkdir($HOME.'/.vim/undo')
  endif
  set undodir=~/.vim/undo
  set undofile
endif
