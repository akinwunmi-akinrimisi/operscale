import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCassetteClient } from './cassette-client';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'cassette-test-'));
  delete process.env.CLAUDE_LIVE;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('createCassetteClient (replay mode = default)', () => {
  it('reads a committed cassette and returns its response unchanged', async () => {
    const cassettePath = path.join(tempDir, 'sample.json');
    const cassette = {
      request: { model: 'claude-opus-4-7', system: 's', messages: [] },
      response: { content: [{ type: 'text', text: '{"hello":"world"}' }], usage: { input_tokens: 100, output_tokens: 5 } },
    };
    writeFileSync(cassettePath, JSON.stringify(cassette), 'utf8');

    const client = createCassetteClient({ cassettePath });
    const out = await client.messages.create({ model: 'ignored', system: 'ignored', messages: [], max_tokens: 1 });
    expect(out).toEqual(cassette.response);
  });

  it('throws when CLAUDE_LIVE != 1 and the cassette file is missing', async () => {
    const cassettePath = path.join(tempDir, 'missing.json');
    const client = createCassetteClient({ cassettePath });
    await expect(client.messages.create({ model: 'm', system: 's', messages: [], max_tokens: 1 })).rejects.toThrow(/cassette.*missing|not found/i);
  });
});

describe('createCassetteClient (record mode = CLAUDE_LIVE=1)', () => {
  it('calls the real client, then writes request + response to disk', async () => {
    process.env.CLAUDE_LIVE = '1';
    const cassettePath = path.join(tempDir, 'recorded.json');
    const fakeRealClient = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{}' }], usage: { input_tokens: 50, output_tokens: 2 } }),
      },
    };

    const client = createCassetteClient({ cassettePath, realClient: fakeRealClient as any });
    const req = { model: 'claude-opus-4-7', system: 'sys', messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }], max_tokens: 8192 };
    const out = await client.messages.create(req);

    expect(fakeRealClient.messages.create).toHaveBeenCalledOnce();
    expect(fakeRealClient.messages.create).toHaveBeenCalledWith(req);
    expect(out.content[0].type).toBe('text');

    expect(existsSync(cassettePath)).toBe(true);
    const written = JSON.parse(readFileSync(cassettePath, 'utf8'));
    expect(written.request).toEqual(req);
    expect(written.response.content[0].text).toBe('{}');
  });

  it('throws when CLAUDE_LIVE=1 but realClient is missing', async () => {
    process.env.CLAUDE_LIVE = '1';
    const cassettePath = path.join(tempDir, 'no-client.json');
    const client = createCassetteClient({ cassettePath });
    await expect(client.messages.create({ model: 'm', system: 's', messages: [], max_tokens: 1 })).rejects.toThrow(/realClient/i);
  });
});
