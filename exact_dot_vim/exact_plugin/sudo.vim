" Allow saving of files as `sudo` when I forgot to start Vim using `sudo`. The file name is shell-escaped so that `tee`
" writes the right file, and the buffer is only reloaded if the write succeeded so that a failed `sudo` keeps the edits.
cnoremap <expr> w!! getcmdtype() ==# ':' ? "execute 'silent write !sudo tee >/dev/null ' . shellescape(expand('%'), 1) <bar> if !v:shell_error <bar> edit! <bar> endif" : 'w!!'
