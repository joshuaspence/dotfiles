Shell environment variables
===========================

Overview
---------
The scripts in this directory are used to set various environment variables for
the shell. Generally, each script should perform the following actions:

- Unset any environment variables which the script intends to set.
- Set the new values for the environment variables.
- Export the environment variables (if applicable).

Ideally, each of the scripts in this directory has no dependencies on any other
scripts. Otherwise there is a risk of a circular dependency.

If the environment variables set by a script are exclusively used by some
executable, then the script should return without setting any environment
variables if the executable is not in the current `PATH`.
