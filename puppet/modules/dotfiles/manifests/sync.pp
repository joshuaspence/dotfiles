define dotfiles::sync(
  $user   = $name,
  $group  = $name,
  $home   = "/home/${name}",
  $config = undef,
) {

  validate_string($user)
  validate_string($group)
  validate_absolute_path($home)

  if $config != undef {
    validate_absolute_path($config)
  }

  $config_flag = $config ? {
    undef   => '',
    default => "--config='${config}'",
  }
  $home_flag = $home ? {
    undef   => '',
    default => "--home='${home}'",
  }

  exec { "dotfiles ${home_flag} --sync":
    command => "/usr/local/bin/dotfiles ${config_flag} ${home_flag} --force --sync",
    onlyif  => "/usr/local/bin/dotfiles --check ${config_flag} ${home_flag} | /bin/grep --quiet .",
    user    => $user,
    group   => $group,
    require => Python::Pip['dotfiles'],
  }

}
