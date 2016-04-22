class base {

  include base::apt
  include base::java
  include base::packages
  include base::php
  include base::ruby

  include arcanist
  include puppet
  include ssh

  #=============================================================================

  include base::tmp

  include docker
  include dropbox
  include git
  include google_chrome
  #include hipchat
  include lm_sensors
  include mysql::client
  include nodejs
  include ntp
  include packer
  include python
  include spotify
  include sublime_text
  include sudo
  include terraform
  include timezone
  include tmpreaper
  include vagrant
  include virtualbox
  include wget

  apt::ppa { 'ppa:git-core/ppa':
    before => Package['git'],
  }
}
