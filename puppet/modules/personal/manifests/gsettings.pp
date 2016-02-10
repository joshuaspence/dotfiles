class personal::gsettings {
  package { [
    'dconf-cli',
    'dconf-gsettings-backend',
  ]:
    ensure => 'latest',
  }

  # See http://askubuntu.com/a/326773.
  exec { '/usr/bin/dbus-launch /usr/bin/dconf write /org/compiz/profiles/unity/plugins/unityshell/launcher-hide-mode 1':
    unless  => '/usr/bin/test $(/usr/bin/dconf read /org/compiz/profiles/unity/plugins/unityshell/launcher-hide-mode) -eq 1',
    require => Package['dconf-cli'],
    user => $personal::user,
    group => $personal::group,
  }

  #exec { 'gsettings set org.compiz.core:/org/compiz/profiles/unity/plugins/core/ hsize 3': }
  #exec { 'gsettings set org.compiz.core:/org/compiz/profiles/unity/plugins/core/ vsize 5': }

  #exec { 'dconf /com/canonical/unity/integrated-menus false': }

  #exec { 'dconf write /org/gnome/desktop/session/idle-delay 300': }
  #exec { 'dconf write /org/gnome/desktop/screensaver/lock-enabled true': }
  #exec { 'dconf write /org/gnome/desktop/screensaver/lock-delay 0': }

  # Sticky edges
  #exec { 'dconf write /org/compiz/profiles/unity/plugins/unityshell/launcher-capture-mouse true': }

  # Lancher placement: All displays
  #exec { 'dconf write /org/compiz/profiles/unity/plugins/unityshell/num-launchers 0': }

  # dconf watch /
}
