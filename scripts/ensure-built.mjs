// ============================================================
//  Atlas — build-on-first-start guard
//  `npm start` used to run a full build every time, so every pm2
//  restart (including crash restarts) rebuilt both workspaces. This
//  only builds when an output is missing. After pulling new code,
//  run `npm run build` yourself — the deploy workflow already does.
// ============================================================

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const outputs = [
  path.join(root, 'backend', 'dist', 'backend', 'src', 'server.js'),
  path.join(root, 'frontend', '.next', 'BUILD_ID'),
];

const missing = outputs.filter((p) => !existsSync(p));
if (missing.length === 0) process.exit(0);

console.log(`[start] Build output missing (${missing.map((p) => path.relative(root, p)).join(', ')}) — building first...`);
const result = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
