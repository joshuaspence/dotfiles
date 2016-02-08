class base::java {

  apt::ppa { 'ppa:webupd8team/java':
    before  => Package['java'],
  }

  # See http://askubuntu.com/a/190674.
  exec { 'set-licence-selected':
    command => '/bin/echo debconf shared/accepted-oracle-license-v1-1 select true | /usr/bin/debconf-set-selections',
    unless  => '/usr/bin/debconf-get-selections | /usr/bin/awk \'BEGIN { err = 1 } $1 ~ /^oracle-java[6789]-installer$/ && $2 ~ /^shared\/accepted-oracle-license-/ && $4 ~ /^true/ { err = 0 } END { exit err }\'',
    before  => Package['java'],
  }

  class { 'java':
    version => 'latest',
    package => 'oracle-java8-installer',
  }

}
