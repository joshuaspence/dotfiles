define personal(
  $user  = $name,
  $group = $name,
  $home  = "/home/$name",
) {

  validate_string($user)
  validate_string($group)
  validate_absolute_path($home)

  if $user == 'root' {
    fail("Running '${module_name}' as '${user}' is not allowed. Check that 'FACTER_id' is set correctly.")
  }

  File {
    owner => $user,
    group => $group,
  }

  #user { $user:
  #  ensure     => $user_ensure,
  #  comment    => $comment,
  #  groups     => $groups,
  #  managehome => true,
  #  shell      => $shell,
  #}

  #file { [
  #  "/home/${user}",
  #  "/home/${user}/.local",
  #  "/home/${user}/.local/share",
  #]:
  #  mode    => '700',
  #  owner   => $user,
  #  ensure  => $directory_ensure,
  #  require => User[$user],
  #}

  #file { "${personal::home}/bin":
  #  ensure => 'directory',
  #  owner  => $user,
  #  group  => $group,
  #}

  #class { 'personal::dropbox': }
  #class { 'personal::gsettings': }
  #class { 'personal::virtualenv': }

  #dotfiles::sync { $user: }

  # python::dotfile

  #vagrant::box { 'ubuntu/trusty64':
  #  ensure => 'added',
  #}

  #vagrant::plugin { 'vagrant-aws':
  #  ensure => 'installed',
  #}

}
