# Based on https://forge.puppetlabs.com/camptocamp/gnome.
#
# TODO: Move this to a separate module.
#
define personal::gsetting(
  $schema = undef,
  $path   = undef,
  $key    = undef,
  $value  = undef,
) {

  validate_string($schema)
  unless $path == undef {
    validate_absolute_path($path)
  }
  validate_string($key)

  $schema_path = $path ? {
    undef   => $schema,
    default => "${schema}:${path}",
  }

  if ! defined('$dbus_session_bus_address') {
    fail('$dbus_session_bus_address is not set.')
  }

  ensure_packages(['libglib2.0-bin'])

  # See http://askubuntu.com/a/326773.
  exec { "/usr/bin/gsettings set ${schema_path} ${key} ${value}":
    environment => [
     "DBUS_SESSION_BUS_ADDRESS=${::dbus_session_bus_address}",
    ],
    unless      => "/usr/bin/test '$(/usr/bin/gsettings get ${schema_path} ${key})' == '${value}'",
    require     => Package['libglib2.0-bin'],
  }

}
