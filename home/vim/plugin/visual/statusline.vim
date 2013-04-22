"/
"" @author Joshua Spence
"" @file   ~/.vim/plugin/visual/statusline.vim
"\

"" Always show the status line.
set laststatus=2

set statusline=

"" Full path to file in the buffer.
set statusline+=%F

"" Modified flag in square brackets.
set statusline+=%m

"" Readonly flag in square brackets.
set statusline+=%r

"" Help flag in square brackets.
set statusline+=%h

"" Preview flag in square brackets.
set statusline+=%w

"" Right align.
set statusline+=%=

"" Number of lines.
set statusline+=[%L]

"" Current fileformat.
set statusline+=[%{&ff}]

"" Current syntax in square brackets.
set statusline+=%y

"" Current % into file.
set statusline+=[%p%%]

"" Current row, current column.
set statusline+=[%04l,%04v]
