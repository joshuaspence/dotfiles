" Regular Vim Configuration (No Plugins Needed)
"
" @link http://github.com/gmarik/vimfiles/blob/master/vimrc

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
        
        " prepend(^=) $HOME/.tmp/ to default path. Use full path as backup
        " filename(//).
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
    " "}}}}

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
        set wildmode=full wildmenu

        " vim will ignore file patterns specified in option 'wildignore'.
        set wildignore+=*.bmp,*.gif,*.jpg,*.jpeg,*.png     " binary images
        set wildignore+=*.class,classes,*.luac,*.pyc,*.rbc " byte code and stuff
        set wildignore+=*.dll,*.exe,*.manifest,*.o,*.obj   " compiled object files
        set wildignore+=*.aux,*.out,*.toc                  " LaTeX intermediate files
        set wildignore+=.bzr,.git,.hg,.svn                 " version control
        set wildignore+=*.sw?                              " vim swap files
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
        set mouse=a
        "set ttymouse=xterm2

        " Mouse can control splits.
        if has("gui_running")
          set mousefocus
        endif
    " "}}}

    " Folding "{{{
    if has("folding")
        " Turn on folding.
        set foldenable

        set foldcolumn=3

        " Fold on the marker.
        set foldmethod=marker
        
        " Don't autofold anything (but I can still fold manually).
        set foldlevel=100

        " What movements open folds.
        set foldopen=block,hor,mark,percent,quickfix,tag
    endif
    " "}}}

    " Window splitting "{{{
        " Split windows below current window.
        set splitbelow

        set splitright
    " "}}}
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
        " The current buffer can be put to the background without writing to
        " disk.
        set hidden
    " "}}}

    " Don't clear the screen when exiting `vim`.
    " @link http://www.shallowsky.com/linux/noaltscreen.html
    set t_ti= t_te=

    " Don't update while in macro.
    set lazyredraw

    " Optimize for fast terminal connections. Sends more characters for redraws.
    " Improves redrawing.
    set ttyfast
" "}}}
