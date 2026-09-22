const readline = require('readline');
const { spawnSync } = require('child_process');
const os = require('os');

let cli;
const ask = question => new Promise(resolve => cli.question(question, resolve));
const state = new Map();
const images = {
  '1': ['Ubuntu 24.04 LTS', 'ubuntu:24.04', 'apt'],
  '2': ['Debian 12', 'debian:12', 'apt'],
  '3': ['Fedora 40', 'fedora:40', 'dnf'],
  '4': ['CentOS Stream 9', 'quay.io/centos/centos:stream9', 'dnf'],
  '5': ['Rocky Linux 9', 'rockylinux:9', 'dnf'],
  '6': ['AlmaLinux 9', 'almalinux:9', 'dnf'],
  '7': ['openSUSE Leap 15.6', 'opensuse/leap:15.6', 'zypper'],
  '8': ['Arch Linux', 'archlinux:latest', 'pacman'],
  '9': ['Kali Linux', 'kalilinux/kali-rolling', 'apt'],
  '10': ['Alpine Linux', 'alpine:latest', 'apk'],
  '11': ['Ubuntu + Docker tools', 'docker:cli', 'apk']
};

function command(name, args) { return spawnSync(name, args, { encoding: 'utf8' }); }
function dockerAvailable() { return command('docker', ['info']).status === 0; }
function wait(milliseconds) { return new Promise(resolve => setTimeout(resolve, milliseconds)); }
function showBanner() {
  console.log('\x1b[38;5;45m╔══════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[38;5;45m║\x1b[1;37m                 W A V Y C L O U D                      \x1b[38;5;45m║\x1b[0m');
  console.log('\x1b[38;5;45m║\x1b[38;5;213m                  VM MAKER                             \x1b[38;5;45m║\x1b[0m');
  console.log('\x1b[38;5;45m╚══════════════════════════════════════════════════════════╝\x1b[0m');
}
async function startupBanner() {
  const lines = [
    ' _       __                 ____ _                 _ ',
    '| |     / /___ _____ _   _ / ___| | ___  _   _  __| |',
    '| | /\\ / / _ \\_  / | | | | |   | |/ _ \\| | | |/ _` |',
    '| |/  V /  __// /| |_| | | |___| | (_) | |_| | (_| |',
    '|_/\\__/\\___/___|\\__, |  \\____|_|\\___/ \\__,_|\\__,_|',
    '                   |___/         VM MAKER'
  ];
  console.log('\n');
  for (const line of lines) {
    for (const character of line) {
      process.stdout.write(`\x1b[38;5;213m${character}\x1b[0m`);
      await wait(5);
    }
    process.stdout.write('\n');
    await wait(80);
  }
  await wait(200);
}
async function loadingAnimation(label) {
  process.stdout.write(`\n${label} `);
  for (const character of ['|', '/', '-', '\\']) {
    process.stdout.write(`\x1b[38;5;213m${character}\x1b[0m`);
    await wait(45);
    process.stdout.write('\b');
  }
  console.log('done.');
}
function availableCpus() {
  const result = command('docker', ['info', '--format', '{{.NCPU}}']);
  const dockerCpus = Number(result.stdout.trim());
  return Math.max(1, Math.min(16, Number.isInteger(dockerCpus) && dockerCpus > 0 ? dockerCpus : os.cpus().length));
}
function validName(name) { return /^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,31}$/.test(name); }
function showImages() { Object.entries(images).forEach(([number, image]) => console.log(`  ${number.padEnd(3)} ${image[0].padEnd(24)} ${image[1]}`)); }
function listVms() {
  if (!dockerAvailable()) { console.log('\x1b[33mDocker is not installed, running, or accessible.\x1b[0m'); return []; }
  const result = command('docker', ['ps', '-a', '--filter', 'label=nebula.vm=true', '--format', '{{.Names}}|{{.Status}}|{{.Image}}|{{.ID}}']);
  const servers = result.stdout.trim() ? result.stdout.trim().split('\n').map(line => { const [name, status, image, id] = line.split('|'); return { name, status, image, id }; }) : [];
  if (!servers.length) console.log('No Nebula VM containers found.');
  else console.table(servers);
  return servers;
}
function printVmSpecs(name) {
  const result = command('docker', ['inspect', name]);
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'Could not read VM specifications.');
  const details = JSON.parse(result.stdout)[0];
  const labels = details.Config.Labels || {};
  const memoryMb = Math.round(details.HostConfig.Memory / 1024 / 1024);
  const cpuCores = details.HostConfig.NanoCpus ? details.HostConfig.NanoCpus / 1000000000 : 'unlimited';
  const volume = details.Mounts.find(mount => mount.Name)?.Name || 'none';
  console.log(`\n\x1b[36mActual VM specifications\x1b[0m\nName: ${details.Name.slice(1)}\nState: ${details.State.Status}\nImage: ${details.Config.Image}\nRAM: ${memoryMb || 'unlimited'} MB\nCPU: ${cpuCores}\nData volume: ${volume}\nDisk setting: ${labels['nebula.disk'] || 'not set'} GB\nContainer ID: ${details.Id.slice(0, 12)}`);
}
async function createVm() {
  showBanner();
  console.log('\x1b[38;5;213m──────────── CONFIGURE YOUR VM ────────────\x1b[0m\n');
  if (!dockerAvailable()) throw new Error('Docker is required. Install Docker and make sure your user can run docker commands.');
  let name = await ask('VM name (2-32 letters, numbers, . _ -): ');
  if (!validName(name)) throw new Error('Invalid VM name.');
  const ram = Number(await ask('RAM in MB (512-24576): '));
  if (!Number.isInteger(ram) || ram < 512 || ram > 24576) throw new Error('RAM must be a whole number from 512 to 24576 MB.');
  const cpuLimit = availableCpus();
  const cpu = Number(await ask(`CPU cores (1-${cpuLimit}, available on this machine): `));
  if (!Number.isInteger(cpu) || cpu < 1 || cpu > cpuLimit) throw new Error(`CPU must be a whole number from 1 to ${cpuLimit} on this machine.`);
  const disk = Number(await ask('Disk limit in GB (1-200): '));
  if (!Number.isInteger(disk) || disk < 1 || disk > 200) throw new Error('Disk must be a whole number from 1 to 200 GB.');
  console.log('\nAvailable operating systems:'); showImages();
  const imageNumber = await ask('Choose image number: '); const image = images[imageNumber];
  if (!image) throw new Error('Choose a listed image.');
  const username = await ask('Login username label: ');
  if (!/^[a-zA-Z0-9_-]{2,32}$/.test(username)) throw new Error('Username must be 2-32 characters.');
  const password = await ask('Login password label (8+ characters): ');
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  console.log(`\nCreating ${name}: ${ram} MB RAM, ${cpu} CPU, ${disk} GB disk, ${image[0]}...`);
  const volume = `nebula-${name}-data`;
  const result = command('docker', ['run', '-d', '--name', name, '--label', 'nebula.vm=true', '--label', `nebula.user=${username}`, '--label', `nebula.ram=${ram}`, '--label', `nebula.cpu=${cpu}`, '--label', `nebula.disk=${disk}`, '--label', `nebula.image=${image[0]}`, '--memory', `${ram}m`, '--cpus', String(cpu), '--restart', 'unless-stopped', '-v', `${volume}:/var/lib/nebula-data`, image[1], 'tail', '-f', '/dev/null']);
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'Docker could not create the VM.');
  state.set(name, { passwordSet: true, passwordLength: password.length });
  console.log(`\n\x1b[32mVM created successfully.\x1b[0m`);
  printVmSpecs(name);
}
async function chooseVm(action) {
  showBanner();
  const servers = listVms(); if (!servers.length) return;
  const name = await ask('\nEnter VM name: '); if (!servers.some(server => server.name === name)) throw new Error('VM not found.');
  await loadingAnimation(`${action} ${name}`);
  const result = command('docker', [action, name]); if (result.status !== 0) throw new Error(result.stderr.trim() || `Docker could not ${action} ${name}.`);
  if (action === 'start') {
    const status = command('docker', ['inspect', '--format', '{{.State.Status}}', name]);
    if (status.status !== 0 || status.stdout.trim() !== 'running') throw new Error(`Docker started ${name}, but it is not running.`);
    console.log(`\n\x1b[32m${name} is running. Opening its live terminal...\x1b[0m`);
    const terminal = spawnSync('docker', ['exec', '-it', name, '/bin/sh'], { stdio: 'inherit' });
    if (terminal.status !== 0) console.log('\nReturned from the VM terminal.');
  }
  console.log(`\n\x1b[32m${action} completed for ${name}.\x1b[0m`);
}
async function inspectVm() {
  showBanner();
  const servers = listVms(); if (!servers.length) return;
  const name = await ask('\nEnter VM name: '); const result = command('docker', ['inspect', name]);
  if (result.status !== 0) throw new Error(result.stderr.trim());
  const details = JSON.parse(result.stdout)[0]; const config = details.Config.Labels || {};
  console.log(`\nName: ${details.Name.slice(1)}\nStatus: ${details.State.Status}\nImage: ${details.Config.Image}\nRAM: ${config['nebula.ram']} MB\nCPU: ${config['nebula.cpu']}\nDisk: ${config['nebula.disk']} GB\nUser label: ${config['nebula.user']}`);
}
async function main() {
  cli = readline.createInterface({ input: process.stdin, output: process.stdout });
  cli.pause();
  await startupBanner();
  cli.resume();
  while (true) {
    console.log('\n'); showBanner(); console.log('\x1b[38;5;213m────────────── VM MAKER ──────────────\x1b[0m');
    console.log(' 1) Create VM'); console.log(' 2) List VMs'); console.log(' 3) Start VM'); console.log(' 4) Stop VM'); console.log(' 5) Restart VM'); console.log(' 6) Inspect VM'); console.log(' 7) Delete VM'); console.log(' 8) Show OS images'); console.log(' 9) Exit\n');
    try {
      const choice = await ask('Select -> ');
      if (choice === '1') await createVm();
      else if (choice === '2') { showBanner(); listVms(); }
      else if (choice === '3') await chooseVm('start');
      else if (choice === '4') await chooseVm('stop');
      else if (choice === '5') await chooseVm('restart');
      else if (choice === '6') await inspectVm();
      else if (choice === '7') { const name = await ask('VM name to delete: '); const confirm = await ask('Type DELETE to confirm: '); if (confirm !== 'DELETE') console.log('Delete cancelled.'); else { const result = command('docker', ['rm', '-f', name]); if (result.status !== 0) throw new Error(result.stderr.trim()); command('docker', ['volume', 'rm', `nebula-${name}-data`]); console.log(`\n\x1b[32mDeleted ${name}.\x1b[0m`); } }
      else if (choice === '8') { showBanner(); showImages(); }
      else if (choice === '9') break;
      else console.log('Choose a number from 1 to 9.');
      if (choice !== '9') await ask('\nPress Enter to return to the VM Maker...');
    } catch (error) { console.log(`\n\x1b[31mError: ${error.message}\x1b[0m`); await ask('\nPress Enter to return to the VM Maker...'); }
  }
  cli.close(); console.log('WavyCloud VM Maker closed.');
}
main();
