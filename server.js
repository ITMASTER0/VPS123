const readline = require('readline');
const { spawnSync } = require('child_process');

const cli = readline.createInterface({ input: process.stdin, output: process.stdout });
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

function clear() { process.stdout.write('\x1b[2J\x1b[H'); }
function banner() {
  clear();
  console.log('\x1b[38;5;45m╔══════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[38;5;45m║\x1b[1;37m              N E B U L A   V P S                     \x1b[38;5;45m║\x1b[0m');
  console.log('\x1b[38;5;45m║\x1b[38;5;213m       Local container VPS maker for creators           \x1b[38;5;45m║\x1b[0m');
  console.log('\x1b[38;5;45m╚══════════════════════════════════════════════════════════╝\x1b[0m\n');
}
function loading() {
  clear(); process.stdout.write('\x1b[38;5;213mBooting Nebula VPS Maker [\x1b[0m');
  for (let index = 0; index < 34; index += 1) process.stdout.write('\x1b[38;5;45m█\x1b[0m');
  console.log('\x1b[38;5;213m]\x1b[0m\n\x1b[32mReady. This tool uses your local Docker installation.\x1b[0m\n');
}
function command(name, args) { return spawnSync(name, args, { encoding: 'utf8' }); }
function dockerAvailable() { return command('docker', ['info']).status === 0; }
function validName(name) { return /^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,31}$/.test(name); }
function showImages() { Object.entries(images).forEach(([number, image]) => console.log(`  ${number.padEnd(3)} ${image[0].padEnd(24)} ${image[1]}`)); }
function listVps() {
  if (!dockerAvailable()) { console.log('\x1b[33mDocker is not installed, running, or accessible.\x1b[0m'); return []; }
  const result = command('docker', ['ps', '-a', '--filter', 'label=nebula.vps=true', '--format', '{{.Names}}|{{.Status}}|{{.Image}}|{{.ID}}']);
  const servers = result.stdout.trim() ? result.stdout.trim().split('\n').map(line => { const [name, status, image, id] = line.split('|'); return { name, status, image, id }; }) : [];
  if (!servers.length) console.log('No Nebula VPS containers found.');
  else console.table(servers);
  return servers;
}
async function createVps() {
  banner(); console.log('\x1b[38;5;213m──────────── CONFIGURE YOUR VPS ────────────\x1b[0m\n');
  if (!dockerAvailable()) throw new Error('Docker is required. Install Docker and make sure your user can run docker commands.');
  let name = await ask('VPS name (2-32 letters, numbers, . _ -): ');
  if (!validName(name)) throw new Error('Invalid VPS name.');
  const ram = Number(await ask('RAM in MB (512-24576): '));
  if (!Number.isInteger(ram) || ram < 512 || ram > 24576) throw new Error('RAM must be a whole number from 512 to 24576 MB.');
  const cpu = Number(await ask('CPU cores (1-16): '));
  if (!Number.isInteger(cpu) || cpu < 1 || cpu > 16) throw new Error('CPU must be a whole number from 1 to 16.');
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
  const result = command('docker', ['run', '-d', '--name', name, '--label', 'nebula.vps=true', '--label', `nebula.user=${username}`, '--label', `nebula.ram=${ram}`, '--label', `nebula.cpu=${cpu}`, '--label', `nebula.disk=${disk}`, '--label', `nebula.image=${image[0]}`, '--memory', `${ram}m`, '--cpus', String(cpu), '--restart', 'unless-stopped', '-v', `${volume}:/var/lib/nebula-data`, image[1], 'tail', '-f', '/dev/null']);
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'Docker could not create the VPS.');
  state.set(name, { passwordSet: true, passwordLength: password.length });
  console.log(`\n\x1b[32mVPS created successfully.\x1b[0m\nContainer: ${name}\nImage: ${image[0]}\nContainer ID: ${result.stdout.trim().slice(0, 12)}\nData volume: ${volume}`);
  console.log('\x1b[33mNote: this is a local Docker VPS container. It is not a public cloud server or SSH service.\x1b[0m');
}
async function chooseVps(action) {
  banner(); const servers = listVps(); if (!servers.length) return;
  const name = await ask('\nEnter VPS name: '); if (!servers.some(server => server.name === name)) throw new Error('VPS not found.');
  const result = command('docker', [action, name]); if (result.status !== 0) throw new Error(result.stderr.trim());
  console.log(`\n\x1b[32m${action} completed for ${name}.\x1b[0m`);
}
async function inspectVps() {
  banner(); const servers = listVps(); if (!servers.length) return;
  const name = await ask('\nEnter VPS name: '); const result = command('docker', ['inspect', name]);
  if (result.status !== 0) throw new Error(result.stderr.trim());
  const details = JSON.parse(result.stdout)[0]; const config = details.Config.Labels || {};
  console.log(`\nName: ${details.Name.slice(1)}\nStatus: ${details.State.Status}\nImage: ${details.Config.Image}\nRAM: ${config['nebula.ram']} MB\nCPU: ${config['nebula.cpu']}\nDisk: ${config['nebula.disk']} GB\nUser label: ${config['nebula.user']}`);
}
async function main() {
  loading(); await ask('Press Enter to open the maker...');
  while (true) {
    banner(); console.log('\x1b[38;5;213m────────────── VPS MAKER ──────────────\x1b[0m');
    console.log(' 1) Create VPS'); console.log(' 2) List VPS'); console.log(' 3) Start VPS'); console.log(' 4) Stop VPS'); console.log(' 5) Restart VPS'); console.log(' 6) Inspect VPS'); console.log(' 7) Delete VPS'); console.log(' 8) Show OS images'); console.log(' 9) Exit\n');
    try {
      const choice = await ask('Select -> ');
      if (choice === '1') await createVps();
      else if (choice === '2') { banner(); listVps(); }
      else if (choice === '3') await chooseVps('start');
      else if (choice === '4') await chooseVps('stop');
      else if (choice === '5') await chooseVps('restart');
      else if (choice === '6') await inspectVps();
      else if (choice === '7') { const name = await ask('VPS name to delete: '); const confirm = await ask('Type DELETE to confirm: '); if (confirm !== 'DELETE') console.log('Delete cancelled.'); else { const result = command('docker', ['rm', '-f', name]); if (result.status !== 0) throw new Error(result.stderr.trim()); command('docker', ['volume', 'rm', `nebula-${name}-data`]); console.log(`\n\x1b[32mDeleted ${name}.\x1b[0m`); } }
      else if (choice === '8') { banner(); showImages(); }
      else if (choice === '9') break;
      else console.log('Choose a number from 1 to 9.');
      if (choice !== '9') await ask('\nPress Enter to return to the VPS Maker...');
    } catch (error) { console.log(`\n\x1b[31mError: ${error.message}\x1b[0m`); await ask('\nPress Enter to return to the VPS Maker...'); }
  }
  cli.close(); console.log('Nebula VPS Maker closed.');
}
main();
