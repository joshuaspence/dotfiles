class personal::virtualenv(
  $ensure   = 'present',
  $packages = [],
) {

  validate_re($ensure, ['absent', 'present', 'latest'])
  validate_array($packages)

  python::virtualenv { $personal::user:
    ensure   => $ensure ? {
      absent  => 'absent',
      present => 'present',
      latest  => 'latest',
    },
    venv_dir => "${personal::home}/.venv",
    owner    => $personal::user,
    group    => $personal::group,
  }

  python::pip { $packages:
    ensure     => $ensure,
    virtualenv => "${personal::home}/.venv",
    owner      => $personal::user,
  }

}
