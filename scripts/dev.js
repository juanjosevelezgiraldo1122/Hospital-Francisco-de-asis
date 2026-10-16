import { spawn } from 'node:child_process';

const node = process.execPath;
const children = [
  spawn(node, ['server/index.js'], { stdio: 'inherit', env: process.env }),
  spawn(node, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { stdio: 'inherit', env: process.env }),
];

let stopping = false;
const stop = (signal = 'SIGTERM') => {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => {
    if (!child.killed) child.kill(signal);
  });
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

children.forEach((child) => {
  child.on('error', (error) => {
    console.error('Unable to start development process:', error.message);
    stop();
  });
  child.on('exit', (code) => {
    if (!stopping && code !== 0) stop();
  });
});
