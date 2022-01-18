function docker-clean-all() {
  docker ps --all --quiet | xargs docker rm --force
  docker images --all --quiet | xargs docker rmi --force
}
