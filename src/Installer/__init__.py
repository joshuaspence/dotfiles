import abc
import os


class InstallerException(Exception):
    """An exception thrown by the installer."""

    def __init__(self, value):
        self.value = value

    def __str__(self):
        return repr(self.value)

class Installer(object):
    """An installer is used to install package configuration files (rcfiles) to
    a destination directory.

    """
    __metaclass__ = abc.ABCMeta

    def __init__(self, src_root, dst_root, force=False, verbose=False):
        """Constructor."""
        self.src_root = src_root
        self.dst_root = dst_root
        self.force = force
        self.verbose = verbose
    
    @staticmethod
    def get(name):
        """Get an Installer instance based on the specified name."""
        for cls in Installer.__subclasses__():
            if cls.name() == name:
                return cls
        raise ValueError

    @staticmethod
    @abc.abstractmethod
    def name():
        """Return the name of this installer."""
        return

    @property
    def src_root(self):
        """Getter for the source root path."""
        return self._src_root

    @src_root.setter
    def src_root(self, path):
        """Setter for the source root path."""
        if not os.path.exists(path):
            raise InstallerException("Path does not exist: %r" % path)
        else:
            self._src_root = path

    @property
    def dst_root(self):
        """Getter for the destination root path."""
        return self._dst_root

    @dst_root.setter
    def dst_root(self, path):
        """Setter for the destination root path."""
        if not os.path.exists(path):
            raise InstallerException("Path does not exist: %r" % path)
        else:
            self._dst_root = path

    @property
    def force(self):
        """Getter for the force attribute."""
        return self._force

    @force.setter
    def force(self, value):
        """Setter for the force attribute."""
        self._force = value

    @property
    def verbose(self):
        """Getter for the verbose attribute."""
        return self._verbose

    @verbose.setter
    def verbose(self, value):
        """Setter for the verbose attribute."""
        self._verbose = value

    def install(self, path):
        """Install a source configuration file."""
        src = self.get_source(path)
        dst = self.get_destination(path)

        # Error checking
        if not os.path.isfile(src):
            raise InstallerException("%r is not a file" % src)

        if os.path.exists(dst):
            if not self.force:
                return
            else:
                if self.verbose:
                    print "Removing existing file: %r" % dst
                os.remove(dst)
        if self.verbose:
            print "Installing %r to %r" % (src, dst)
        return self.execute(src, dst)

    @staticmethod
    @abc.abstractmethod
    def execute(src, dst):
        """Install a source file to a destination. This is the main method that
        base classes should implement.

        """
        return

    def get_source(self, path):
        """TODO"""
        if os.path.isabs(path):
            relpath = os.path.relpath(path, self.src_root)
            if relpath[0:3] == "../":
                raise InstallerException("%s is not below %s"
                                         % (path, self.src_root))
        else:
            return os.path.join(self.src_root, path)

    def get_destination(self, path):
        """Get the full destination path for installer a given source path."""
        return os.path.join(self.dst_root, path)
