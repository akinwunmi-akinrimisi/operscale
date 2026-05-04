#!/usr/bin/env node
// Cross-platform runner for cassette-recording mode.
// Usage:  pnpm test:claude:live           — runs all integration tests in record mode
//         pnpm test:claude:live <pattern> — runs only matching test names
//
// Loads master .env from the repo parent dir by parsing it directly and
// merging into the spawned child's env. We deliberately do NOT use Node's
// --env-file flag because (a) it cannot be passed via NODE_OPTIONS (Node
// disallows it there) and (b) we spawn pnpm (a shell script on Unix and a
// .cmd shim on Windows), so direct flag passing to node isn't an option.
// Manual parse keeps zero deps and works on every platform.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
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

// Minimal KEY=VALUE .env parser. Skips blank lines and `#` comments. Strips
// surrounding single or double quotes from the value. Does NOT do interpolation
// — the master .env at the repo parent is plain literal values.
function parseEnvFile(filePath) {
  const out = {};
  const text = readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

const masterEnv = parseEnvFile(masterEnvPath);

if (!masterEnv.ANTHROPIC_API_KEY) {
  console.error(`[run-live-tests] master .env at ${masterEnvPath} has no ANTHROPIC_API_KEY.`);
  console.error('[run-live-tests] cassette recording requires a valid Anthropic key.');
  process.exit(1);
}

const vitestArgs = ['exec', 'vitest', 'run', 'test/integration', ...process.argv.slice(2)];
const child = spawn('pnpm', vitestArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    ...masterEnv,            // master values win over the controller's env
    CLAUDE_LIVE: '1',
  },
});
child.on('exit', (code) => process.exit(code ?? 1));
