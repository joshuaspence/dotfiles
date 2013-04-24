#/
## @author Joshua Spence
## @file   ~/.pythonrc
##
## @link http://valueerror.wordpress.com/2009/11/03/python-shell-history-autocompletion-and-rc-file/
## @link http://docs.python.org/2/library/rlcompleter.html
## @link http://gist.github.com/mgedmin/760273
## @link http://github.com/thomasf/dotfiles-thomasf-base/blob/master/.config-base/python/pythonrc.py
#\


## Command-line history.
##
## @link http://valueerror.wordpress.com/2009/11/03/python-shell-history-autocompletion-and-rc-file/
def _pythonrc_enable_history():
    import os
    import sys

    try:
        import readline
    except ImportError as e:
        sys.stderr.write(str(e) + " - Command-line history is disabled.\n")
    else:
        # The history file.
        PYHISTORY = os.path.expanduser('~/.pyhistory')

        # Restore command-line history.
        if os.path.isfile(PYHISTORY):
            readline.read_history_file(PYHISTORY)

        # Save command-line history when Python exits.
        try:
            import atexit
        except ImportError as e:
            sys.stderr.write(str(e) + " - Command-line history will not be saved when Python exits.\n")
        else:
            atexit.register(readline.write_history_file, PYHISTORY)

        # Set history size.
        readline.set_history_length(10000000)


## Tab completion.
##
## @link http://docs.python.org/2/library/rlcompleter.html
def _pythonrc_enable_completion():
    import sys

    try:
        import readline
        import rlcompleter
    except ImportError as e:
        sys.stderr.write(str(e) + " - Tab completion is disabled.\n")
    else:
        class IrlCompleter(rlcompleter.Completer):
            '''Identical to rlcompleter.Completer except that a "tab" insertion
            is enabled if there's no text for completion.

            The default "tab" is four spaces. You can initialize this class with
            "\t" as the tab if you wish to use a genuine tab instead.
            '''

            def __init__(self, tab='    '):
                self.tab = tab
                rlcompleter.Completer.__init__(self)

            def complete(self, text, state):
                if text == '':
                    readline.insert_text(self.tab)
                    return None
                else:
                    return rlcompleter.Completer.complete(self, text, state)

        # You could change this line to bind another key instead of tab.
        readline.parse_and_bind('tab: complete')
        readline.set_completer(IrlCompleter().complete)


## Colored prompt.
##
## @link http://gist.github.com/mgedmin/760273
def _pythonrc_set_prompt():
    import os
    import sys

    if os.getenv('TERM') in ('xterm', 'vt100', 'rxvt', 'Eterm', 'putty'):
        if 'readline' in sys.modules:
            # ^A and ^B delimit invisible characters for readline to count
            # right.
            sys.ps1 = '\001\033[0;32m\002>>> \001\033[0m\002'
            sys.ps2 = '\001\033[0;32m\002... \001\033[0m\002'
        else:
            sys.ps1 = '\033[0;32m>>> \033[0m'
            sys.ps2 = '\033[0;32m... \033[0m'


## Enable pretty printing of evaluated expressions.
##
## @link http://github.com/thomasf/dotfiles-thomasf-base/blob/master/.config-base/python/pythonrc.py
def _pythonrc_enable_pprint():
    import pprint
    import sys

    # Set the exception hook (sys.excepthook).
    try:
        if sys.platform == 'win32':
            raise ImportError

        from cStringIO import StringIO
        from pygments import highlight
        from pygments.lexers import PythonLexer, PythonTracebackLexer
        from pygments.formatters import TerminalFormatter

        def pphighlight(o, *a, **kw):
            s = pprint.pformat(o, *a, **kw)
            try:
                sys.stdout.write(highlight(s, PythonLexer(), TerminalFormatter()))
            except UnicodeError:
                sys.stdout.write(s + '\n')

        # Save the old excepthook.
        _old_excepthook = sys.excepthook

        def excepthook(exctype, value, traceback):
            '''Prints exceptions to sys.stderr and colorizes them.'''

            # traceback.format_exception() isn't used because it's inconsistent
            # with the built-in formatter.
            old_stderr = sys.stderr
            sys.stderr = StringIO()
            try:
                _old_excepthook(exctype, value, traceback)
                s = sys.stderr.getvalue()
                try:
                    s = highlight(s, PythonTracebackLexer(), TerminalFormatter())
                except UnicodeError:
                    pass
                old_stderr.write(s)
            finally:
                sys.stderr = old_stderr

        # Set the exception hook.
        sys.excepthook = excepthook
    except ImportError:
        pphighlight = pprint.pprint

    try:
        import __builtin__
    except ImportError:
        import builtins as __builtin__
    import inspect
    import pydoc
    import sys
    import types

    help_types = [types.BuiltinFunctionType, types.BuiltinMethodType,
                  types.FunctionType, types.MethodType, types.ModuleType,
                  type, type(list.remove)]
    if hasattr(types, 'UnboundMethodType'):
        help_types.append(types.UnboundMethodType)
    help_types = tuple(help_types)

    def _ioctl_width(fd):
        from fcntl import ioctl
        from struct import pack, unpack
        from termios import TIOCGWINSZ
        return unpack('HHHH', ioctl(fd, TIOCGWINSZ, pack('HHHH', 0, 0, 0, 0)))[1]

    def get_width():
        '''Returns terminal width.'''

        width = 0
        try:
            width = _ioctl_width(0) or _ioctl_width(1) or _ioctl_width(2)
        except ImportError:
            pass
        if not width:
            import os
            width = os.environ.get('COLUMNS', 0)
        return width

    if hasattr(inspect, 'getfullargspec'):
        getargspec = inspect.getfullargspec
    else:
        getargspec = inspect.getargspec

    def pprinthook(value):
        '''Pretty print an object to sys.stdout and also save it in
        __builtin__.
        '''

        if value is None:
            return
        __builtin__._ = value

        if isinstance(value, help_types):
            reprstr = repr(value)
            try:
                if inspect.isfunction(value):
                    parts = reprstr.split(' ')
                    parts[1] += inspect.formatargspec(*getargspec(value))
                    reprstr = ' '.join(parts)
                elif inspect.ismethod(value):
                    parts = reprstr[:-1].split(' ')
                    parts[2] += inspect.formatargspec(*getargspec(value))
                    reprstr = ' '.join(parts) + '>'
            except TypeError:
                pass
            sys.stdout.write(reprstr)
            sys.stdout.write('\n')
            if getattr(value, '__doc__', None):
                sys.stdout.write('\n')
                sys.stdout.write(pydoc.getdoc(value))
                sys.stdout.write('\n')
        else:
            pphighlight(value, width=get_width() or 80)

    # Set the display hook.
    sys.displayhook = pprinthook


if __name__ == '__main__':
    __doc__ = None

    # Make sure modules in the current directory can't interfere.
    import sys
    try:
        try:
            cwd = sys.path.index('')
            sys.path.pop(cwd)
        except ValueError:
            cwd = None

        # Run installation functions and don't taint the global namespace.
        try:
            _pythonrc_enable_history()
            _pythonrc_enable_completion()
            _pythonrc_set_prompt()
            _pythonrc_enable_pprint()

            del _pythonrc_enable_history
            del _pythonrc_enable_completion
            del _pythonrc_set_prompt
            del _pythonrc_enable_pprint
        finally:
            if cwd is not None:
                sys.path.insert(cwd, '')
            del cwd
    finally:
        pass
