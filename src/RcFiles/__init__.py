from optparse import OptionParser, OptionGroup

from Installer import Installer, InstallerException
import os


class RcFiles(object):
    """TODO"""

    def __init__(self, root):
        self.src = os.path.realpath(os.path.join(root, "~"))
        self.dst = os.path.expanduser("~")

        # Error checking
        if not os.path.exists(self.src):
            raise InstallerException("Path does not exist: %r" % self.src)
        elif not os.path.isdir(self.src):
            raise InstallerException("Path is not a directory: %r" % self.src)

        if not os.path.exists(self.dst):
            raise InstallerException("Path does not exist: %r" % self.dst)
        elif not os.path.isdir(self.dst):
            raise InstallerException("Path is not a directory: %r" % self.dst)

    def _files(self):
        """TODO"""
        for dirname, dirnames, filenames in os.walk(self.src):
            for filename in filenames:
                yield os.path.join(dirname, filename)

    def install(self, mode):
        """TODO"""
        installer = Installer.get(mode)(self.src, self.dst)
        for filename in self._files():
            installer.install(filename)


class RcFilesInstaller(object):
    """ TODO """

    def __init__(self, root, argv=[]):
        self.root = root
        self.parse_args(argv)

    @property
    def root(self):
        """Getter for the root path."""
        return self._root

    @root.setter
    def root(self, path):
        """Setter for the root path."""
        if not os.path.exists(path):
            raise InstallerException("Path does not exist: %r" % path)
        elif not os.path.isdir(path):
            raise InstallerException("Path is not a directory: %r" % path)
        else:
            self._root = os.path.realpath(path)

    @property
    def force(self):
        """Getter for the force attribute."""
        return self._force

    @force.setter
    def force(self, value):
        """Setter for the force attribute."""
        self._force = value

    @property
    def list_confs(self):
        """Getter for the list_confs attribute."""
        return self._list_confs

    @list_confs.setter
    def list_confs(self, value):
        """Setter for the list_confs attribute."""
        self._list_confs = value

    @property
    def mode(self):
        """Getter for the mode attribute."""
        return self._mode

    @mode.setter
    def mode(self, value):
        """Setter for the mode attribute."""
        self._mode = value

    @property
    def verbose(self):
        """Getter for the verbose attribute."""
        return self._verbose

    @verbose.setter
    def verbose(self, value):
        """Setter for the verbose attribute."""
        self._verbose = value

    @property
    def confs(self):
        """Getter for the configurations."""
        return self._confs

    @confs.setter
    def confs(self, value):
        """Setter for the configurations."""
        self._confs = value

    def run(self):
        """TODO"""
        if self.list_confs:
            self.list_configurations()
            sys.exit(0)
        else:
            self.install()

    def install(self):
        """TODO"""
        for conf in self.confs:
            rcfiles = RcFiles(os.path.join(self.root, conf))
            rcfiles.install(self.mode)

    def all_configurations(self):
        """Retrieve all configurations by iterating through subdirectories."""
        for name in os.listdir(self.root):
            path = os.path.join(self.root, name)
            if os.path.isdir(path):
                try:
                    rcf = RcFiles(path)
                    yield name
                except InstallerException:
                    pass

    def list_configurations():
        """TODO"""
        print self.all_configurations()

    def parse_args(self, argv):
        """Parses and validates command line arguments."""
        parser = OptionParser(usage="usage: %prog [options] configurations ...")

        parser.add_option("-l", "--list",
                          action="store_true",
                          dest="list_confs",
                          help="list all configurations and exit")

        group = OptionGroup(parser, "Output options")
        group.add_option("-q", "--quiet",
                         action="store_false",
                         dest="verbose",
                         help="don't print status messages to stdout")
        group.add_option("-v", "--verbose",
                         action="store_true",
                         dest="verbose",
                         help="print status messages to stdout")
        parser.add_option_group(group)

        group = OptionGroup(parser, "Installation options")
        group.add_option("-m", "--mode",
                         type="choice",
                         dest="mode",
                         help="installation mode [default: %default]",
                         choices=["symlink", "copy", "dry"])
        group.add_option("-a", "--all",
                         action="store_true",
                         dest="all_confs",
                         help="install all configurations")
        group.add_option("-f", "--force",
                         action="store_true",
                         dest="force",
                         help="force installation by overwriting existing files")
        parser.add_option_group(group)

        # Set defaults
        parser.set_defaults(list_confs=False,
                            verbose=False,
                            mode="symlink",
                            all_confs=True,
                            force=False)

        # Parse arguments
        (options, args) = parser.parse_args(argv[1:])

        # Validation
        if not options.list_confs and (not options.all_confs and len(args) <= 0):
            parser.error('no configuration was specified')

        # Store attributes
        if (options.all_confs):
            self.confs = self.all_configurations()
        else:
            self.confs = args

        self.force = options.force
        self.list_confs = options.list_confs
        self.mode = options.mode
        self.verbose = options.verbose
