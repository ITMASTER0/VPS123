# WavyCloud VM Maker

A simple terminal VM maker for Docker.

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
1) Create VM
2) List VMs
3) Start VM
4) Stop VM
5) Restart VM
6) Inspect VM
7) Delete VM
8) Show OS images
9) Exit
```

The VM creator asks for the name, RAM, CPU, disk size, Linux image, username, and password. It creates a Docker container with the selected settings and prints the actual Docker specifications after creation.

Available images include Ubuntu, Debian, Fedora, CentOS, Rocky Linux, AlmaLinux, openSUSE, Arch Linux, Kali Linux, Alpine Linux, and Docker tools.
