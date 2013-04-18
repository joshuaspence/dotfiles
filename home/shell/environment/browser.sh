#/
## @author Joshua Spence
## @file   ~/.shell/environment/browser.sh
#\

## Unset environment variable.
unset BROWSER

## Set environment variable.
if ! $REMOTE_SHELL && command -v google-chrome >/dev/null; then
    BROWSER=$(command -v google-chrome)
elif ! $REMOTE_SHELL && command -v firefox >/dev/null; then
    BROWSER=$(command -v firefox)
elif command -v lynx >/dev/null; then
    BROWSER=$(command -v lynx)
else
    echo "No command set for BROWSER environment variable" >&2
fi

## Export environment variable.
export BROWSER
