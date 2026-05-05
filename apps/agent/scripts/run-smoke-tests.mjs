#!/usr/bin/env node
// L3 nightly smoke runner. Calls real Anthropic against a frozen canonical
// fixture; no cassette persistence. Used by .github/workflows/nightly-smoke.yml.
//
// Required env: ANTHROPIC_API_KEY (workflow injects from a secret).

import { spawn } from 'node:child_process';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[run-smoke-tests] ANTHROPIC_API_KEY not set; smoke aborted.');
  process.exit(1);
}

const child = spawn('pnpm', ['exec', 'vitest', 'run', 'test/smoke'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, SMOKE: '1' },
});
child.on('exit', (code) => process.exit(code ?? 1));
