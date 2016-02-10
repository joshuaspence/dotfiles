define personal::dropbox::link(
  $ensure = 'present',
) {

  validate_re($ensure, '^(absent|present)$')

  file { "${personal::home}/${name}":
    ensure => $ensure ? {
      absent  => 'absent',
      present => 'link',
    },
    target => "${$personal::dropbox::dropbox_home}/${name}",
    require => File[$personal::dropbox::dropbox_home],
  }

}
