define dotfiles::sync(
  $user   = $name,
  $group  = $name,
  $config = undef,
) {

  validate_string($user)
  validate_string($group)
  validate_absolute_path($config)

  exec { "dotfiles":
    command => "/usr/local/bin/dotfiles --config=${config} --force --sync",
    unless  => "/usr/bin/test -z '$(/usr/local/bin/dotfiles --check --config=${config})'",
    user    => $user,
    group   => $group,
    require => Python::Pip['dotfiles'],
  }

}
