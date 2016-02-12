class personal::gsettings {

  personal::gsetting { 'launcher-hide-mode':
    schema => 'org.compiz.unityshell',
    path   => '/org/compiz/profiles/unity/plugins/unityshell/',
    key    => 'launcher-hide-mode',
    value  => 1,
  }

  personal::gsetting { 'hsize':
    schema => 'org.compiz.core',
    path   => '/org/compiz/profiles/unity/plugins/core/',
    key    => 'hsize',
    value  => 3,
  }

  personal::gsetting { 'vsize':
    schema => 'org.compiz.core',
    path   => '/org/compiz/profiles/unity/plugins/core/',
    key    => 'vsize',
    value  => 8,
  }

  personal::gsetting { 'integrated-menus':
    schema => 'com.canonical.Unity',
    key    => 'integrated-menus',
    value  => bool2str(false),
  }

  #exec { 'dconf write /org/gnome/desktop/session/idle-delay 300': }
  #exec { 'dconf write /org/gnome/desktop/screensaver/lock-enabled true': }
  #exec { 'dconf write /org/gnome/desktop/screensaver/lock-delay 0': }

  # Sticky edges
  #exec { 'dconf write /org/compiz/profiles/unity/plugins/unityshell/launcher-capture-mouse true': }

  # Lancher placement: All displays
  #exec { 'dconf write /org/compiz/profiles/unity/plugins/unityshell/num-launchers 0': }

  # dconf watch /
}
