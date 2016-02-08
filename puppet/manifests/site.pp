$http_proxy = undef
$https_proxy = undef
$schedule = undef

node default {
  include base

  personal { $::id: }
}
