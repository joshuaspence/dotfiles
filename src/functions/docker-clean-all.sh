function docker-clean-all() {
  docker ps --all --quiet | xargs --no-run-if-empty docker rm --force
  docker images --all --quiet | xargs --no-run-if-empty docker rmi --force
}
