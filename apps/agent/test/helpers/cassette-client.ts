// Anthropic-shaped fake client backed by a JSON cassette.
//   - Default mode (CLAUDE_LIVE != '1'): replays the cassette JSON.
//   - Record mode (CLAUDE_LIVE === '1'): calls realClient and overwrites the JSON.
// The cassette captures BOTH request and response so a request-shape change
// forces a re-record (the next replay will differ; integration test asserts
// equivalence).

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface AnthropicLikeClient {
  messages: {
    create: (req: any) => Promise<any>;
  };
}

export interface CassetteFile {
  request: unknown;
  response: unknown;
}

export interface CassetteClientOptions {
  cassettePath: string;
  realClient?: AnthropicLikeClient;
}

function isRecordMode(): boolean {
  return process.env.CLAUDE_LIVE === '1';
}

async function readCassette(cassettePath: string): Promise<CassetteFile> {
  try {
    const raw = await fs.readFile(cassettePath, 'utf8');
    return JSON.parse(raw) as CassetteFile;
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `cassette missing at ${cassettePath} — record one with \`pnpm --filter @operscale-calendar/agent test:claude:live\``,
      );
    }
    throw err;
  }
}

async function writeCassette(cassettePath: string, file: CassetteFile): Promise<void> {
  await fs.mkdir(path.dirname(cassettePath), { recursive: true });
  await fs.writeFile(cassettePath, JSON.stringify(file, null, 2), 'utf8');
}

export function createCassetteClient(opts: CassetteClientOptions): AnthropicLikeClient {
  return {
    messages: {
      async create(req: any) {
        if (isRecordMode()) {
          if (!opts.realClient) {
            throw new Error(
              'CLAUDE_LIVE=1 record mode requires `realClient` to be passed to createCassetteClient',
            );
          }
          const response = await opts.realClient.messages.create(req);
          await writeCassette(opts.cassettePath, { request: req, response });
          return response;
        }
        const cassette = await readCassette(opts.cassettePath);
        return cassette.response;
      },
    },
  };
}
