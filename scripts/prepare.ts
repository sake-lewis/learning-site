// Run by the launcher before each start: checks Node, installs dependencies when the lockfile has
// changed, and rebuilds the interface when its sources are newer than the last build.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const major = Number(process.versions.node.split('.')[0]);
if (major < 24) {
  console.error(`Timbre Studio needs Node.js 24 or later (found ${process.versions.node}). Install it from https://nodejs.org.`);
  process.exit(1);
}

function npm(args: string[]): void {
  const result = spawnSync('npm', args, { cwd: root, stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Latest modification time of a file or, recursively, of the files in a folder. */
function newest(path: string): number {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return readdirSync(path).reduce((latest, name) => Math.max(latest, newest(join(path, name))), stat.mtimeMs);
}

const lockHash = createHash('sha256').update(readFileSync(join(root, 'package-lock.json'))).digest('hex');
const lockMarker = join(root, 'node_modules', '.timbre-lock');
if (!existsSync(lockMarker) || readFileSync(lockMarker, 'utf8') !== lockHash) {
  console.log('Installing dependencies (first start or after an update)...');
  npm(['ci', '--no-audit', '--no-fund']);
  writeFileSync(lockMarker, lockHash);
}

const built = join(root, 'dist', 'index.html');
const sources = ['src', 'shared', 'index.html', 'vite.config.ts', 'package-lock.json'].map((p) => newest(join(root, p)));
if (!existsSync(built) || Math.max(...sources) > statSync(built).mtimeMs) {
  console.log('Building the interface (first start or after an update)...');
  npm(['run', 'build']);
}
