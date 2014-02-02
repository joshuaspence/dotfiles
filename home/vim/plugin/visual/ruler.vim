"/
"" Show the ruler.
"\

if has('cmdline_info')
    set ruler

    if has('statusline')
        "" Display current column/line in the ruler.
        set rulerformat=%l,%c ruler
    endif
endif
