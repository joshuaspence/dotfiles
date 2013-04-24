"/
"" Command-line tab completion.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/command-line/wildmode.vim
"\

set wildmenu
set wildmode=full

set wildignore+=*.bmp,*.gif,*.jpg,*.jpeg,*.png
set wildignore+=*.class,classes,*.luac,*.pyc,*.rbc
set wildignore+=*.dll,*.exe,*.manifest,*.o,*.obj
set wildignore+=*.aux,*.out,*.toc
set wildignore+=.bzr,.git,.hg,.svn
set wildignore+=*.sw?
