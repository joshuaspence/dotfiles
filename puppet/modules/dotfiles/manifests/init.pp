# Install `dotfiles`.
#
# See https://pypi.python.org/pypi/dotfiles.
#
class dotfiles(
  $ensure = 'present',
) {

  validate_re($ensure, '^(absent|present|latest)$')

  python::pip { 'dotfiles':
    ensure => $ensure,
    owner  => 'root',
    group  => 'root',
  }

}
