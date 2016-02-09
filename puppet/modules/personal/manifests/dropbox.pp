class personal::dropbox {

  $dropbox_dir = "${personal::home}/Dropbox"

  file { $dropbox_dir:
    ensure => 'directory',
  }

  file { "${personal::home}/Desktop":
    ensure => 'link',
    target => "${$dropbox_dir}/Desktop",
  }
  file { "${personal::home}/Documents":
    ensure => 'link',
    target => "${$dropbox_dir}/Documents",
  }
  file { "${personal::home}/Downloads":
    ensure => 'link',
    target => "${$dropbox_dir}/Downloads",
  }
  file { "${personal::home}/Music":
    ensure => 'link',
    target => "${$dropbox_dir}/Music",
  }
  file { "${personal::home}/Pictures":
    ensure => 'link',
    target => "${$dropbox_dir}/Pictures",
  }
  file { "${personal::home}/Videos":
    ensure => 'link',
    target => "${$dropbox_dir}/Videos",
  }

  exec { 'dropbox autostart':
    command => '/usr/bin/dropbox autostart y',
    creates => "${personal::home}/.config/autostart/dropbox.desktop",
    require => Package['dropbox'],
  }

  exec { 'dropbox start':
    command => '/usr/bin/dropbox start',
    unless  => '/usr/bin/dropbox running',
    require => Package['dropbox'],
  }

  # dropbox lansync y
  # dropbox status
  # dropbox throttle

}
