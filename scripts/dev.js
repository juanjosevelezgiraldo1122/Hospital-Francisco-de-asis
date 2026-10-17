import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const node = process.execPath;
const isPortAvailable = (port) => new Promise((resolve) => {
  const server = createServer();
  server.once('error', () => resolve(false));
  server.once('listening', () => server.close(() => resolve(true)));
  server.listen(port, '127.0.0.1');
});

const findApiPort = async () => {
  const preferredPort = Number(process.env.API_PORT || process.env.PORT || 3001);
  for (let port = preferredPort; port < preferredPort + 100; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No hay un puerto de API libre entre ${preferredPort} y ${preferredPort + 99}.`);
};

const apiPort = await findApiPort();
if (apiPort !== Number(process.env.API_PORT || process.env.PORT || 3001)) {
  console.warn(`El puerto de API preferido esta ocupado; se usara ${apiPort}.`);
}
process.env.API_PORT = String(apiPort);
process.env.PORT = String(apiPort);

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
