import { expect, test } from 'bun:test';
import type { SpindleAPI } from 'lumiverse-spindle-types';
import { SetPointsController } from '../src/backend';
import { ResponseCheckpoints } from '../src/checkpoints';
import { adaptStory, type Generate, type GenerationMessage } from '../src/importer';
import { DEMO_STORY, type ImportOptions } from '../src/types';
import { draft } from './fixtures';

test('legacy warning overflow falls back to stages without invalidating or repurchasing its source ledger', async () => {
  const options: ImportOptions = { text: DEMO_STORY, sourceTitle: 'The Lighthouse Letter', playerRole: 'Mara', startingPoint: 'The harbor', sceneCount: 4, chunkSize: 12000, connectionId: 'model' };
  const ledger = { coveredChunks: ['chunk:1'], premise: 'A traveler arrives.', cast: [], setting: [], events: [{ title: 'Arrival', summary: 'A traveler reaches the harbor.', participants: [], changes: 'The journey starts.', sourceRefs: ['chunk:1'] }], warnings: ['An unresolved source detail must be retained.'] };
  const legacy = draft(); legacy.warnings = Array.from({ length: 96 }, (_, i) => `Legacy warning ${i + 1}`);
  let readingMessages: GenerationMessage[] = [], legacyMessages: GenerationMessage[] = [];
  const capture: Generate = Object.assign(async (messages: GenerationMessage[]) => { readingMessages = messages; return { content: JSON.stringify(ledger), finish_reason: 'stop' }; }, {
    peek: async (messages: GenerationMessage[]) => { legacyMessages = messages; throw new Error('Captured legacy request'); },
  });
  await expect(adaptStory(options, capture, () => {})).rejects.toThrow('Captured legacy request');

  const files = new Map<string, string>(), calls: any[] = [];
  const key = (path: string, userId?: string) => `${userId}:${path}`;
  const api = {
    permissions: { has: () => true, getGranted: async () => ['generation'] },
    connections: { get: async () => ({ id: 'model', provider: 'test', model: 'test' }), list: async () => [] },
    userStorage: {
      exists: async (path: string, userId?: string) => files.has(key(path, userId)),
      read: async (path: string, userId?: string) => { const value = files.get(key(path, userId)); if (value === undefined) throw new Error('Missing file'); return value; },
      write: async (path: string, value: string, userId?: string) => { files.set(key(path, userId), value); },
      move: async (from: string, to: string, userId?: string) => { files.set(key(to, userId), files.get(key(from, userId))!); files.delete(key(from, userId)); },
    },
    generate: { raw: async (request: any) => {
      calls.push(request);
      const body = JSON.parse(request.messages[1].content);
      const result = body.task === 'set-points-plan-v1'
        ? { title: 'The harbor', premise: 'A traveler arrives.', narratorInstructions: 'Leave choices to the player.', startingLore: [], scenes: [{ title: 'Arrival', eventIndexes: [0], brief: 'A traveler finds a clue.', assumptions: [] }], warnings: [] }
        : { scenes: body.scenes.map((scene: { id: string }) => ({ id: scene.id, greeting: 'A lantern glows beside the harbor. What do you do?', direction: 'Offer a clue without deciding the player’s actions.', assumptions: [] })), warnings: [] };
      return { content: JSON.stringify(result), finish_reason: 'stop' };
    } },
  } as unknown as SpindleAPI;
  const fingerprint = { id: 'model', model: 'test', provider: 'test', parameters: { temperature: 0.3, max_tokens: 16000 } };
  const checkpoints = new ResponseCheckpoints(api, 'alice');
  await checkpoints.request(readingMessages, fingerprint, async () => ({ content: JSON.stringify(ledger), finish_reason: 'stop' }));
  const readingPath = [...files.keys()].find(path => /[a-f0-9]{64}\.json$/.test(path))!;
  const readingBefore = files.get(readingPath);
  await checkpoints.request(legacyMessages, fingerprint, async () => ({ content: JSON.stringify(legacy), finish_reason: 'stop' }));
  files.set('alice:workspace.json', JSON.stringify({ draft: null, saved: null, job: { id: 'old', status: 'failed', completed: 1, total: 2, label: 'Failed legacy final assembly' }, lastImport: options, lastConnectionFingerprint: fingerprint }));

  const controller = new SetPointsController(api, 'alice');
  await controller.handle('resume-import', {}); await controller.waitForImport();
  const view = await controller.snapshot(null);
  expect(view.job?.status).toBe('complete');
  expect(calls.map(request => JSON.parse(request.messages[1].content).task)).toEqual(['set-points-plan-v1', 'set-points-scenes-v1']);
  expect(view.draft?.warnings).toContain(ledger.warnings[0]);
  expect(files.get(readingPath)).toBe(readingBefore);
  expect(JSON.parse(files.get(readingPath)!).state).toBe('complete');
});
