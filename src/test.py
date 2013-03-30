from Installer import Installer
from Installer.installers import DryInstaller
from RcFiles import RcFilesInstaller

import os
import sys

conf_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'rcfiles')
rcf = RcFilesInstaller(conf_dir, sys.argv)
rcf.run()
