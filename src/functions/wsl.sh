# TODO: These functions should only be defined when using WSL.

function win_desktop() {
  wslpath "$(powershell.exe -c "Write-Host ([Environment]::GetFolderPath('Desktop')) -NoNewLine")"
}

function win_mydocuments() {
  wslpath "$(powershell.exe -c "Write-Host ([Environment]::GetFolderPath('MyDocuments')) -NoNewLine")"
}
