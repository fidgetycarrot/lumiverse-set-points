import { describe, expect, test } from 'bun:test';
import type { SpindleAPI } from 'lumiverse-spindle-types';
import { CheckpointError, ResponseCheckpoints } from '../src/checkpoints';
import type { GenerationMessage } from '../src/importer';

const messages: GenerationMessage[] = [{ role: 'system', content: 'Return a ledger.' }, { role: 'user', content: 'PRIVATE_STORY' }];
const fingerprint = { model: 'model-a', provider: 'test', parameters: { max_tokens: 16000, temperature: 0.3 } };
const response = { content: '{"premise":"PRIVATE_OUTPUT"}', finish_reason: 'stop' };
function harness() {
  const files = new Map<string, string>();
  let before: ((operation: string, path: string) => void)|undefined;
  const key = (path: string, userId?: string) => `${userId}:${path}`;
  const api = { userStorage: {
    exists: async (path: string, userId?: string) => { before?.('exists', path); return files.has(key(path, userId)); },
    read: async (path: string, userId?: string) => { before?.('read', path); const value = files.get(key(path, userId)); if (value === undefined) throw new Error('File not found'); return value; },
    write: async (path: string, data: string, userId?: string) => { before?.('write', path); files.set(key(path, userId), data); },
    move: async (from: string, to: string, userId?: string) => { before?.('move', from); const value = files.get(key(from, userId)); if (value === undefined) throw new Error('File not found'); files.set(key(to, userId), value); files.delete(key(from, userId)); },
  } } as unknown as SpindleAPI;
  return { api, files, fail(fn?: typeof before) { before = fn; } };
}
function onlyResponsePath(files: Map<string, string>) { return [...files.keys()].find(path => /[a-f0-9]{64}\.json$/.test(path))!; }
async function rejected(promise: Promise<unknown>, code: CheckpointError['code']) {
  try { await promise; throw new Error('Expected rejection'); }
  catch (error) { expect(error).toBeInstanceOf(CheckpointError); expect((error as CheckpointError).code).toBe(code); }
}

