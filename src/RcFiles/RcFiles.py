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
