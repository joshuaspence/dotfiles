"/
"" Options for Insert mode completion.
""
"" @author Joshua Spence
"" @file   ~/.vim/plugin/editing/completion.vim
"\

set completeopt=

"" Only insert the longest common text of the matches.
set completeopt+=longest

"" Use a popup menu to show the possible completions.
set completeopt+=menu

"" Use the popup menu also when there is only one match.
set completeopt+=menuone

"" Show extra information about the currently selected completion in the preview
"" window.
set completeopt+=preview
