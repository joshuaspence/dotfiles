"===============================================================================
" Regular Vim Configuration (No plugins needed).
"===============================================================================

" General "{{{
    " Disable vi compatibility.
    set nocompatible

   " Use UTF-8 without BOM.
    set encoding=utf-8 nobomb

    " Number of lines of command line history to keep.
    set history=1000

    " Time to wait after ESC (default causes an annoying delay).
    set timeoutlen=250

    " Use the OS clipboard by default.
    set clipboard+=unnamed

    " Toggle between paste and normal: for 'safer' pasting from keyboard.
    set pastetoggle=<F10>

    " Walk directory tree up to $HOME looking for tags.
    set tags=./tags;$HOME

    " Modeline "{{{
        set modeline
        
        " Default numbers of lines to read for modeline instructions.
        set modelines=5
    " "}}}

    " Backup "{{{
        set nowritebackup
        set nobackup
        
        " prepend(^=) $HOME/.tmp/ to default path. Use full path as backup filename(//).
        set directory=/tmp//
    " "}}}

    " Persistent Undo "{{{
        if has("persistent_undo")
            set undofile
            set undodir=~/.vim/.undo
        endif
    " "}}}

    " View options "{{{
        " Cursor position in file and window.
        set viewoptions+=cursor

        " Manually created folds, opened/closed folds and local fold options.
        set viewoptions+=folds

        " Options and mappings local to a window or buffer.
        set viewoptions+=options

        " Backslashes in file names replaced with forward slashes.
        set viewoptions+=slash

        " With Unix end-of-line format, even when on Windows or DOS.
        set viewoptions+=unix
    " "}}}
" "}}}

" Visual "{{{
    " Color "{{{
        " We plan to use a dark background.
        set background=dark
    " "}}}

    " Show line numbers.
    set number
    
    " Ruler "{{{
        " Show the ruler.
        set ruler

        " Display current column/line.
        set rulerformat=%l,%c ruler
    " "}}}

    " Highlight the current column.
    set cursorcolumn

    " Highlight the current line.
    set cursorline

    " Line wrapping "{{{
        " Line wrapping off.
        set nowrap

        set textwidth=0
    " "}}}

    " Format options "{{{
        " Support for numbered/bullet lists.
        set formatoptions+=n

        " Automatically insert the current comment leader after hitting 'o' or 'O' in Normal mode.
        set formatoptions+=o
        
        " Do not automatically insert a comment leader after an enter.
        set formatoptions-=r

        " Do not auto-wrap text using textwidth (does not apply to comments).
        set formatoptions-=t
    " "}}}

    " Wild mode "{{{
        " Command-line tab completion.
        set wildmode=full

        set wildmenu

        " vim will ignore certain file patterns. "{{{
            " Binary images.
            set wildignore+=*.bmp,*.gif,*.jpg,*.jpeg,*.png

            " Byte code and stuff.
            set wildignore+=*.class,classes,*.luac,*.pyc,*.rbc
            
            " Compiled object files.
            set wildignore+=*.dll,*.exe,*.manifest,*.o,*.obj

            " LaTeX intermediate files.
            set wildignore+=*.aux,*.out,*.toc

            " Version control.
            set wildignore+=.bzr,.git,.hg,.svn

            " vim swap files.
            set wildignore+=*.sw?
        " "}}}
    " "}}}

    " Completion "{{{
        set complete=.,w,b,u,t
        set completeopt=longest,menu,menuone,preview
    " "}}}

    " Status line "{{{
        " Always show the status line.
        set laststatus=2
        set statusline=
        set statusline+=%F          " full path to file in the buffer
        set statusline+=%m          " modified flag in square brackets
        set statusline+=%r          " readonly flag in square brackets
        set statusline+=%h          " help flag in square brackets
        set statusline+=%w          " preview flag in square brackets
        set statusline+=%=          " right align
        set statusline+=[%L]        " number of lines
        set statusline+=[%{&ff}]    " current fileformat
        set statusline+=%y          " current syntax in square brackets
        set statusline+=[%p%%]      " current % into file
        set statusline+=[%04l,%04v] " current row, current column
    " "}}}

    " Commands "{{{
        " Display an incomplete command in the lower right corner of the vim window.
        set showcmd

        " Make the command area two lines high.
        set cmdheight=2
    " "}}}

    " Bracket matching "{{{
        " Show matching brackets.
        set showmatch

        " How many tenths of a second to blink.
        set matchtime=5
    " "}}}

    " Sounds "{{{
        " No noise.
        set noerrorbells

        " No blinking.
        set novisualbell

        " ???
        set t_vb=
    " "}}}

    " Match and Search "{{{
        " Highlight search.
        set hlsearch

        " Case insensitive matching.
        set ignorecase
        
        " Case sensitive matching when there's a capital letter.
        set smartcase

        " Show the 'best match so far' as search strings are typed.
        set incsearch
    " "}}}

    " Set the title of the window in the terminal to the file.
    set title

    " Shortens messages "{{{
        set shortmess=

        set shortmess+=a

        set shortmess+=t

        set shortmess+=I
    " "}}}
" "}}}

