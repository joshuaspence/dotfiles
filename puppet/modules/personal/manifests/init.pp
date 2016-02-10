class personal(
  $user,
  $group,
  $home,
) {

  validate_string($user)
  validate_string($group)
  validate_absolute_path($home)

  if $user == 'root' {
    fail("Running '${module_name}' as '${user}' is not allowed. Check that 'FACTER_id' is set correctly.")
  }

  Exec {
    user  => $user,
    group => $group,
  }

  File {
    owner => $user,
    group => $group,
  }

  user { $user:
    ensure         => 'present',
    comment        => 'Joshua Spence',
    gid            => $group,
    groups         => ['adm', 'sudo'],
    home           => $home,
    managehome     => true,
    membership     => 'minimum',
    purge_ssh_keys => true,
    shell          => '/bin/bash',
  }

  file { $home:
    ensure  => 'directory',
    mode    => '700',
    require => User[$user],
  }

  #file { "${personal::home}/bin":
  #  ensure => 'directory',
  #  owner  => $user,
  #  group  => $group,
  #}

  include personal::dropbox
  #include personal::virtualenv

  #class { 'personal::gsettings': }

  dotfiles::sync { $user:
    home       => $home,
    config     => "${home}/dotfiles/home/dotfilesrc",
    repository => "${home}/dotfiles",
  }

  # python::dotfile

  #vagrant::box { 'ubuntu/trusty64':
  #  ensure => 'added',
  #  user   => $user,
  #}

  #vagrant::plugin { 'vagrant-aws':
  #  ensure => 'installed',
  #}

}
