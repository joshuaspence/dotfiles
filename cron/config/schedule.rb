##
# Use `whenever` to update crontabs.
#
# @link http://github.com/javan/whenever
##

# Self-update the crontab :)
every :day, :at => '10:00am' do
	command '$HOME/dotfiles/bin/update-crontab'
end

# Update /etc/hosts
every :month do
	command '$HOME/dotfiles/bin/update-hosts'
end

# Delete pesky .goutputstream-* files.
every :reboot do
	command 'find ~ -name ".goutputstream-[[:alnum:]][[:alnum:]][[:alnum:]][[:alnum:]][[:alnum:]][[:alnum:]]" -delete'
end
