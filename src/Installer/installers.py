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

    def execute(self, src, dst):
        super(CopyInstaller, self).execute(src, dst)

        # Create parent directories
        parent_dir = os.path.dirname(dst)
        if not os.path.exists(parent_dir):
            if self.verbose:
                print "Creating directory: %r" % parent_dir
            os.makedirs(parent_dir)

        # Install the file
        if self.verbose:
            print "Copying %r to %r" % (src, dst)
        shutil.copy(src, dst)


class DryInstaller(Installer):
    """
    An installer which simply prints the files that would be installed,
    without actually installing them.
    """

    @staticmethod
    def name():
        return 'dry'

    def execute(self, src, dst):
        super(DryInstaller, self).execute(src, dst)

        # Create parent directories
        parent_dir = os.path.dirname(dst)
        if not os.path.isdir(parent_dir):
            print "Create directory: %r" % parent_dir

        # Install the file
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

    def execute(self, src, dst):
        super(SymlinkInstaller, self).execute(src, dst)

        # Create parent directories
        parent_dir = os.path.dirname(dst)
        if not os.path.exists(parent_dir):
            if self.verbose:
                print "Creating directory: %r" % parent_dir
            os.makedirs(parent_dir)

        # Install the file
        if self.use_relative_links:
            src = os.path.relpath(src, dst)
        if self.verbose:
            print "Creating symbolic link %r => %r" % (dst, src)
        os.symlink(src, dst)

Installer.register(CopyInstaller)
Installer.register(DryInstaller)
Installer.register(SymlinkInstaller)
