define dotfiles::sync(
  $user,
  $home = undef,
  $config = undef,
  $force = false,
  $repository = undef,
) {

  $config_flag = $config ? {
    undef => '',
    default => "--config=${config}",
  }

  $home_flag = $home ? {
    undef => '',
    default => "--home=${home}",
  }

  $repo_flag = $repository ? {
    undef   => '',
    default => "--repo=${repository}",
  }

  $force_flag = $force ? {
    false => '',
    true  => '--force',
  }

  exec { 'dotfiles':
    command => "dotfiles ${config_flag} ${home_flag} ${repo_flag} ${force_flag} --sync",
    unless  => "dotfiles ${config_flag} ${home_flag} ${repo_flag} --check",
    user    => $user,
  }

}
