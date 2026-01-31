const path = require('path');
const { spawn } = require('child_process');

const driverAppDir = path.join(__dirname);
process.chdir(driverAppDir);

console.log('Starting Expo from:', driverAppDir);
console.log('');

// Run the local expo binary directly via node_modules/.bin
const expoBin = path.join(driverAppDir, 'node_modules', '.bin', 'expo.cmd');
const child = spawn(expoBin, ['start', '--web'], {
  cwd: driverAppDir,
  stdio: 'inherit',
  shell: true
});

child.on('error', (err) => {
  console.error('Failed to start:', err);
});

child.on('close', (code) => {
  console.log('Expo exited with code:', code);
});
