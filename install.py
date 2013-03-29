#!/usr/bin/env python

from optparse import OptionParser, OptionGroup

import abc
import os
import sys
import shutil

class Installer(object):
	__metaclass__ = abc.ABCMeta
	
	def __init__(self, verbose = False):
		self.verbose = verbose
	
	@abc.abstractmethod
	def install(self, src, dst):
		""" Install a source file to a destination. """
		return

class DryInstaller(Installer):
	def install(self, src, dst):
		print "%s ==> %s" % (src, dst)
Installer.register(DryInstaller)

class SymlinkInstaller(Installer):
	def install(self, src, dst):
		if self.verbose
			print "Symlinking %s ==> %s" % (src, dst)
		os.symlink(src, dst)
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
		self.src = os.path.realpath(os.path.join(root, "~"))
		self.dst = os.path.expanduser("~")
	
	def __get(self, files, dirs):
		for dirname, dirnames, filenames in os.walk(self.src):
			for filename in [x for x in dirnames if dirs] + [x for x in filenames if files]:
				src = os.path.join(dirname, filename)
				dst = os.path.join(self.dst, os.path.relpath(dirname, self.src), filename)
				yield (src, dst)
	
	def files(self):
		return self.__get(files=True, dirs=False)
	
	def dirs(self):
		return self.__get(files=False, dirs=True)
	
	def paths(self):
		return self.__get(files=True, dirs=True)

def relative_path(from_path, to_path):
    """ Get the relative path to traverse from one path to another. """
    common_prefix = os.path.commonprefix([from_path, to_path])
    relpath_from = os.path.relpath(common_prefix, from_path)
    relpath_to = os.path.relpath(to_path, common_prefix)
    return os.path.join(relpath_from, relpath_to)

installer = DryInstaller()
installer.install("/foo/bar", "/foo/bar/baz")

rcfiles = RcFiles("bash")
for f in rcfiles.files():
	print f
print
for f in rcfiles.dirs():
	print f

class RcFilesInstaller(object):
	def __init__(self, argv):
		(self.options, self.args) = self.parse_args(argv)
	
	def all_configurations(root_dir):
		""" Retrieve all configurations by iterating through subdirectories. """
		return [name
		        for name in os.listdir(root_dir)
		        if os.path.isdir(os.path.join(root_dir, name))
		        and name[0] != '.']
	
	def list_configurations():
		""" TODO """
		print all_configurations()
	
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

def base_directory():
    """ TODO """
    return os.path.dirname(os.path.realpath(__file__))

def main(argv):
    (options, args) = parse_args(argv)

    if options.list:
        list_configurations(base_directory())
        sys.exit(0)
    elif options.all_confs:
        confs = all_configurations(base_directory())
    else:
        confs = args

    for conf in confs:
        print conf
        #install(conf)

if __name__ == '__main__':
    main(sys.argv)
