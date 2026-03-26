# Dotfiles

These are my dotfiles. There are many like them, but these ones are mine. Managed with [Chezmoi](https://www.chezmoi.io).

## Quick Start

- `chezmoi apply [TARGET]...` ensures that the specified target(s) are in the target state, updating them if necessary.
- `chezmoi diff [TARGET]...` shows the difference between the target state and the destination state.
- `chezmoi ignored` prints the list of entries ignored by Chezmoi.
- `chezmoi managed` lists all managed entries in the destination directory.
- `chezmoi status` prints the status of the files and scripts managed by Chezmoi.
- `chezmoi unmanaged [PATH]...` lists all unmanaged files in the specified path(s).
- `chezmoi verify [TARGET]...` verifies that the specified target(s) match their target state.
