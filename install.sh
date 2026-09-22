#!/usr/bin/env bash
set -euo pipefail
REPO_URL="${1:-https://github.com/ITMASTER0/VPS123.git}"
command -v node >/dev/null || { echo "Node.js 18 or newer is required." >&2; exit 1; }
command -v qemu-system-x86_64 >/dev/null || { echo "QEMU is required. Install qemu-system-x86, qemu-utils, and cloud-image-utils." >&2; exit 1; }
if [[ -d wavycloud-vm-maker/.git ]]; then
  cd wavycloud-vm-maker
  git pull --ff-only origin main
else
  git clone "$REPO_URL" wavycloud-vm-maker
  cd wavycloud-vm-maker
fi
node server.js
