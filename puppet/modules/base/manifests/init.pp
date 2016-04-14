class base {

  include base::apt
  include base::git
  include base::java
  include base::packages
  include base::php # TODO
  include base::ruby
  include base::tmp

  include arcanist
  include docker
  include dotfiles
  include dropbox
  include google_chrome
  include hipchat
  include lm_sensors
  include mysql::client
  include ntp
  include packer
  include puppet
  include python
  include spotify
  include sublime_text
  include ssh
  include sudo
  include terraform
  include timezone
  include vagrant
  include virtualbox
  include wget

  # TODO: See https://github.com/voxpupuli/puppet-nodejs/issues/165.
  include nodejs

}
