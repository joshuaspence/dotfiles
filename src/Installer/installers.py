from . import Installer

import os
import shutil

class CopyInstaller(Installer):
    """An installer which copies package configuration files to the
    destination directory.

    """
    @staticmethod
    def execute(src, dst):
        os.makedirs(os.path.dirname(dst))
        shutil.copy(src, dst)

Installer.register(CopyInstaller)

class DryInstaller(Installer):
    """An installer which simply prints the files that would be installed,
    without actually installing them.

    """
    @staticmethod
    def execute(src, dst):
        print "Install %s to %s" % (src, dst)

Installer.register(DryInstaller)

class SymlinkInstaller(Installer):
    def __init__(self, src_root, dst_root, force=False, verbose=False, use_relative_links=True):
        super(SymlinkInstaller, self).__init__(src_root, dst_root, force, verbose)
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
        if self.use_relative_links:
            src = self.relative_path(src, dst)
        os.symlink(src, dst)

    @staticmethod
    def relative_path(from_path, to_path):
        """ Get the relative path to traverse from one path to another. """
        common_prefix = os.path.commonprefix([from_path, to_path])
        relpath_from = os.path.relpath(common_prefix, from_path)
        relpath_to = os.path.relpath(to_path, common_prefix)
        return os.path.join(relpath_from, relpath_to)

Installer.register(SymlinkInstaller)
