define personal::dropbox::link(
  $ensure = 'present',
) {

  validate_re($ensure, '^(absent|present)$')

  file { "${personal::home}/${name}":
    ensure => $ensure ? {
      absent  => 'directory',
      present => 'link',
    },
    target => $ensure ? {
      absent  => undef,
      present => "${$personal::dropbox::dropbox_home}/${name}",
    },
    require => File[$personal::dropbox::dropbox_home],
  }

  Exec {
    cwd     => $personal::dropbox::dropbox_home,
    require => [
      Exec['dropbox start'],
      File[$personal::dropbox::dropbox_home],
    ],
  }

  if $ensure == 'present' {
    exec { "dropbox exclude remove '${name}'":
      command => "/usr/bin/dropbox exclude remove '${name}'",
      onlyif  => "/usr/bin/dropbox exclude list | /usr/bin/tail -n +1 | /bin/grep --quiet '${name}'"
    }
  } else {
    exec { "dropbox exclude add '${name}'":
      command => "/usr/bin/dropbox exclude add '${name}'",
      unless  => "/usr/bin/dropbox exclude list | /usr/bin/tail -n +1 | /bin/grep --quiet '${name}'",
    }
  }


}
