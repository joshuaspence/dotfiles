#!/usr/bin/env python

from optparse import OptionParser, OptionGroup

import abc
import os
import sys
import shutil

def main(argv):
	installer = RcFilesInstaller(root=os.path.dirname(os.path.realpath(__file__)), argv=argv)
	installer.run()

if __name__ == '__main__':
	main(sys.argv)
