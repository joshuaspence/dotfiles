"/
"" @author Joshua Spence
"" @file   ~/.vim/plugin/functionality/mouse.vim
"\

"" Hide mouse after chars typed.
set mousehide

"" Mouse in all modes.
set mouse=a

"" Enable mouse support.
set mousemodel=extend
set selectmode=mouse

"" Mouse can control splits.
if has("gui_running")
  set mousefocus
endif
