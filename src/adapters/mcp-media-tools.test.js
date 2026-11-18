import { afterEach, expect, test, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './mcp-server.js';

afterEach(() => vi.restoreAllMocks());
async function withClient(run) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(); await server.connect(b);
  const client = new Client({ name: 'media-test', version: '1' }); await client.connect(a);
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    return { ...JSON.parse(result.content[0].text), isError: result.isError };
  };
  try { await run(call); } finally { await client.close(); }
}

test('exposes existing app media pipeline and preserves revision, provenance and job id', async () => {
  const seen = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    const body = JSON.parse(options.body); seen.push({ url, body });
    const value = url.endsWith('/projects/open') ? { project: { revision: 4, media: [{ id: 'media_one', source: { value: 'https://example.org' }, cuts: [] }] } }
      : url.endsWith('/media/transcribe') ? { id: 'job_one' }
      : url.endsWith('/media/cut') ? { project: { revision: 5 } }
      : { results: [{ mediaId: 'media_one', start: 1, end: 2, text: 'Peter' }] };
    return { ok: true, json: async () => value };
  });
  await withClient(async call => {
    expect(await call('media_list', { path: '/project' })).toMatchObject({ revision: 4, media: [{ source: { value: 'https://example.org' } }] });
    expect(await call('media_transcribe', { path: '/project', mediaId: 'media_one' })).toMatchObject({ jobId: 'job_one' });
    expect(seen.at(-1).body).toEqual({ path: '/project', mediaId: 'media_one', force: false, requireWords: true });
    expect(await call('media_search', { path: '/project', query: 'Peter' })).toMatchObject({ results: [{ start: 1, end: 2 }] });
    const input = { path: '/project', mediaId: 'media_one', baseRevision: 4, start: 1.2, end: 8.5, name: 'Frase completa' };
    expect(await call('media_cut', input)).toMatchObject({ project: { revision: 5 } });
    expect(seen.at(-1)).toMatchObject({ url: expect.stringMatching(/\/media\/cut$/), body: input });
    await call('media_cut_remove', { path: '/project', mediaId: 'media_one', cutId: 'cut_bad', baseRevision: 5 });
    expect(seen.at(-1)).toMatchObject({ url: expect.stringMatching(/\/media\/cut-remove$/), body: { path: '/project', mediaId: 'media_one', cutId: 'cut_bad', baseRevision: 5 } });
    const count = seen.length;
    expect(await call('media_cut', { ...input, end: 1 })).toMatchObject({ isError: true });
    expect(seen).toHaveLength(count);
  });
});

test('paginates revised segments separately from source words and handles absent transcript', async () => {
  const words = [{ text: 'Oi', start: 0.1, end: 0.5 }, { text: 'Peter.', start: 0.6, end: 1.1 }];
  let transcript = { current: [{ text: 'Oi, Peter.', start: 0.1, end: 1.1 }], words };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({ ok: true, json: async () => ({ transcript }) }));
  await withClient(async call => {
    expect(await call('media_transcript', { path: '/p', mediaId: 'media_one', unit: 'words', limit: 1 })).toMatchObject({ items: [words[0]], total: 2, nextOffset: 1 });
    expect(await call('media_transcript', { path: '/p', mediaId: 'media_one', unit: 'words', offset: 1, limit: 1 })).toMatchObject({ items: [words[1]], nextOffset: null });
    expect(await call('media_transcript', { path: '/p', mediaId: 'media_one' })).toMatchObject({ items: transcript.current, total: 1, nextOffset: null });
    transcript = null;
    expect(await call('media_transcript', { path: '/p', mediaId: 'media_one' })).toMatchObject({ transcript: null });
  });
});

test('keeps app conflicts actionable instead of overwriting a concurrent edit', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, json: async () => ({ error: 'Recarregue', code: 'REVISION_CONFLICT', details: { actual: 8 } }) });
  await withClient(async call => {
    expect(await call('media_cut', { path: '/p', mediaId: 'media_one', baseRevision: 4, start: 1, end: 2, name: 'Cena' })).toMatchObject({ isError: true, code: 'REVISION_CONFLICT', details: { actual: 8 } });
  });
});
