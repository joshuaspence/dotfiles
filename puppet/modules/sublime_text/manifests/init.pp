# Install and configure Sublime Text.
#
class sublime_text(
  $ensure = 'present',
) {

  validate_re($ensure, '^(absent|present|latest)$')

  apt::ppa { 'ppa:webupd8team/sublime-text-3':
    ensure   => $ensure ? {
      absent  => 'absent',
      present => 'present',
      latest  => 'present',
    },
  }

  package { 'sublime-text-installer':
    ensure  => $ensure,
    require => Apt::Ppa['ppa:webupd8team/sublime-text-3'],
  }

}