" Functionality "{{{
    " More powerful backspacing.
    set backspace=indent,eol,start

    " Tabs "{{{
        " Set the default tabstop.
        set tabstop=4 softtabstop=4

        " Set the default shift width for indents.
        set shiftwidth=4
        
        " Make tabs into spaces (set by tabstop).
        set expandtab
        
        " Smarter tab levels.
        set smarttab
    " "}}}

    " Indenting "{{{
        set autoindent
        set smartindent
        set cindent
        set cinoptions=:s,ps,ts,cs
        set cinwords=if,else,while,do,for,switch,case
    " "}}}

    " Enable syntax highlighting.
    syntax on

    " Don't highlight minified js and stuff.
    set synmaxcol=500

    " Automatically detect file types.
    filetype plugin indent on

    " Mouse "{{{
        " Hide mouse after chars typed.
        set mousehide

        " Mouse in all modes.
        set mouse=a

        " Enable mouse support.
        set mousemodel=extend
        set selectmode=mouse

        " Mouse can control splits.
        if has("gui_running")
          set mousefocus
        endif
    " "}}}

    " Folding "{{{
       if has("folding")
            " Turn on folding.
            set foldenable

            " A column with the specified width is shown at the side of the window which indicates open and closed folds.
            set foldcolumn=3

            " Fold on the marker.
            set foldmethod=marker
            
            " Don't autofold anything (but I can still fold manually).
            set foldlevel=100

            " What movements open folds "{{{
                set foldopen=
                set foldopen+=block
                set foldopen+=hor
                set foldopen+=mark
                set foldopen+=percent
                set foldopen+=quickfix
                set foldopen+=tag
            " "}}}
        endif
    " "}}}

    " Window splitting "{{{
        " Split windows below current window.
        set splitbelow

        " Split windows to the right of the current window.
        set splitright
    " "}}}

    " "{{{
        " Display unprintable characters (<F12> switches).
        set nolist

        " Unprintable chars mapping
        set listchars=tab:·\ ,eol:¶,trail:·,extends:»,precedes:«
    " "}}}

    " Keep three lines below the last line when scrolling
    set scrolloff=3

    " Don't go to the start of the line after some commands.
    set nostartofline
" "}}}

" Spelling "{{{
    " Set the dictionary.
    set dictionary=/usr/share/dict/words

    if v:version >= 700
        setlocal spell spelllang=en
        nmap ,ll :set spell!</cr><cr>
        nmap ,le :set spelllang=en</cr><cr>
        nmap ,lp :set spelllang=pt</cr><cr>
    endif

    " Correct some spelling mistakes. "{{{
        ia teh      the
        ia htis     this
        ia tihs     this
        ia funciton function
        ia fucntion function
        ia funtion  function
        ia retunr   return
        ia reutrn   return
        ia sefl     self
        ia eslf     self
    " "}}}
" "}}}

" Advanced "{{{
    " This will save the file when you switch buffers.
    set autowrite

    " Set to auto read when a file is changed from the outside.
    set autoread

    " Buffers "{{{
        " The current buffer can be put to the background without writing to disk.
        set hidden
    " "}}}

    " Don't update while in macro.
    set lazyredraw

    " Optimize for fast terminal connections. Sends more characters for redraws. Improves redrawing.
    set ttyfast
" "}}}



" Tell vim to remember certain things when we exit
"  '10  :  marks will be remembered for up to 10 previously edited files
"  "100 :  will save up to 100 lines for each register
"  :20  :  up to 20 lines of command-line history will be remembered
"  %    :  saves and restores the buffer list
"  n... :  where to save the viminfo files
set viminfo='10,\"100,:20,%,n~/.viminfo
