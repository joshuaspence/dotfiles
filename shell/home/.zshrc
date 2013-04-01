# Path to your oh-my-zsh configuration.
ZSH=$HOME/.oh-my-zsh

# Set name of the theme to load.
# Look in ~/.oh-my-zsh/themes/
# Optionally, if you set this to "random", it'll load a random theme each
# time that oh-my-zsh is loaded.
ZSH_THEME="robbyrussell"

# Example aliases
# alias zshconfig="mate ~/.zshrc"
# alias ohmyzsh="mate ~/.oh-my-zsh"

# Set to this to use case-sensitive completion
# CASE_SENSITIVE="true"

# Comment this out to disable bi-weekly auto-update checks
# DISABLE_AUTO_UPDATE="true"

# Uncomment to change how many often would you like to wait before auto-updates occur? (in days)
# export UPDATE_ZSH_DAYS=13

# Uncomment following line if you want to disable colors in ls
# DISABLE_LS_COLORS="true"

# Uncomment following line if you want to disable autosetting terminal title.
# DISABLE_AUTO_TITLE="true"

# Uncomment following line if you want red dots to be displayed while waiting for completion
# COMPLETION_WAITING_DOTS="true"

# Which plugins would you like to load? (plugins can be found in ~/.oh-my-zsh/plugins/*)
# Custom plugins may be added to ~/.oh-my-zsh/custom/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
plugins=(git vagrant urltools thor svn sublime sprunge phing pip nyan npm lol github git-flow git-hubflow git-extras gem encode64 debian composer python)

source $ZSH/oh-my-zsh.sh

# Customize to your needs...
export PATH=/home/joshua/bin:/home/joshua/bin:/usr/local/texlive/2011/bin/x86_64-linux:/usr/lib/lightdm/lightdm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games

# exports
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games:$HOME/.bin
export TERM='rxvt-unicode'
export EDITOR='vim'

for file in `ls -1 ~/.aliases`
do
     source ~/.aliases/"$file"
done

# terminal related settings
export LS_COLORS="ow=01;94:di=01;94"
zstyle ':completion:*:default' list-colors ${(s.:.)LS_COLORS}
bindkey "^[[7~" beginning-of-line
bindkey "^[[8~" end-of-line

# zsh options
setopt extended_glob

