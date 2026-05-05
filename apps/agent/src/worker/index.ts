// apps/agent/src/worker/index.ts
//
// V2 brief-analysis worker. Long-running poll process. NO HTTP listener.
//   - Polls ai_analysis_jobs every pollIntervalMs (5s in prod).
//   - Claims one row at a time (Task 9 wires the claim implementation).
//   - For each claim: fetch photos, call BriefAnalyzer, write analysis_runs +
//     UPDATE ai_analysis_jobs (Task 11 wires processJob).
//   - Stuck-job sweep on bootstrap and every sweepIntervalMs (60s in prod) — Task 8.
//   - Heartbeat to activity_log every heartbeatIntervalMs (30s in prod).
//   - SIGTERM: finish current claim, then exit.

import { pathToFileURL } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { loadBankCatalog } from '../lib/bank-catalog.js';
import { createBriefAnalyzer, type BriefAnalyzer } from '../lib/claude.js';
import { getSupabaseAdmin, writeActivityLog } from '../lib/supabase-admin.js';

import { sweepStuckJobs as sweepStuckJobsImpl } from './sweep.js';
import { claimNextJob as claimNextJobImpl, type ClaimedJob } from './claim.js';

// Task 11 stub — replaces with real impl in its own file.
const processJob = async (_args: any): Promise<void> => {};

export interface WorkerHandle {
  isRunning(): boolean;
  shutdown(): Promise<void>;
}

export interface WorkerDeps {
  supabase: SupabaseClient;
  analyzer: BriefAnalyzer;
  claimNextJob: (sb: SupabaseClient) => Promise<ClaimedJob | null>;
  sweepStuckJobs: (sb: SupabaseClient) => Promise<void>;
  logger: { info: (...args: any[]) => void; error: (...args: any[]) => void };
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  sweepIntervalMs?: number;
}

export function startWorker(deps: WorkerDeps): WorkerHandle {
  const pollMs = deps.pollIntervalMs ?? 5000;
  const heartbeatMs = deps.heartbeatIntervalMs ?? 30000;
  const sweepMs = deps.sweepIntervalMs ?? 60000;

  let running = true;
  let currentJobInFlight = false;

  const heartbeatTimer = setInterval(() => {
    void writeActivityLog(
      { eventType: 'worker_heartbeat', actor: 'system', payload: { running } },
      deps.supabase,
    ).catch((err) => deps.logger.error('worker: heartbeat write failed', { err }));
  }, heartbeatMs);

  void deps.sweepStuckJobs(deps.supabase).catch((err) => deps.logger.error('worker: sweep failed', { err }));
  const sweepTimer = setInterval(() => {
    void deps.sweepStuckJobs(deps.supabase).catch((err) => deps.logger.error('worker: sweep failed', { err }));
  }, sweepMs);

  const pollTimer = setInterval(async () => {
    if (!running) return;
    if (currentJobInFlight) return;
    try {
      const job = await deps.claimNextJob(deps.supabase);
      if (!job) return;
      currentJobInFlight = true;
      try {
        await processJob({ job, analyzer: deps.analyzer, supabase: deps.supabase, logger: deps.logger });
      } finally {
        currentJobInFlight = false;
      }
    } catch (err) {
      deps.logger.error('worker: poll cycle failed', { err });
      currentJobInFlight = false;
    }
  }, pollMs);

  return {
    isRunning: () => running,
    async shutdown() {
      running = false;
      clearInterval(heartbeatTimer);
      clearInterval(sweepTimer);
      clearInterval(pollTimer);
      const start = Date.now();
      while (currentJobInFlight && Date.now() - start < 30_000) {
        await new Promise((r) => setTimeout(r, 100));
      }
    },
  };
}

// Production entrypoint — runs only when the file is executed directly.
async function main() {
  // loadBankCatalog auto-ascends from cwd to find the repo root via pnpm-workspace.yaml
  const catalog = await loadBankCatalog();
  const supabase = getSupabaseAdmin();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in worker env');
  const client = new Anthropic({ apiKey });
  const logger = {
    info: (...a: any[]) => console.log(JSON.stringify({ level: 'info', t: new Date().toISOString(), m: a })),
    error: (...a: any[]) => console.error(JSON.stringify({ level: 'error', t: new Date().toISOString(), m: a })),
  };
  const analyzer = createBriefAnalyzer({ client, supabase, catalog, logger });

  const handle = startWorker({
    supabase,
    analyzer,
    claimNextJob: claimNextJobImpl,
    sweepStuckJobs: sweepStuckJobsImpl,
    logger,
  });

  logger.info('worker: started', { pid: process.pid });
  process.on('SIGTERM', async () => {
    logger.info('worker: SIGTERM received, shutting down');
    await handle.shutdown();
    logger.info('worker: shutdown complete');
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    logger.info('worker: SIGINT received, shutting down');
    await handle.shutdown();
    process.exit(0);
  });
}

// pathToFileURL produces the canonical file:// URL on both Linux and Windows,
// avoiding the 4-slash bug (file:////app/...) that the hand-rolled regex produced
// on Linux where process.argv[1] starts with a leading slash.
const isMainModule = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMainModule) {
  main().catch((err) => {
    console.error('worker: fatal bootstrap error', err);
    process.exit(1);
  });
}
