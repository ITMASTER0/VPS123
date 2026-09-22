# WavyCloud VM Maker

A terminal VM maker for real QEMU/KVM virtual machines.

## Install

Install Node.js, QEMU, and KVM first. On Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y qemu-system-x86 qemu-utils cloud-image-utils
```

Then run:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/ITMASTER0/VPS123/main/install.sh)
```

## Run manually

```bash
git clone https://github.com/ITMASTER0/VPS123.git wavycloud-vm-maker
cd wavycloud-vm-maker
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

The VM creator asks for the name, RAM, CPU, disk size, Linux image, username, and password. It downloads a real cloud disk image, creates a qcow2 VM disk, injects cloud-init, boots QEMU, and prints the actual VM specifications and SSH command. Start VM waits for SSH and opens a live terminal inside the VM; exit that shell to return to the maker.

Available images are pulled from real public registries and include Ubuntu, Debian, Fedora, CentOS Stream, Rocky Linux, AlmaLinux, openSUSE, Arch Linux, Kali Linux, Alpine Linux, and Node.js 22 with npm.
