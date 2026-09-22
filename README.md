# Nebula VPS Maker

A simple terminal VPS maker for Docker.

## Install

Install Node.js and Docker first. Then run this command:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/ITMASTER0/VPS123/main/install.sh)
```

## Run manually

```bash
git clone https://github.com/ITMASTER0/VPS123.git nebula-vps-maker
cd nebula-vps-maker
node server.js
```

## Menu

```text
1) Create VPS
2) List VPS
3) Start VPS
4) Stop VPS
5) Restart VPS
6) Inspect VPS
7) Delete VPS
8) Show OS images
9) Exit
```

The VPS creator asks for the name, RAM, CPU, disk size, Linux image, username, and password. It creates a Docker container with the selected settings.

Available images include Ubuntu, Debian, Fedora, CentOS, Rocky Linux, AlmaLinux, openSUSE, Arch Linux, Kali Linux, Alpine Linux, and Docker tools.
