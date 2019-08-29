function windir() {
  echo "/mnt/$1" | sed 's/\\/\//g' | sed 's/\b\(.\):/\L\1/g'
}

# DESKTOP=$(windir `powershell.exe -c "Write-Host ([Environment]::GetFolderPath('Desktop')) -NoNewLine"`)
# MY_DOCUMENTS=$(windir `powershell.exe -c "Write-Host ([Environment]::GetFolderPath('MyDocuments')) -NoNewLine"`)
