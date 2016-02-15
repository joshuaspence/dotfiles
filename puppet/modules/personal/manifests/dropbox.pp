class personal::dropbox {

  $dropbox_home = "${personal::home}/Dropbox"

  file { $dropbox_home:
    ensure  => 'directory',
    require => File[$personal::home],
  }

  personal::dropbox::link {
    [
      'Desktop',
      'Documents',
      'Downloads',
      'Music',
      'Videos',
    ]:
      ensure => 'present';

    [
      'Pictures',
    ]:
      ensure => 'absent';
  }

  Exec {
    require => Package['dropbox'],
  }

  exec { 'dropbox autostart':
    command => '/usr/bin/dropbox autostart y',
    creates => "${personal::home}/.config/autostart/dropbox.desktop",
  }

  exec { 'dropbox start':
    command => '/usr/bin/dropbox start',
    onlyif  => '/usr/bin/dropbox running',
  }

}
