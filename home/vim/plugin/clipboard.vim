" Clipboard configuration.
if has('clipboard') && has('gui')
    if has('x')
        " On Linux use + register for copy-paste.
        set clipboard=unnamedplus
    else
        " On Mac and Windows use * register for copy-paste.
        set clipboard=unnamed
    endif
endif
