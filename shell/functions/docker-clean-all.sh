function docker-clean-all() {
  docker ps --all --quiet | xargs --no-run-if-empty docker rm --force
  docker image prune --all --force
  docker network prune --force
  docker volume prune --force
}
