#!/usr/bin/env bash
# Screenshots each page of the running staging site with Playwright's cached headless
# Chromium. Usage: ./screenshots.sh OUT_DIR   (site must be up on WP_PORT, default 8095)
set -euo pipefail
out="${1:?usage: screenshots.sh OUT_DIR}"
port="${WP_PORT:-8095}"
chrome=$(ls -d "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell | tail -n1)
mkdir -p "$out"
shot() { # name path height
  "$chrome" --no-sandbox --disable-gpu --hide-scrollbars --window-size=1280,"$3" \
    --screenshot="$out/$1.png" "http://127.0.0.1:$port$2" >/dev/null 2>&1
  echo "$out/$1.png"
}
shot home / 1400
shot how-it-plays /how-it-plays/ 1800
shot business-model /business-model/ 1300
shot blog /blog/ 1200
shot blog-post /the-world-is-the-board/ 5200
