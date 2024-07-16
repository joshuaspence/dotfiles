if command_exists pipx; then
{{- if lookPath "register-python-argcomplete3" }}
  source <(register-python-argcomplete3 pipx)
{{- else }}
  source <(register-python-argcomplete pipx)
{{- end }}
fi
