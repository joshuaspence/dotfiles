http://unix.stackexchange.com/questions/30925/in-bash-when-to-alias-when-to-script-and-when-to-write-a-function

Where aliases are concerned, I use aliases for very simple operations that don't take arguments.

An alias should not (in general) do more than effectively change the default options of a command. It is nothing more than simple text replacement on the command name. It can't do anything with arguments but pass them to the command it actually runs. So if you simply need to add an argument at the front of a single command, an alias will work. 

A function should be used when you need to do something more complex than an alias but that wouldn't be of use on its own.

A script should stand on its own. It should have value as something that can be re-used, or used for more than one purpose.
