#!/usr/bin/env node
// Cross-platform runner for cassette-recording mode.
// Usage:  pnpm test:claude:live           — runs all integration tests in record mode
//         pnpm test:claude:live <pattern> — runs only matching test names
// Loads master .env from repo parent dir via Node 20 --env-file flag.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// agent/scripts/ → agent/ → apps/ → operscale-calendar-platform/ → operscale-calender/.env
const masterEnvPath = path.resolve(__dirname, '../../../../.env');

if (!existsSync(masterEnvPath)) {
  console.error(`[run-live-tests] master .env not found at ${masterEnvPath}`);
  console.error('[run-live-tests] this script is for local cassette recording only;');
  console.error('[run-live-tests] CI runs `pnpm test` (replay mode) and never needs it.');
  process.exit(1);
}

const vitestArgs = ['exec', 'vitest', 'run', 'test/integration', ...process.argv.slice(2)];
const child = spawn('pnpm', vitestArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    CLAUDE_LIVE: '1',
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --env-file=${masterEnvPath}`.trim(),
  },
});
child.on('exit', (code) => process.exit(code ?? 1));
