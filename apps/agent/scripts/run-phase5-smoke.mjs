#!/usr/bin/env node
// apps/agent/scripts/run-phase5-smoke.mjs
// Cross-platform runner that loads the master .env (parent-dir) and runs
// the phase5 schema-reality test with SMOKE=1.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(process.cwd(), '../../');
const envFile = resolve(repoRoot, '.env');

let envContents = '';
try {
  envContents = readFileSync(envFile, 'utf-8');
} catch (err) {
  console.error(`Could not read master .env at ${envFile}:`, err.message);
  process.exit(1);
}

const env = { ...process.env, SMOKE: '1' };
for (const line of envContents.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  const [, key, val] = m;
  if (!env[key]) env[key] = val;
}

// Map master .env names to apps/agent expectations.
env.SUPABASE_URL = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;

const result = spawnSync(
  'pnpm',
  ['vitest', 'run', 'test/integration/phase5-schema-shapes.test.ts'],
  { stdio: 'inherit', env, shell: true },
);
process.exit(result.status ?? 1);
