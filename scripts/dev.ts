// Runs the API server (watch mode) and the Vite dev server together; Ctrl+C stops both.
import { spawn, type ChildProcess } from 'node:child_process';

const node = process.execPath;
const children: ChildProcess[] = [
  spawn(node, ['--env-file-if-exists=.env', '--watch', 'server/index.ts'], {
    stdio: 'inherit',
    env: { ...process.env, TIMBRE_DEV: '1' },
  }),
  spawn(node, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
];

const stop = () => {
  for (const child of children) child.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', stop);
