http://www.joshstaiger.org/archives/2005/07/bash_profile_vs.html

bash
====
According to the `man bash`, `.bash_profile` is executed for login shells, while
`.bashrc` is executed for interactive non-login shells.

When you login (type username and password) via console, either sitting at the machine, or remotely via ssh: .bash_profile is executed to configure your shell before the initial command prompt.
But, if you’ve already logged into your machine and open a new terminal window (xterm) inside Gnome or KDE, then .bashrc is executed before the window command prompt. .bashrc is also run when you start a new bash instance by typing /bin/bash in a terminal.

Say, you’d like to print some lengthy diagnostic information about your machine each time you login (load average, memory usage, current users, etc). You only want to see it on login, so you only want to place this in your .bash_profile. If you put it in your .bashrc, you’d see it every time you open a new terminal window.

An exception to the terminal window guidelines is Mac OS X’s Terminal.app, which runs a login shell by default for each new terminal window, calling .bash_profile instead of .bashrc. Other GUI terminal emulators may do the same, but most tend not to.

http://stackoverflow.com/a/903213/1369417

You only log in once, and that's when ~/.bash_profile or ~/.profile is read and executed. Since everything you run from your login shell inherits the login shell's environment, you should put all your environment variables in there. Like LESS, PATH, MANPATH, LC_*, ...

Non-login shells only execute ~/.bashrc, not /.profile or ~/.bash_profile, for this exact reason, so in there define everything that only applies to bash. That's functions, aliases, bash-only variables like HISTSIZE (this is not an environment variable, don't export it!), shell options with set and shopt, etc.

Now, as part of UNIX peculiarity, a login-shell does NOT execute ~/.bashrc but only ~/.profile or ~/.bash_profile, so you should source that one manually from the latter.

http://hacktux.com/bash/bashrc/bash_profile

Login Shells (.bash_profile)

A login shell is a bash shell that is started with - or --login. The following are examples that will invoke a login shell.

sudo su -
bash --login
ssh user@host

When BASH is invoked as a login shell, the following files are executed in the displayed order.

/etc/profile
~/.bash_profile
~/.bash_login
~/.profile
Although ~/.bashrc is not listed here, most default ~/.bash_profile scripts run ~/.bashrc.

Purely Interactive Shells (.bashrc)

Interactive shells are those not invoked with -c and whose standard input and output are connected to a terminal. Interactive shells do not need to be login shells. Here are some examples that will evoke an interactive shell that is not a login shell.

sudo su
bash
ssh user@host /path/to/command

In this case of an interactive but non-login shell, only ~/.bashrc is executed. In most cases, the default ~/.bashrc script executes the system's /etc/bashrc.

Be warned that you should never echo output to the screen in a ~/.bashrc file. Otherwise, commands like 'ssh user@host /path/to/command' will echo output unrelated to the command called.

Non-interactive shells

Non-interactive shells do not automatically execute any scripts like ~/.bashrc or ~/.bash_profile. Here are some examples of non-interactive shells.

su user -c /path/to/command
bash -c /path/to/command
