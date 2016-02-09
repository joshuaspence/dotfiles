$http_proxy = undef
$https_proxy = undef
$schedule = undef

node default {
  include base

  class { 'personal':
    user  => $::id,
    group => $::id,
    home  => "/home/${::id}",
  }
}
