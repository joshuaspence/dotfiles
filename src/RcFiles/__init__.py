from optparse import OptionParser, OptionGroup

from Installer import Installer
import os


class RcFiles(object):
    """TODO"""

    def __init__(self, root):
        self.src = os.path.realpath(os.path.join(root, "~"))
        self.dst = os.path.expanduser("~")

    def _files(self):
        """TODO"""
        for dirname, dirnames, filenames in os.walk(self.src):
            for filename in filenames:
                yield os.path.join(dirname, filename)

    def install(self, mode):
        installer = Installer.get(mode)(self.src, self.dst)
        for filename in self._files():
            installer.install(filename)
