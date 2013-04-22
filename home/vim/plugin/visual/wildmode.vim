"/
"" @author Joshua Spence
"" @file   ~/.vim/plugin/visual/wildmode.vim
"\

"" Command-line tab completion.
set wildmode=full

set wildmenu

"" vim will ignore certain file patterns. "{{{
  "" Binary images.
  set wildignore+=*.bmp,*.gif,*.jpg,*.jpeg,*.png

  "" Byte code and stuff.
  set wildignore+=*.class,classes,*.luac,*.pyc,*.rbc
      
  "" Compiled object files.
  set wildignore+=*.dll,*.exe,*.manifest,*.o,*.obj

  "" LaTeX intermediate files.
  set wildignore+=*.aux,*.out,*.toc

  "" Version control.
  set wildignore+=.bzr,.git,.hg,.svn

  "" vim swap files.
  set wildignore+=*.sw?
"" "}}}
