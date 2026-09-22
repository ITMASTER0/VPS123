#!/usr/bin/env bash
set -euo pipefail
REPO_URL="${1:-https://github.com/ITMASTER0/VPS123.git}"
command -v node >/dev/null || { echo "Node.js 18 or newer is required." >&2; exit 1; }
if [[ -e nebula-vps-maker ]]; then
  echo "The nebula-vps-maker directory already exists." >&2
  exit 1
fi
git clone "$REPO_URL" nebula-vps-maker
cd nebula-vps-maker
node server.js
