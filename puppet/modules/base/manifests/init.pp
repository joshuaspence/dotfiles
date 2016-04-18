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
  include dropbox
  include hipchat
  include puppet
  include python
  include spotify
  include ssh

  #=============================================================================

  include docker
  include google_chrome
  include lm_sensors
  include mysql::client
  include ntp
  include packer
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
