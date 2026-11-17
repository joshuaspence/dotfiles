# Run `chezmoi` with the GitHub CLI's token for `github.com`, unless one is already set.
#
# Without a token, template functions such as `gitHubLatestRelease` make unauthenticated API requests and run into
# GitHub's 60 requests an hour rate limit. The token is scoped to the one command rather than exported, so it does not
# leak into every process the shell starts.
function chezmoi() {
  CHEZMOI_GITHUB_ACCESS_TOKEN="${CHEZMOI_GITHUB_ACCESS_TOKEN:-$(gh auth token --hostname github.com 2>/dev/null)}" \
    command chezmoi "$@"
}
