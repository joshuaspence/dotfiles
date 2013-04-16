@link http://github.com/gmarik/vimfiles/blob/master/vimrc
@link http://github.com/norman/vim-files/blob/master/filetype.vim
https://github.com/myfreeweb/dotfiles


$ mkdir -p /tmp/vimtest && cd /tmp/vimtest                               # create and cd to test folder
$ git clone --recursive https://github.com/gmarik/vimfiles.git ./.vim    # clone recursively with vundle
$ HOME=`pwd` vim -u .vim/vimrc +BundleInstall +qall                     # run installation in relative to current folder
                                                                        # and using downloaded `vimrc`
$ HOME=`pwd` vim -u .vim/vimrc                                          # Start using Vim
