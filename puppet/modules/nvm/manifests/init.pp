class nvm(
  #
) {

  exec { 'nvm-install':
    path        => '/usr/bin:/usr/sbin:/bin',
    command     => 'curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | sh',
    #creates     => "${home}/.nvm/nvm.sh",
    environment => [
      'NVM_DIR=/usr/local/nvm',
    ],
    require     => Package['curl', 'git', 'make'],
  }

}
