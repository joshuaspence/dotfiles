" Allow saving of files as `sudo` when I forgot to start Vim using `sudo`.
cmap w!! execute 'silent! write !sudo tee >/dev/null %' <bar> edit!
