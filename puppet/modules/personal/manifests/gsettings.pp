class personal::gsettings {
  ensure_packages([
    'dconf-cli',
    'dconf-gsettings-backend',
  ])

  #Gnome::Gsettings {
  #  user => $personal::user,
  #}

  gnome::gsettings { 'launcher-hide-mode':
    schema => "org.compiz.unityshell",
    key    => 'launcher-hide-mode',
    value  => '1',
  }

  #exec { 'gsettings set org.compiz.unityshell:/org/compiz/profiles/unity/plugins/unityshell/ launcher-hide-mode 1': }
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
