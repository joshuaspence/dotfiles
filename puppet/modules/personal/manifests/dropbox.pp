class personal::dropbox {

  file { "${personal::home}/Dropbox":
    ensure => 'directory',
  }

  file { "${personal::home}/Desktop":
    ensure => 'link',
    target => "${personal::home}/Dropbox/Desktop",
  }
  file { "${personal::home}/Documents":
    ensure => 'link',
    target => "${personal::home}/Dropbox/Documents",
  }
  file { "${personal::home}/Downloads":
    ensure => 'link',
    target => "${personal::home}/Dropbox/Downloads",
  }
  file { "${personal::home}/Music":
    ensure => 'link',
    target => "${personal::home}/Dropbox/Music",
  }
  file { "${personal::home}/Pictures":
    ensure => 'link',
    target => "${personal::home}/Dropbox/Pictures",
  }
  file { "${personal::home}/Videos":
    ensure => 'link',
    target => "${personal::home}/Dropbox/Videos",
  }

  #exec { 'dropbox autostart y':
  #  creates => "${personal::home}/.config/autostart/dropbox.desktop",
  #}

  #exec { 'dropbox start':
  #  unless => 'dropbox status',
  #}

}
