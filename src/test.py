from Installer import Installer
from Installer.installers import DryInstaller
from RcFiles import RcFiles

import os
import sys

conf_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'rcfiles')

rcf = RcFiles(os.path.join(conf_dir, 'foo'))
rcf.install('dry')
