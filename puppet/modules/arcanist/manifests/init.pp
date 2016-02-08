class arcanist {

  $bin_root = '/usr/local/bin'
  $src_root = '/usr/local/src'

  Vcsrepo {
    ensure   => 'latest',
    owner    => 'root',
    group    => 'root',
    user     => 'root',
    provider => 'git',
  }

  vcsrepo { 'arcanist':
    path   => "${src_root}/arcanist",
    source => 'https://github.com/phacility/arcanist.git',
  }

  vcsrepo { 'libphutil':
    path   => "${src_root}/libphutil",
    source => 'https://github.com/phacility/libphutil.git',
  }

  exec { "${src_root}/libphutil/scripts/build_xhpast.php":
    refreshonly => true,
    require     => [
      Class['php'],
      Package['g++'],
      Package['make'],
    ],
    subscribe   => Vcsrepo['libphutil'],
  }

  file { "${bin_root}/arc":
    ensure => 'link',
    target => "${src_root}/arcanist/bin/arc",
    require => Vcsrepo['arcanist'],
  }

  file { '/etc/bash_completion.d/arcanist':
    ensure  => 'link',
    target  => "${src_root}/arcanist/resources/shell/bash-completion",
    require => Vcsrepo['arcanist'],
  }

}
