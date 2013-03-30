from . import Installer

import os
import shutil


class CopyInstaller(Installer):
    """
    An installer which copies package configuration files (rcfiles) to the
    destination directory.
    """

    @staticmethod
    def name():
        return 'copy'

    @staticmethod
    def execute(src, dst):
        Installer.execute(src, dst)
        os.makedirs(os.path.dirname(dst))
        shutil.copy(src, dst)


class DryInstaller(Installer):
    """
    An installer which simply prints the files that would be installed,
    without actually installing them.
    """

    @staticmethod
    def name():
        return 'dry'

    @staticmethod
    def execute(src, dst):
        Installer.execute(src, dst)
        print "Install %r to %r" % (src, dst)


class SymlinkInstaller(Installer):
    """
    An installer which creates a symbolic link for the package configuration
    files (rcfiles).
    """

    @staticmethod
    def name():
        return 'symlink'

    def __init__(self, src_root, dst_root, force=False, verbose=False,
                 use_relative_links=True):
        super(SymlinkInstaller, self).__init__(
            src_root, dst_root, force, verbose)
        self.use_relative_links = use_relative_links

    @property
    def use_relative_links(self):
        """Getter for the use_relative_links attribute."""
        return self._use_relative_links

    @use_relative_links.setter
    def use_relative_links(self, value):
        """Setter for the use_relative_links attribute."""
        self._use_relative_links = value

    @staticmethod
    def execute(src, dst):
        Installer.execute(src, dst)

        if self.use_relative_links:
            src = os.path.relpath(src, dst)
        os.symlink(src, dst)

Installer.register(CopyInstaller)
Installer.register(DryInstaller)
Installer.register(SymlinkInstaller)
