# https://github.com/javan/whenever

# Delete pesky .goutputstream-* files.
every :reboot do
	command 'find ~ -name ".goutputstream-[[:alnum:]][[:alnum:]][[:alnum:]][[:alnum:]][[:alnum:]][[:alnum:]]" -delete'
end
