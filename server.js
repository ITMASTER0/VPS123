const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '.wavycloud-vms');
const cli = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = question => new Promise(resolve => cli.question(question, resolve));
const images = {
  '1': ['Ubuntu 24.04 LTS', 'https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img', ['openssh-server', 'sudo', 'nodejs', 'npm']],
  '2': ['Debian 12', 'https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2', ['openssh-server', 'sudo', 'nodejs', 'npm']],
  '3': ['Rocky Linux 9', 'https://dl.rockylinux.org/pub/rocky/9/images/x86_64/Rocky-9-GenericCloud.latest.x86_64.qcow2', ['openssh-server', 'sudo', 'nodejs', 'npm']],
  '4': ['AlmaLinux 9', 'https://repo.almalinux.org/almalinux/9/cloud/x86_64/images/AlmaLinux-9-GenericCloud-latest.x86_64.qcow2', ['openssh-server', 'sudo', 'nodejs', 'npm']],
  '5': ['Ubuntu 24.04 + Node.js', 'https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img', ['openssh-server', 'sudo', 'nodejs', 'npm']]
};
let cliReady = false;

function command(name, args, options = {}) { return spawnSync(name, args, { encoding: 'utf8', ...options }); }
function wait(milliseconds) { return new Promise(resolve => setTimeout(resolve, milliseconds)); }
function ensureTools() {
  for (const tool of ['qemu-system-x86_64', 'qemu-img', 'cloud-localds', 'curl']) {
    if (command('sh', ['-c', `command -v ${tool}`]).status !== 0) throw new Error(`${tool} is required. Install QEMU/KVM tools first.`);
  }
  fs.mkdirSync(ROOT, { recursive: true });
}
function showBanner() {
  console.log('\x1b[38;5;45m╔══════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[38;5;45m║\x1b[1;37m                 W A V Y C L O U D                      \x1b[38;5;45m║\x1b[0m');
  console.log('\x1b[38;5;45m║\x1b[38;5;213m                   REAL VM MAKER                       \x1b[38;5;45m║\x1b[0m');
  console.log('\x1b[38;5;45m╚══════════════════════════════════════════════════════════╝\x1b[0m');
}
async function startupBanner() {
  const lines = [' _       __                 ____ _                 _ ', '| |     / /___ _____ _   _ / ___| | ___  _   _  __| |', '| | /\\ / / _ \\_  / | | | | |   | |/ _ \\| | | |/ _` |', '| |/  V /  __// /| |_| | | |___| | (_) | |_| | (_| |', '|_/\\__/\\___/___|\\__, |  \\____|_|\\___/ \\__,_|\\__,_|', '                   |___/        REAL VM MAKER'];
  console.log('\n');
  for (const line of lines) { for (const character of line) { process.stdout.write(`\x1b[38;5;213m${character}\x1b[0m`); await wait(5); } console.log(); await wait(80); }
  await wait(200);
}
async function loading(label) { process.stdout.write(`\n${label} `); for (const character of ['|', '/', '-', '\\']) { process.stdout.write(`\x1b[38;5;213m${character}\x1b[0m`); await wait(45); process.stdout.write('\b'); } console.log('done.'); }
function validName(name) { return /^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,31}$/.test(name); }
function vmDir(name) { return path.join(ROOT, name); }
function configPath(name) { return path.join(vmDir(name), 'vm.json'); }
function readConfig(name) { return JSON.parse(fs.readFileSync(configPath(name), 'utf8')); }
function allConfigs() { ensureTools(); return fs.existsSync(ROOT) ? fs.readdirSync(ROOT).filter(name => fs.existsSync(configPath(name))).map(readConfig) : []; }
function vmPid(vm) { return fs.existsSync(vm.pidFile) ? Number(fs.readFileSync(vm.pidFile, 'utf8')) : 0; }
function vmRunning(vm) {
  const pid = vmPid(vm);
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    const commandLine = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    return commandLine.includes('qemu-system') && commandLine.includes(vm.disk);
  } catch {
    return false;
  }
}
async function stopVmProcess(vm) {
  if (!vmRunning(vm)) return;
  process.kill(vmPid(vm), 'SIGTERM');
  for (let attempt = 0; attempt < 20 && vmRunning(vm); attempt += 1) await wait(100);
  if (vmRunning(vm)) throw new Error(`VM ${vm.name} did not stop; its disk is still locked.`);
}
function availableCpus() { return Math.max(1, Math.min(16, os.cpus().length)); }
function showImages() { Object.entries(images).forEach(([number, image]) => console.log(`  ${number}. ${image[0]}\n     ${image[1]}`)); }
function cloudConfig(username, password, packages) { return `#cloud-config\nusers:\n  - name: ${username}\n    sudo: ALL=(ALL) NOPASSWD:ALL\n    groups: sudo\n    shell: /bin/bash\n    lock_passwd: false\nssh_pwauth: true\nchpasswd:\n  expire: false\n  list: |\n    ${username}:${password}\npackage_update: true\npackages:\n${packages.map(pkg => `  - ${pkg}`).join('\n')}\nruncmd:\n  - systemctl enable --now ssh || systemctl enable --now sshd || true\n`; }
function metaData(name) { return `instance-id: ${name}\nlocal-hostname: ${name}\n`; }
function freePort() { const used = new Set(allConfigs().map(vm => vm.sshPort)); for (let port = 2200; port < 2300; port += 1) if (!used.has(port)) return port; throw new Error('No free SSH ports available.'); }
function qemuAcceleration() { try { fs.accessSync('/dev/kvm', fs.constants.R_OK | fs.constants.W_OK); return ['-enable-kvm']; } catch { return ['-accel', 'tcg,thread=multi']; } }
async function downloadImage(image, target) { if (fs.existsSync(target)) return; const result = command('curl', ['-fL', '--retry', '3', '--progress-bar', image[1], '-o', target], { stdio: ['ignore', 'inherit', 'inherit'] }); if (result.status !== 0) throw new Error(`Could not download ${image[0]}.`); }
function actualSpecs(vm) { const info = command('qemu-img', ['info', '--output=json', vm.disk]); if (info.status !== 0) throw new Error(info.stderr.trim()); const diskInfo = JSON.parse(info.stdout); return { Name: vm.name, State: vmRunning(vm) ? 'running' : 'stopped', OS: vm.os, RAM: `${vm.ram} MB`, CPU: vm.cpu, 'Disk maximum': `${vm.diskGb} GB`, 'Disk format': diskInfo.format, SSH: `ssh -p ${vm.sshPort} ${vm.username}@127.0.0.1` }; }
function printSpecs(vm) { console.table([actualSpecs(vm)]); }
async function createVm() {
  ensureTools(); showBanner(); console.log('\x1b[38;5;213m──────────── CONFIGURE REAL VM ────────────\x1b[0m\n');
  const name = await ask('VM name (2-32 letters, numbers, . _ -): '); if (!validName(name)) throw new Error('Invalid VM name.'); if (fs.existsSync(vmDir(name))) throw new Error('A VM with that name already exists.');
  const ram = Number(await ask('RAM in MB (512-24576): ')); if (!Number.isInteger(ram) || ram < 512 || ram > 24576) throw new Error('RAM must be a whole number from 512 to 24576 MB.');
  const maxCpu = availableCpus(); const cpu = Number(await ask(`CPU cores (1-${maxCpu}): `)); if (!Number.isInteger(cpu) || cpu < 1 || cpu > maxCpu) throw new Error(`CPU must be a whole number from 1 to ${maxCpu}.`);
  const diskGb = Number(await ask('Disk size in GB (8-200): ')); if (!Number.isInteger(diskGb) || diskGb < 8 || diskGb > 200) throw new Error('Disk must be a whole number from 8 to 200 GB.');
  showImages(); const image = images[await ask('Choose real image number: ')]; if (!image) throw new Error('Choose a listed image.');
  const username = await ask('Login username: '); if (!/^[a-zA-Z0-9_-]{2,32}$/.test(username)) throw new Error('Username must be 2-32 characters.');
  const password = await ask('Login password (8+ characters): '); if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  const dir = vmDir(name); fs.mkdirSync(dir, { recursive: true }); const base = path.join(ROOT, `${image[0].replace(/[^a-z0-9]/gi, '-').toLowerCase()}.img`); const disk = path.join(dir, 'disk.qcow2'); const seed = path.join(dir, 'seed.iso'); const pidFile = path.join(dir, 'qemu.pid'); const sshPort = freePort();
  if (fs.existsSync(disk)) throw new Error(`VM disk already exists at ${disk}. Choose another VM name or delete the old VM first.`);
  await loading(`Downloading ${image[0]}`); await downloadImage(image, base); const imageInfo = command('qemu-img', ['info', '--output=json', base]); if (imageInfo.status !== 0) throw new Error(imageInfo.stderr.trim());
  const format = JSON.parse(imageInfo.stdout).format; const resized = command('qemu-img', ['create', '-f', 'qcow2', '-F', format, '-b', base, disk, `${diskGb}G`]); if (resized.status !== 0) throw new Error(resized.stderr.trim());
  const userData = path.join(dir, 'user-data'); const meta = path.join(dir, 'meta-data'); fs.writeFileSync(userData, cloudConfig(username, password, image[2])); fs.writeFileSync(meta, metaData(name)); const seedResult = command('cloud-localds', [seed, userData, meta]); if (seedResult.status !== 0) throw new Error(seedResult.stderr.trim());
  const vm = { name, os: image[0], ram, cpu, diskGb, disk, seed, pidFile, sshPort, username, imageUrl: image[1], base }; fs.writeFileSync(configPath(name), JSON.stringify(vm, null, 2));
  await startVm(vm); console.log('\n\x1b[32mReal VM created and started.\x1b[0m'); printSpecs(vm);
}
async function startVm(vm) { if (vmRunning(vm)) throw new Error(`VM ${vm.name} is already running; its disk is locked by QEMU.`); const result = command('qemu-system-x86_64', [...qemuAcceleration(), '-name', vm.name, '-m', String(vm.ram), '-smp', String(vm.cpu), '-drive', `file=${vm.disk},if=virtio,format=qcow2`, '-drive', `file=${vm.seed},if=virtio,media=cdrom,readonly=on`, '-netdev', `user,id=net0,hostfwd=tcp::${vm.sshPort}-:22`, '-device', 'virtio-net-pci,netdev=net0', '-pidfile', vm.pidFile, '-daemonize', '-display', 'none']); if (result.status !== 0) throw new Error(result.stderr.trim() || 'QEMU could not start the VM.'); await wait(500); if (!vmRunning(vm)) throw new Error('QEMU exited while starting the VM.'); }
async function chooseVm(action) { showBanner(); const vms = allConfigs(); if (!vms.length) return console.log('No VMs found.'); console.table(vms.map(vm => ({ Name: vm.name, State: vmRunning(vm) ? 'running' : 'stopped', OS: vm.os, RAM: `${vm.ram} MB`, CPU: vm.cpu, SSH: vm.sshPort }))); const name = await ask('\nEnter VM name: '); const vm = vms.find(item => item.name === name); if (!vm) throw new Error('VM not found.'); await loading(`${action} ${name}`); if (action === 'start') await startVm(vm); else if (action === 'stop') await stopVmProcess(vm); else if (action === 'restart') { await stopVmProcess(vm); await startVm(vm); } else throw new Error('Unknown VM action.'); console.log(`\n\x1b[32m${name} ${action} complete.\x1b[0m`); printSpecs(vm); }
async function inspectVm() { const vms = allConfigs(); if (!vms.length) return console.log('No VMs found.'); const name = await ask('Enter VM name: '); const vm = vms.find(item => item.name === name); if (!vm) throw new Error('VM not found.'); printSpecs(vm); }
async function deleteVm() { const vms = allConfigs(); if (!vms.length) return console.log('No VMs found.'); const name = await ask('VM name to delete: '); const vm = vms.find(item => item.name === name); if (!vm) throw new Error('VM not found.'); const confirm = await ask('Type DELETE to confirm: '); if (confirm !== 'DELETE') return console.log('Delete cancelled.'); await stopVmProcess(vm); fs.rmSync(vmDir(name), { recursive: true, force: true }); console.log(`\n\x1b[32mDeleted ${name}.\x1b[0m`); }
async function main() { ensureTools(); cli.pause(); await startupBanner(); cli.resume(); while (true) { console.log('\n'); showBanner(); console.log('\x1b[38;5;213m────────────── REAL VM MAKER ──────────────\x1b[0m'); console.log(' 1) Create VM\n 2) List VMs\n 3) Start VM\n 4) Stop VM\n 5) Restart VM\n 6) Inspect VM\n 7) Delete VM\n 8) Show OS images\n 9) Exit\n'); try { const choice = await ask('Select -> '); if (choice === '1') await createVm(); else if (choice === '2') { const vms = allConfigs(); console.table(vms.map(vm => ({ Name: vm.name, State: vmRunning(vm) ? 'running' : 'stopped', OS: vm.os, RAM: `${vm.ram} MB`, CPU: vm.cpu, SSH: vm.sshPort }))); } else if (choice === '3') await chooseVm('start'); else if (choice === '4') await chooseVm('stop'); else if (choice === '5') await chooseVm('restart'); else if (choice === '6') await inspectVm(); else if (choice === '7') await deleteVm(); else if (choice === '8') showImages(); else if (choice === '9') break; else console.log('Choose a number from 1 to 9.'); if (choice !== '9') await ask('\nPress Enter to return to the VM Maker...'); } catch (error) { console.log(`\n\x1b[31mError: ${error.message}\x1b[0m`); await ask('\nPress Enter to return to the VM Maker...'); } } cli.close(); console.log('WavyCloud VM Maker closed.'); }
main();
