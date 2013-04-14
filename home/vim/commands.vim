" Sudo write.
comm! W exec 'w !sudo tee % > /dev/null' | e!
