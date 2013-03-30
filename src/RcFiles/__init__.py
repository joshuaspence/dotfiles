from optparse import OptionParser, OptionGroup

from Installer import Installer
import os


class RcFiles(object):
    """TODO"""

    def __init__(self, root):
        self.src = os.path.realpath(os.path.join(root, "~"))
        self.dst = os.path.expanduser("~")

    def _files(self, files, dirs):
        for dirname, dirnames, filenames in os.walk(self.src):
            for filename in [x for x in dirnames if dirs] + [x for x in filenames if files]:
                yield os.path.join(dirname, filename)

    def install(self, installer):
        for filename in self.files():
            print filename
            installer.install(self.src, filename, self.dst)

class RcFilesInstaller(object):
    """ TODO """
    def __init__(self, root, argv):
        self.root = root
        (options, args) = self.parse_args(argv)
        
        
    
    @property
    def root(self):
        """Getter for the root path."""
        return self._root

    @root.setter
    def root(self, path):
        """Setter for the root path."""
        if not os.path.exists(path):
            raise InstallerException("Path does not exist: %r" % path)
        else:
            self._src_root = path

    def run(self):
        if self.list:
            self.list_configurations()
            sys.exit(0)
        else:
            self.install()
    
    def install(self):
        installer = Installer.get(self.mode)
        
        for conf in self.confs:
            print conf
            rcfiles = RcFiles(conf)
            rcfiles.install(installer)
    
    def all_configurations(self):
        """ Retrieve all configurations by iterating through subdirectories. """
        return [name for name in os.listdir(self.root)
                     if os.path.isdir(os.path.join(self.root, name))
                     and name[0] != '.']
    
    def list_configurations():
        """ TODO """
        print self.all_configurations(self.root)
    
    @staticmethod
    def parse_args(argv):
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
        self.list = options.list
        self.mode = options.mode
        self.verbose = options.verbose
