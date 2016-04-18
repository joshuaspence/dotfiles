class base {

  include base::apt
  include base::git
  include base::java
  include base::packages
  include base::php
  include base::ruby
  include base::tmp

  include arcanist
  include dotfiles
  include puppet
  include ssh

  #=============================================================================

  include docker
  include dropbox
  include google_chrome
  include hipchat
  include lm_sensors
  include mysql::client
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

  # TODO: See https://github.com/voxpupuli/puppet-nodejs/issues/165.
  include nodejs
}
