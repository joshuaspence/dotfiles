class RcFilesInstaller(object):
    """ TODO """
    def __init__(self, root, argv):
        self.root = root
        (options, args) = self.parse_args(argv)
        
        if (options.all_confs):
            self.confs = self.all_configurations()
        else:
            self.confs = args
        
        self.force = options.force
        self.list = options.list
        self.mode = options.mode
        self.verbose = options.verbose
    
    installers = {
        'symlink': DryInstaller,
        'copy': DryInstaller,
        'dry': DryInstaller
    }
    
    @staticmethod
    def get_installer(mode):
        if mode in RcFilesInstaller.installers:
            return RcFilesInstaller.installers[mode]()
        else:
            raise InstallerException('No such installer')
    
    def run(self):
        if self.list:
            self.list_configurations()
            sys.exit(0)
        else:
            self.install()
    
    def install(self):
        installer = self.get_installer(self.mode)
        
        for conf in self.confs:
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
        """ Parses and validates command line arguments. """
        parser = OptionParser(usage="usage: %prog [options] configurations ...")
        
        parser.add_option("-l", "--list",
                          action="store_true",
                          dest="list",
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
        parser.set_defaults(list=False,
                            verbose=False,
                            mode="symlink",
                            all=True,
                            force=False)
        
        # Parse arguments
        (options, args) = parser.parse_args(argv[1:])
        
        # Validation
        if not options.all_confs and len(args) <= 0:
            parser.error('no configuration was specified')
        
        return (options, args)
