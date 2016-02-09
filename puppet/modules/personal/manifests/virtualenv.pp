class personal::virtualenv {

  $venv_dir = "${personal::home}/.venv"

  python::virtualenv { $venv_dir:
    owner => $personal::user,
    group => $personal::group,
  }

  python::pip { [
    'awscli',
    'flake8',
    'pep8',
    'pssh',
    'pylint',
  ]:
    ensure     => 'latest',
    virtualenv => $venv_dir,
    owner      => $personal::user,
    group      => $personal::group,
  }

}