describe('durable paid-response checkpoints', () => {
  test('reuses the exact request across restart and resets the per-run count', async () => {
    const h = harness(); let calls = 0;
    const first = new ResponseCheckpoints(h.api, 'alice'); first.beginRun();
    expect(await first.request(messages, fingerprint, async () => { calls++; return response; })).toEqual(response);
    expect(first.reused).toBe(0);
    const restarted = new ResponseCheckpoints(h.api, 'alice'); restarted.beginRun();
    expect(await restarted.request(messages, fingerprint, async () => { calls++; return {}; })).toEqual(response);
    expect(calls).toBe(1); expect(restarted.reused).toBe(1);
    restarted.beginRun(); expect(restarted.reused).toBe(0);
    expect([...h.files.keys()].every(path => !path.includes('PRIVATE'))).toBe(true);
  });
  test('isolates users and changes in messages, model, or request settings', async () => {
    const h = harness(); let calls = 0;
    const generate = async () => { calls++; return response; };
    const alice = new ResponseCheckpoints(h.api, 'alice'), bob = new ResponseCheckpoints(h.api, 'bob');
    await alice.request(messages, fingerprint, generate);
    await bob.request(messages, fingerprint, generate);
    await alice.request([...messages, { role: 'user', content: 'Different preference' }], fingerprint, generate);
    await alice.request(messages, { ...fingerprint, model: 'model-b' }, generate);
    await alice.request(messages, { ...fingerprint, parameters: { max_tokens: 8000 } }, generate);
    await alice.request(messages, { parameters: fingerprint.parameters, provider: 'test', model: 'model-a' }, generate);
    expect(calls).toBe(5); expect(alice.reused).toBe(1);
  });
  test('persists a returned answer before caller validation, then retries only rejected final work', async () => {
    const h = harness(); let calls = 0;
    const generate = async () => { calls++; return response; };
    const ledger = new ResponseCheckpoints(h.api, 'alice');
    await ledger.request(messages, fingerprint, generate);
    const finalMessages = [...messages, { role: 'user' as const, content: 'Create six scenes.' }];
    await ledger.request(finalMessages, fingerprint, async () => { calls++; return { content: 'invalid', finish_reason: 'stop' }; });
    await ledger.invalidateLast();
    const retry = new ResponseCheckpoints(h.api, 'alice'); retry.beginRun();
    await retry.request(messages, fingerprint, generate);
    await retry.request(finalMessages, fingerprint, generate);
    expect(calls).toBe(3); expect(retry.reused).toBe(1);
    // New scene preferences leave the shared reading request reusable.
    await retry.request(messages, fingerprint, generate);
    expect(calls).toBe(3);
  });
  test('retains malformed base plus successful repair for deterministic replay', async () => {
    const h = harness(); let calls = 0;
    const first = new ResponseCheckpoints(h.api, 'alice');
    await first.request(messages, fingerprint, async () => { calls++; return { content: '{bad', finish_reason: 'stop' }; });
    const repair = [...messages, { role: 'assistant' as const, content: '{bad' }, { role: 'user' as const, content: 'Repair the JSON.' }];
    await first.request(repair, fingerprint, async () => { calls++; return response; });
    const next = new ResponseCheckpoints(h.api, 'alice');
    await next.request(messages, fingerprint, async () => { calls++; return {}; });
    await next.request(repair, fingerprint, async () => { calls++; return {}; });
    expect(calls).toBe(2); expect(next.reused).toBe(2);
  });
  test('does not dispatch when the pre-request intent cannot be saved', async () => {
    const h = harness(); let calls = 0;
    h.fail((operation) => { if (operation === 'write') throw new Error('PRIVATE_STORAGE_ERROR'); });
    const cache = new ResponseCheckpoints(h.api, 'alice');
    await rejected(cache.request(messages, fingerprint, async () => { calls++; return response; }), 'STORAGE_ERROR');
    expect(calls).toBe(0);
  });
  test('failed response write keeps the paid answer in memory for saving without another call', async () => {
    const h = harness(); let calls = 0;
    const cache = new ResponseCheckpoints(h.api, 'alice');
    h.fail((operation, path) => { if (operation === 'write' && !path.includes('.intent.')) throw new Error('disk full'); });
    await rejected(cache.request(messages, fingerprint, async () => { calls++; return response; }), 'STORAGE_ERROR');
    await cache.invalidateLast(); // A storage failure must not invalidate the held response.
    h.fail(); cache.beginRun();
    expect(await cache.request(messages, fingerprint, async () => { calls++; return {}; })).toEqual(response);
    expect(calls).toBe(1); expect(cache.reused).toBe(1);
  });
  test('recovers a complete response temp file after a restart before rename', async () => {
    const h = harness(); let calls = 0;
    h.fail((operation, path) => { if (operation === 'move' && !path.includes('.intent.')) throw new Error('interrupted rename'); });
    await rejected(new ResponseCheckpoints(h.api, 'alice').request(messages, fingerprint, async () => { calls++; return response; }), 'STORAGE_ERROR');
    expect([...h.files.keys()].some(path => /[a-f0-9]{64}\.json\.tmp$/.test(path))).toBe(true);
    h.fail();
    expect(await new ResponseCheckpoints(h.api, 'alice').request(messages, fingerprint, async () => { calls++; return {}; })).toEqual(response);
    expect(calls).toBe(1);
  });
  test('recovers a rejected temp marker instead of replaying the older invalid answer', async () => {
    const h = harness(); let calls = 0;
    const first = new ResponseCheckpoints(h.api, 'alice');
    await first.request(messages, fingerprint, async () => { calls++; return { content: 'invalid' }; });
    h.fail((operation, path) => { if (operation === 'move' && !path.includes('.intent.')) throw new Error('interrupted rejection'); });
    await rejected(first.invalidateLast(), 'STORAGE_ERROR');
    h.fail();
    await new ResponseCheckpoints(h.api, 'alice').request(messages, fingerprint, async () => { calls++; return response; });
    expect(calls).toBe(2);
  });
  test('a lost answer requires explicit approval after restart, preserving previous paid entries', async () => {
    const h = harness(); let calls = 0;
    const first = new ResponseCheckpoints(h.api, 'alice');
    await rejected(first.request(messages, fingerprint, async () => { calls++; throw Object.assign(new Error('PRIVATE_PROMPT'), { code: 'TIMEOUT' }); }), 'UNCERTAIN_REQUEST');
    const retry = new ResponseCheckpoints(h.api, 'alice'); retry.beginRun();
    await rejected(retry.request(messages, fingerprint, async () => { calls++; return response; }), 'UNCERTAIN_REQUEST');
    expect(calls).toBe(1);
    retry.beginRun({ retryUncertain: true });
    await retry.request(messages, fingerprint, async () => { calls++; return response; });
    expect(calls).toBe(2);
  });
  test('uncertain errors preserve only allowlisted cause codes, never error prose', async () => {
    const h = harness();
    const request = new ResponseCheckpoints(h.api, 'alice').request(messages, fingerprint, async () => { throw Object.assign(new Error('PRIVATE_PROMPT'), { code: 'TIMEOUT' }); });
    await expect(request).rejects.toThrow('(TIMEOUT; UNCERTAIN_REQUEST)');
    const restored = new ResponseCheckpoints(h.api, 'alice').request(messages, fingerprint, async () => response);
    await expect(restored).rejects.toThrow('(UNCERTAIN_REQUEST)');
    expect([...h.files.values()].join('')).not.toContain('PRIVATE_PROMPT');
  });
  test('known provider rejection permits a deliberate retry and never caches the error body', async () => {
    const h = harness(); let calls = 0;
    const error = Object.assign(new Error('PRIVATE_PROVIDER_ERROR'), { code: 'REQUEST_DENIED', status: 403 });
    const first = new ResponseCheckpoints(h.api, 'alice');
    await expect(first.request(messages, fingerprint, async () => { calls++; throw error; })).rejects.toBe(error);
    await new ResponseCheckpoints(h.api, 'alice').request(messages, fingerprint, async () => { calls++; return response; });
    expect(calls).toBe(2);
    expect([...h.files.values()].join('')).not.toContain('PRIVATE_PROVIDER_ERROR');
  });
  test('corrupt, incompatible, or tampered checkpoints never become cache misses', async () => {
    for (const change of [(data: string) => '{broken', (data: string) => data.replace('"format":1', '"format":2'), (data: string) => data.replace('PRIVATE_OUTPUT', 'DIFFERENT_OUTPUT')]) {
      const h = harness(); let calls = 0;
      await new ResponseCheckpoints(h.api, 'alice').request(messages, fingerprint, async () => { calls++; return response; });
      const path = onlyResponsePath(h.files); h.files.set(path, change(h.files.get(path)!));
      await rejected(new ResponseCheckpoints(h.api, 'alice').request(messages, fingerprint, async () => { calls++; return response; }), 'STORAGE_ERROR');
      expect(calls).toBe(1);
    }
  });
  test('persists only response fields needed for validation and safe diagnostics', async () => {
    const h = harness();
    const result = await new ResponseCheckpoints(h.api, 'alice').request(messages, fingerprint, async () => ({
      ...response, reasoning: 'PRIVATE_REASONING', refusal: 'PRIVATE_REFUSAL', error: { message: 'PRIVATE_ERROR' },
      stop_details: { type: 'finish_reason', category: 'SAFETY', explanation: 'PRIVATE_EXPLANATION' },
      reasoning_details: [{ text: 'PRIVATE_BLOCK', signature: 'PRIVATE_SIGNATURE' }],
      tool_calls: [{ args: { text: 'PRIVATE_TOOL' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30, provider_raw: { completion_tokens_details: { reasoning_tokens: 12 }, api_key: 'PRIVATE_KEY' } },
    }));
    expect(result).toMatchObject({ content: response.content, reasoning: 'PRIVATE_REASONING', refusal: true, error: true, reasoning_details: [{}], usage: { completion_tokens: 20, provider_raw: { completion_tokens_details: { reasoning_tokens: 12 } } } });
    const persisted = [...h.files.values()].join('');
    for (const text of ['PRIVATE_REFUSAL', 'PRIVATE_ERROR', 'PRIVATE_EXPLANATION', 'PRIVATE_BLOCK', 'PRIVATE_SIGNATURE', 'PRIVATE_TOOL', 'PRIVATE_KEY', 'PRIVATE_STORY']) expect(persisted).not.toContain(text);
  });
  test('an oversized answer stops subsequent work and cannot cause another call on retry', async () => {
    const h = harness(); let calls = 0;
    const cache = new ResponseCheckpoints(h.api, 'alice');
    await rejected(cache.request(messages, fingerprint, async () => { calls++; return { content: 'x'.repeat(1_000_001) }; }), 'STORAGE_ERROR');
    cache.beginRun();
    await rejected(cache.request(messages, fingerprint, async () => { calls++; return response; }), 'STORAGE_ERROR');
    expect(calls).toBe(1);
  });
  test('concurrent identical callers dispatch only once', async () => {
    const h = harness(); let calls = 0;
    const cache = new ResponseCheckpoints(h.api, 'alice');
    await Promise.all([cache.request(messages, fingerprint, async () => { calls++; return response; }), cache.request(messages, fingerprint, async () => { calls++; return response; })]);
    expect(calls).toBe(1); expect(cache.reused).toBe(1);
  });
});
