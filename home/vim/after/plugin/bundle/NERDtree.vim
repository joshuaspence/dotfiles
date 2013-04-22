"/
"" @author Joshua Spence
"" @file   ~/.vim/after/plugin/bundle/NERDtree.vim
"\

"" Make NERDtree look nice.
let NERDTreeMinimalUI = 1
let NERDTreeDirArrows = 1
let g:NERDTreeWinSize = 30

"" Auto open nerd tree on startup.
let g:nerdtree_tabs_open_on_gui_startup = 0

"" Focus in the main content window.
let g:nerdtree_tabs_focus_on_files = 1

"" Map a specific key or shortcut to open NERDTree.
map <C-n> :NERDTreeToggle<CR>
