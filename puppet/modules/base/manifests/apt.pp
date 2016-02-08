# Configure aptitude.
#
class base::apt(
  $mirror = 'http://au.archive.ubuntu.com',
) {

  validate_string($mirror)

  class { '::apt':
    update => {
      frequency => 'daily',
    },
    purge  => {
      'sources.list'   => true,
      'sources.list.d' => true,
      'preferences'    => true,
      'preferences.d'  => true,
    },
  }

  Apt::Source {
    location => "${mirror}/ubuntu/",
    release  => $::lsbdistcodename,
    include  => {
      deb => true,
      src => true,
    },
  }

  # Default
  apt::source { 'ubuntu':
    comment => 'See http://help.ubuntu.com/community/UpgradeNotes for how to upgrade to newer versions of the distribution.',
    repos   => 'main restricted',
  }
  apt::source { 'ubuntu-updates':
    comment => 'Major bug fix updates produced after the final release of the distribution.',
    release => "${::lsbdistcodename}-updates",
    repos   => 'main restricted',
  }

  # Universe
  apt::source { 'ubuntu-universe':
    repos => 'universe',
  }
  apt::source { 'ubuntu-universe-updates':
    release => "${::lsbdistcodename}-updates",
    repos   => 'universe',
  }

  # Multiverse
  apt::source { 'ubuntu-multiverse':
    repos => 'multiverse',
  }
  apt::source { 'ubuntu-multiverse-updates':
    release => "${::lsbdistcodename}-updates",
    repos   => 'multiverse',
  }

  # Backports
  apt::source { 'ubuntu-backports':
    release => "${::lsbdistcodename}-backports",
    repos   => 'main restricted universe multiverse',
  }

  # Security
  apt::source { 'ubuntu-security':
    location => 'http://security.ubuntu.com/ubuntu',
    release  => "${::lsbdistcodename}-security",
    repos    => 'main restricted universe multiverse',
  }

  # Partner
  apt::source { 'ubuntu-partner':
    location => 'http://archive.canonical.com/ubuntu',
    repos    => 'partner',
  }

  # TODO: Workaround for https://tickets.puppetlabs.com/browse/MODULES-3063.
  File <| title == 'sources.list.d' |> {
    ignore => '*.list.save',
  }

}
