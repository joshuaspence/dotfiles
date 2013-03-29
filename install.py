#!/usr/bin/env python

from optparse import OptionParser, OptionGroup

import abc
import os
import sys
import shutil

class InstallerException(Exception):
	""" An exception thrown by the installer. """
	def __init__(self, value):
		self.value = value
	
	def __str__(self):
		return repr(self.value)

class Installer(object):
	""" An installer is used to install rcfiles. """
	__metaclass__ = abc.ABCMeta
	
	def __init__(self, verbose = False):
		self.verbose = verbose
	
	def install(self, root, src, dst):
		if not os.path.isfile(src):
			raise InstallerException("%s is not a file" % src)
		if self.verbose:
			print "Installing %s to %s" % (src, dst)
		return self.execute(root, src, dst)
	
	@staticmethod
	@abc.abstractmethod
	def execute(root, src, dst):
		""" Install a source file to a destination. """
		return
	
	@staticmethod
	def get_destination(root, src, dst):
		return os.path.join(dst, os.path.relpath(src, root))

class DryInstaller(Installer):
	@staticmethod
	def execute(root, src, dst):
		print "Install %s to %s" % (src, Installer.get_destination(root, src, dst))
Installer.register(DryInstaller)

class SymlinkInstaller(Installer):
	def __init__(self, verbose = False, use_relative_links = True):
		super(SymlinkInstaller, self).__init__(verbose)
		self.use_relative_links = use_relative_links
	
	def install(self, src, dst):
		if self.verbose
			print "Symlinking %s ==> %s" % (src, dst)
		os.symlink(src, dst)
	
	def relative_path(from_path, to_path):
		""" Get the relative path to traverse from one path to another. """
		common_prefix = os.path.commonprefix([from_path, to_path])
		relpath_from = os.path.relpath(common_prefix, from_path)
		relpath_to = os.path.relpath(to_path, common_prefix)
		return os.path.join(relpath_from, relpath_to)
Installer.register(SymlinkInstaller)

class CopyInstaller(Installer):
	def install(self, src, dst):
	if os.path.isdir(src):
		os.makedirs(dst)
	else:
		shutil.copy(src, dst)
Installer.register(CopyInstaller)

class RcFiles(object):
	def __init__(self, root):
		self.src  = os.path.realpath(os.path.join(root, "~"))
		self.dst  = os.path.expanduser("~")
	
	def __get(self, files, dirs):
		for dirname, dirnames, filenames in os.walk(self.src):
			for filename in [x for x in dirnames if dirs] + [x for x in filenames if files]:
				yield os.path.join(dirname, filename)
	
	def files(self):
		return self.__get(files=True, dirs=False)
	
	def dirs(self):
		return self.__get(files=False, dirs=True)
	
	def paths(self):
		return self.__get(files=True, dirs=True)
	
	def install(self, installer):
		for filename in self.files():
			installer.install(self.src, filename, self.dst)

class RcFilesInstaller(object):
	def __init__(self, argv):
		(options, args) = self.parse_args(argv)
		
		if (options.all_confs):
			self.confs = self.all_configurations()
		else:
			self.confs = args
		
		self.force   = options.force
		self.list	= options.list
		self.mode	= options.mode
		self.verbose = options.verbose
	
	def get_installer():
		return
	
	def run(self):
		if self.options.list:
			self.list_configurations()
			sys.exit(0)
		elif
		
	@staticmethod
	def all_configurations(root):
		""" Retrieve all configurations by iterating through subdirectories. """
		return [name for name in os.listdir(root)
					 if os.path.isdir(os.path.join(root, name))
					 and name[0] != '.']
	
	def list_configurations():
		""" TODO """
		print self.all_configurations(self.root)
	
	@staticmethod
	def parse_args(argv):
		""" Parses and validates command line arguments. """
		parser = OptionParser(usage="usage: %prog [options] configurations ...",
							  version="1.0.0")
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
		
		parser.set_defaults(list=False,
							verbose=False,
							mode="symlink",
							all=True,
							force=False)
		
		(options, args) = parser.parse_args(argv[1:])
		
		# Validation
		if not options.all_confs and len(args) <= 0:
			parser.error('no configuration was specified')
		
		return (options, args)

def main(argv):
	installer = RcFilesInstaller(root=os.path.dirname(os.path.realpath(__file__)), argv=argv)
	installer.run()

if __name__ == '__main__':
	main(sys.argv)
