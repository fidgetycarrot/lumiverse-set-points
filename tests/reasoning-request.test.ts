import { expect, test } from 'bun:test';
import type { SpindleAPI } from 'lumiverse-spindle-types';
import { SetPointsController } from '../src/backend';
import { DEMO_STORY, type ReasoningMode } from '../src/types';

// Lumiverse 1.2 drops OpenRouter reasoning parameters for source:'off'; its
// custom effort:'none' path sends an explicit upstream reasoning control.
test.each([
  ['openrouter', 'off', { source: 'custom', apiReasoning: true, effort: 'none' }],
  ['deepseek', 'off', { source: 'off' }],
  ['openrouter', 'low', { source: 'custom', apiReasoning: true, effort: 'low' }],
] as const)('%s %s uses the host reasoning contract without changing the allowance', async (provider, reasoningMode, expected) => {
  const files = new Map<string, string>(), calls: any[] = [];
  const key = (path: string, userId?: string) => `${userId}:${path}`;
  const api = {
    permissions: { has: () => true },
    connections: { get: async () => ({ id: 'model', provider, model: 'selected-model' }) },
    userStorage: {
      exists: async (path: string, userId?: string) => files.has(key(path, userId)),
      read: async (path: string, userId?: string) => { const value = files.get(key(path, userId)); if (value === undefined) throw new Error('Missing file'); return value; },
      write: async (path: string, value: string, userId?: string) => { files.set(key(path, userId), value); },
      move: async (from: string, to: string, userId?: string) => { files.set(key(to, userId), files.get(key(from, userId))!); files.delete(key(from, userId)); },
    },
    generate: { raw: async (request: unknown) => { calls.push(request); return { content: '', finish_reason: 'length' }; } },
  } as unknown as SpindleAPI;
  const controller = new SetPointsController(api, 'alice');
  await controller.handle('start-import', { options: { text: DEMO_STORY, sourceTitle: 'Harbor', playerRole: 'Mara', startingPoint: 'Arrival', sceneCount: 4, chunkSize: 12000, connectionId: 'model', maxOutputTokens: 32000, reasoningMode: reasoningMode as ReasoningMode } });
  await controller.waitForImport();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ provider, model: 'selected-model', userId: 'alice', parameters: { max_tokens: 32000, temperature: 0.3 }, reasoning: expected });
});
