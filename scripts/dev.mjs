import { spawn } from 'node:child_process';

const environment = { ...process.env, CONTENTLAB_PORT: process.env.CONTENTLAB_API_PORT || '4174' };
const api = spawn(process.execPath, ['src/server/http-server.js'], { stdio: 'inherit', env: environment });
const ui = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev:ui'], { stdio: 'inherit', env: process.env });

function stop(signal) {
  api.kill(signal);
  ui.kill(signal);
}
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
api.on('exit', code => { if (code) ui.kill('SIGTERM'); });
ui.on('exit', code => { api.kill('SIGTERM'); process.exitCode = code || 0; });
