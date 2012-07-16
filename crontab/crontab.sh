#!/bin/bash

sudo sh -- << EOF
echo "Old crontab for \$(whoami):"
crontab -l

echo "# * * * * * command to be executed
# - - - - -
# | | | | |
# | | | | ----- Day of week (0 - 7) (Sunday=0 or 7)
# | | | ------- Month (1 - 12)
# | | --------- Day of month (1 - 31)
# | ----------- Hour (0 - 23)
# ------------- Minute (0 - 59)

0 12 * * * dpkg --get-selections | grep '[[:space:]]install$' | awk '{print $1}' > package_list
30 0 * * * /usr/local/bin/msfupdate nowait --config-dir=/opt/framework-4.0.0/config/svn >> /var/log/msfupdate.log 2>&1
" | crontab -

echo "New crontab for \$(whoami):"
crontab -l
EOF

sh -- << EOF
echo "Old crontab for \$(whoami):"
crontab -l

echo "# * * * * * command to be executed
# - - - - -
# | | | | |
# | | | | ----- Day of week (0 - 7) (Sunday=0 or 7)
# | | | ------- Month (1 - 12)
# | | --------- Day of month (1 - 31)
# | ----------- Hour (0 - 23)
# ------------- Minute (0 - 59)

1  * * * * tree -a ~ -o ~/.tree_output
" | crontab -

echo "New crontab for \$(whoami):"
crontab -l
EOF
