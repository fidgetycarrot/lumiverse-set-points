import { describe, expect, test } from 'bun:test';
import type { SpindleAPI } from 'lumiverse-spindle-types';
import { SetPointsController } from '../src/backend';
import { visualDraftSignature, type VisualPack } from '../src/visuals';
import { DEMO_STORY, type ImportOptions, type StoryDraft } from '../src/types';
import { draft } from './fixtures';

const source = 'APPEARANCE_SOURCE_ONLY_7192. Iona has brown hair. She waits at the harbor while a traveler reads the letter. The lantern is lit and the sea is calm.';
const unrelatedSource = 'UNRELATED_FAILED_IMPORT_9281. '.repeat(12);
const importOptions: ImportOptions = { text: source, sourceTitle: 'The Lighthouse Letter', playerRole: 'Mara', startingPoint: 'The harbor', sceneCount: 2, chunkSize: 12000, connectionId: 'model' };
const mainLedger = {
  coveredChunks: ['chunk:1'], premise: 'A traveler seeks a lighthouse.',
  cast: [{ name: 'Iona', aliases: [], personality: 'Dependable.', voice: 'Direct.', relationships: 'Knows the traveler.', knowledgeAtIntroduction: 'Knows the harbor.', developments: 'No later changes.', sourceRefs: ['chunk:1'] }],
  setting: [], events: [{ title: 'Arrival', summary: 'The traveler arrives.', participants: ['Iona'], changes: 'A journey starts.', sourceRefs: ['chunk:1'] }], warnings: [],
};
function body(request: any): any { return JSON.parse(request.messages[1].content); }
function visualReply(request: any): unknown {
  const input = body(request);
  if (input.task === 'set-points-visual-facts-v1') return { characters: input.draft.cast.map((person: { id: string }) => ({ characterId: person.id, facts: [{ kind: 'appearance', timing: 'start', text: 'Brown hair.', evidence: 'brown hair' }] })), warnings: [] };
  if (input.task === 'set-points-visual-profile-v1') {
    const refs = input.facts.map((fact: { id: string }) => fact.id);
    return { profile: { characterId: input.characterId, description: 'Brown hair.', appearanceTags: ['brown hair'], startingOutfit: 'Not specified in the source.', outfitTags: [], suggestedDetails: '', suggestedTags: [], unknowns: [], subject: '', countTag: '' }, grounding: { description: refs, appearanceTags: [refs], startingOutfit: [], outfitTags: [], subject: [], countTag: [] }, warnings: [] };
  }
  throw new Error('Unexpected visual request in test');
}
function mainReply(request: any): unknown {
  if (request.messages[1].content.startsWith('SOURCE CHUNK')) return mainLedger;
  const input = body(request), sample = draft();
  if (input.task === 'set-points-plan-v1') return { title: sample.title, premise: sample.premise, narratorInstructions: sample.narratorInstructions, startingLore: [], scenes: sample.scenes.map(scene => ({ title: scene.title, eventIndexes: [0], brief: 'A traveler finds a clue.', assumptions: scene.assumptions })), warnings: [] };
  if (input.task === 'set-points-cast-v1') return { cast: input.characters.map((person: { id: string }) => ({ id: person.id, personality: 'Dependable.', voice: 'Direct.', relationships: 'Knows the traveler.', knowledge: 'Knows the harbor.' })), warnings: [] };
  if (input.task === 'set-points-scenes-v1') return { scenes: input.scenes.map((scene: { id: string; assumptions: string[] }) => ({ id: scene.id, greeting: 'A lantern glows at the harbor. What do you do?', direction: 'Offer the next clue without choosing for the player.', assumptions: scene.assumptions })), warnings: [] };
  throw new Error('Unexpected main request in test');
}
function accepted(request: any): Promise<unknown> { return Promise.resolve({ content: JSON.stringify(visualReply(request)), finish_reason: 'stop' }); }
function harness(initial: (request: any) => Promise<unknown> = accepted) {
  const stored = new Map<string, unknown>(), calls: any[] = [], waiters: Array<{ count: number; resolve: () => void }> = [];
  let generate = initial, beforeWrite: ((path: string) => void)|undefined, model = 'test';
  const key = (path: string, userId?: string) => `${userId}:${path}`;
  const api = {
    permissions: { has: (permission: string) => permission === 'generation', getGranted: async () => ['generation'] },
    userStorage: {
      exists: async (path: string, userId?: string) => stored.has(key(path, userId)),
      read: async (path: string, userId?: string) => { const value = stored.get(key(path, userId)); if (value === undefined) throw new Error('Missing storage file'); return typeof value === 'string' ? value : JSON.stringify(value); },
      write: async (path: string, value: string, userId?: string) => { beforeWrite?.(path); stored.set(key(path, userId), value); },
      move: async (from: string, to: string, userId?: string) => { const value = stored.get(key(from, userId)); if (value === undefined) throw new Error('Missing storage file'); stored.set(key(to, userId), value); stored.delete(key(from, userId)); },
      getJson: async (path: string, options: any) => { const value = stored.get(key(path, options?.userId)); return value === undefined ? structuredClone(options?.fallback) : typeof value === 'string' ? JSON.parse(value) : structuredClone(value); },
      setJson: async (path: string, value: unknown, options: any) => { beforeWrite?.(path); stored.set(key(path, options?.userId), structuredClone(value)); },
    },
    connections: { get: async (id: string) => id === 'model' ? { id, name: 'Model', provider: 'test', model } : null, list: async () => [{ id: 'model', name: 'Model', provider: 'test', model }] },
    generate: { raw: async (request: any) => { calls.push(request); for (const waiter of waiters) if (calls.length >= waiter.count) waiter.resolve(); return generate(request); } },
  } as unknown as SpindleAPI;
  return {
    api, stored, calls,
    setGenerate(next: typeof generate) { generate = next; },
    failWrite(next?: typeof beforeWrite) { beforeWrite = next; },
    setModel(next: string) { model = next; },
    workspace(userId = 'alice'): any { const value = stored.get(`${userId}:workspace.json`); return typeof value === 'string' ? JSON.parse(value) : structuredClone(value); },
    waitForCall(count: number) { return calls.length >= count ? Promise.resolve() : new Promise<void>(resolve => waiters.push({ count, resolve })); },
  };
}
function seed(h: ReturnType<typeof harness>, value: StoryDraft = draft(), extra: Record<string, unknown> = {}) {
  h.stored.set('alice:workspace.json', { draft: value, saved: null, job: null, ...extra });
}
async function start(app: SetPointsController, value = draft(), sourceText: string|null = source) {
  return app.handle('start-visuals', { draft: value, connectionId: 'model', ...(sourceText === null ? {} : { sourceText }) });
}
async function completeMain(h: ReturnType<typeof harness>, app: SetPointsController): Promise<StoryDraft> {
  h.setGenerate(async request => ({ content: JSON.stringify(mainReply(request)), finish_reason: 'stop' }));
  await app.handle('start-import', { options: importOptions }); await app.waitForImport();
  const view = await app.snapshot(null);
  expect(view.job?.status).toBe('complete');
  h.setGenerate(accepted);
  return view.draft!;
}
function paidResponsePaths(h: ReturnType<typeof harness>) { return [...h.stored.keys()].filter(path => /imports\/responses\/[a-f0-9]{64}\.json$/.test(path)); }

describe('optional visual jobs keep story and appearance recovery separate', () => {
  test('resumes a published 0.1.7 coverage failure and retains uncited facts with zero new paid requests', async () => {
    const saved = await Bun.file(new URL('./fixtures/visual-coverage-v017.json', import.meta.url)).json();
    const h = harness(async () => { throw new Error('Recovery must not call the provider'); });
    for (const [path, value] of saved.stored) h.stored.set(path, value);
    const before = h.workspace(), app = new SetPointsController(h.api, 'alice');
    expect((await app.snapshot(null)).visuals?.job?.error).toContain('The profile did not account for every supplied starting visual fact.');
    await app.handle('resume-visuals', {}); await app.waitForVisuals();
    const result = await app.snapshot(null);
    expect(result.visuals?.job?.status).toBe('complete');
    expect(result.visuals?.pack?.profiles[0].appearanceTags).toEqual(['brown hair']);
    expect(result.visuals?.pack?.profiles[0].reviewFacts).toEqual([{kind:'identity',text:'30 years old.',sourceRefs:['chunk:1']}]);
    expect(result.draft).toEqual(before.draft);
    expect(h.workspace().visualInput).toEqual(before.visualInput);
    expect(h.calls).toHaveLength(0);
    await app.handle('save-visuals', {draft:result.draft,pack:result.visuals?.pack});
    const restored = new SetPointsController(h.api, 'alice');
    expect((await restored.snapshot(null)).visuals?.pack).toEqual(result.visuals?.pack);
    expect(h.calls).toHaveLength(0);
  });
  test('resumes a published 0.1.6 grounding-format failure using its paid responses without a new request', async () => {
    const saved = await Bun.file(new URL('./fixtures/visual-references-v016.json', import.meta.url)).json();
    const h = harness(async () => { throw new Error('Recovery must not call the provider'); });
    for (const [path, value] of saved.stored) h.stored.set(path, value);
    const app = new SetPointsController(h.api, 'alice');
    expect((await app.snapshot(null)).visuals?.job?.error).toContain('grounding.description[0] must be text.');
    await app.handle('resume-visuals', {}); await app.waitForVisuals();
    const result = await app.snapshot(null);
    expect(result.visuals?.job?.status).toBe('complete');
    expect(result.visuals?.pack?.profiles[0].appearanceTags).toEqual(['brown hair']);
    expect(result.draft).toEqual(draft());
    expect(h.calls).toHaveLength(0);
    expect(h.workspace().visualInput.sourceText).toBe(source);
  });

  test('an existing completed import accepts manual appearances without rereading or regenerating the story', async () => {
    const h = harness(), original = draft();
    const completed = { id: 'completed-v015', status: 'complete' as const, completed: 4, total: 4, label: 'Ready to review' };
    seed(h, original, { job: completed, lastImport: importOptions });
    const app = new SetPointsController(h.api, 'alice');
    const restored = await app.snapshot(null);
    expect(restored.draft).toEqual(original);
    expect(restored.visuals?.sourceSignature).toBeUndefined();
    const withAppearance = { ...restored.draft!, appearances: [{ characterId: original.cast[0].id, description: 'Brown hair and green eyes.', startingOutfit: 'A grey coat.' }] };
    await app.handle('save-draft', { draft: withAppearance });
    const reopened = await new SetPointsController(h.api, 'alice').snapshot(null);
    expect(reopened.draft).toEqual(withAppearance);
    expect(reopened.job).toEqual(completed);
    expect(h.workspace().lastImport).toEqual(importOptions);
    expect(h.calls).toHaveLength(0);
    expect(paidResponsePaths(h)).toHaveLength(0);
  });

  test('never substitutes the last failed import source for an unbound draft', async () => {
    const h = harness(); seed(h, draft(), { lastImport: { ...importOptions, text: unrelatedSource } });
    const app = new SetPointsController(h.api, 'alice');
    await expect(start(app, draft(), null)).rejects.toThrow();
    expect(h.calls).toHaveLength(0); expect((await app.snapshot(null)).draft).toEqual(draft());
  });

  test('explicit appearance source stays private and does not modify main draft or resume input', async () => {
    const h = harness(); const saved = draft(); seed(h, saved, { lastImport: { ...importOptions, text: unrelatedSource } });
    const app = new SetPointsController(h.api, 'alice');
    await start(app); await app.waitForVisuals();
    const view = await app.snapshot(null);
    expect(view.visuals?.job?.status).toBe('complete'); expect(view.visuals?.pack?.profiles[0].appearanceTags).toEqual(['brown hair']);
    expect(view.draft).toEqual(saved); expect(view.job).toBeNull();
    expect(h.workspace().lastImport.text).toBe(unrelatedSource);
    expect(body(h.calls[0]).source.text).toBe(source);
    expect(JSON.stringify(h.calls)).not.toContain('UNRELATED_FAILED_IMPORT_9281');
    expect(JSON.stringify(view)).not.toContain('APPEARANCE_SOURCE_ONLY_7192');
    expect(view.visuals?.resultSignature).toBe(visualDraftSignature(saved));
  });

  test('successful adaptation binds its exact source even after a later unrelated import fails', async () => {
    const h = harness(), app = new SetPointsController(h.api, 'alice');
    const saved = await completeMain(h, app);
    expect(h.workspace().draftSource).toEqual({ signature: visualDraftSignature(saved), text: source });
    h.setGenerate(async () => { throw new Error('HTTP 503: unavailable'); });
    await app.handle('start-import', { options: { ...importOptions, text: unrelatedSource } }); await app.waitForImport();
    const before = h.calls.length; h.setGenerate(accepted);
    await start(app, saved, null); await app.waitForVisuals();
    expect(body(h.calls[before]).source.text).toBe(source);
    expect((await app.snapshot(null)).visuals?.job?.status).toBe('complete');
    expect((await app.snapshot(null)).draft).toEqual(saved);
    expect(h.workspace().lastImport.text).toBe(unrelatedSource);
  });

  test('editing the draft basis prevents reuse of an old source binding without explicit source', async () => {
    const h = harness(), saved = draft(); seed(h, saved, { draftSource: { signature: visualDraftSignature(saved), text: source } });
    const edited = { ...saved, premise: 'A different premise needing another source.' };
    const app = new SetPointsController(h.api, 'alice'); await app.handle('save-draft', { draft: edited });
    await expect(start(app, edited, null)).rejects.toThrow();
    expect(h.calls).toHaveLength(0); expect((await app.snapshot(null)).draft).toEqual(edited);
  });

  test('late visual completion remains bound to its original draft and cannot replace a saved edit', async () => {
    let release!: (value: unknown) => void;
    const pending = new Promise(resolve => { release = resolve; });
    const h = harness(async request => body(request).task === 'set-points-visual-profile-v1' ? pending : accepted(request)); seed(h);
    const app = new SetPointsController(h.api, 'alice'); await start(app); await h.waitForCall(2);
    const edited = { ...draft(), title: 'My revised story', premise: 'A different direction for this story.' };
    await app.handle('save-draft', { draft: edited });
    release({ content: JSON.stringify(visualReply(h.calls[1])), finish_reason: 'stop' }); await app.waitForVisuals();
    const view = await app.snapshot(null);
    expect(view.draft).toEqual(edited); expect(view.visuals?.job?.status).toBe('complete');
    expect(view.visuals?.resultSignature).toBe(visualDraftSignature(draft()));
    expect(view.visuals?.resultSignature).not.toBe(visualDraftSignature(edited));
  });

  test('failed profile retries reuse paid source analysis after restart and a settings change', async () => {
    let fail = true;
    const h = harness(async request => { if (body(request).task === 'set-points-visual-profile-v1' && fail) throw new Error('HTTP 503: unavailable'); return accepted(request); }); seed(h);
    const app = new SetPointsController(h.api, 'alice'); await start(app); await app.waitForVisuals();
    expect((await app.snapshot(null)).visuals?.resumeAvailable).toBe(true); expect(h.calls).toHaveLength(2);
    const responsesBefore = paidResponsePaths(h).map(path => [path, h.stored.get(path)] as const);
    fail = false;
    const restored = new SetPointsController(h.api, 'alice');
    await restored.handle('resume-visuals', { maxOutputTokens: 32000, reasoningMode: 'low' }); await restored.waitForVisuals();
    const view = await restored.snapshot(null);
    expect(view.visuals?.job?.status).toBe('complete'); expect(h.calls).toHaveLength(3);
    expect(body(h.calls[2]).task).toBe('set-points-visual-profile-v1');
    expect(h.calls[2].parameters.max_tokens).toBe(32000); expect(h.calls[2].reasoning).toEqual({ source: 'custom', apiReasoning: true, effort: 'low' });
    for (const [path, data] of responsesBefore) expect(h.stored.get(path)).toBe(data);
    expect(view.draft).toEqual(draft());
  });

  test('unknown paid outcomes require explicit retry even after changing the allowance', async () => {
    let fail = true;
    const h = harness(async request => { if (body(request).task === 'set-points-visual-profile-v1' && fail) throw new Error('fetch failed'); return accepted(request); }); seed(h);
    const app = new SetPointsController(h.api, 'alice'); await start(app); await app.waitForVisuals();
    expect((await app.snapshot(null)).visuals?.retryUncertain).toBe(true); expect(h.calls).toHaveLength(2);
    fail = false; const restored = new SetPointsController(h.api, 'alice');
    await restored.handle('resume-visuals', { maxOutputTokens: 32000 }); await restored.waitForVisuals();
    expect(h.calls).toHaveLength(2); expect((await restored.snapshot(null)).visuals?.retryUncertain).toBe(true);
    await restored.handle('resume-visuals', { maxOutputTokens: 32000, retryUncertain: true }); await restored.waitForVisuals();
    expect(h.calls).toHaveLength(3); expect((await restored.snapshot(null)).visuals?.job?.status).toBe('complete');
    expect(h.calls.filter(request => body(request).task === 'set-points-visual-facts-v1')).toHaveLength(1);
  });

  test('cancellation retains completed analysis and ignores a late provider result', async () => {
    let release!: (value: unknown) => void;
    const pending = new Promise(resolve => { release = resolve; });
    const h = harness(async request => body(request).task === 'set-points-visual-profile-v1' ? pending : accepted(request)); seed(h);
    const app = new SetPointsController(h.api, 'alice'); await start(app); await h.waitForCall(2);
    const sourceResponse = paidResponsePaths(h).map(path => [path, h.stored.get(path)] as const);
    await app.handle('cancel-visuals', {}); await app.waitForVisuals();
    release({ content: JSON.stringify(visualReply(h.calls[1])), finish_reason: 'stop' }); await Promise.resolve();
    let view = await app.snapshot(null);
    expect(view.visuals?.job?.status).toBe('cancelled'); expect(view.visuals?.pack).toBeNull(); expect(view.draft).toEqual(draft());
    for (const [path, value] of sourceResponse) expect(h.stored.get(path)).toBe(value);
    h.setGenerate(accepted);
    await app.handle('resume-visuals', {}); await app.waitForVisuals();
    view = await app.snapshot(null); expect(view.visuals?.retryUncertain).toBe(true); expect(h.calls).toHaveLength(2);
    await app.handle('resume-visuals', { retryUncertain: true }); await app.waitForVisuals();
    expect((await app.snapshot(null)).visuals?.job?.status).toBe('complete'); expect(h.calls).toHaveLength(3);
  });

  test('overlapping imports and connection checks do not dispatch during visual generation', async () => {
    const h = harness(async () => new Promise(() => {})); seed(h);
    const app = new SetPointsController(h.api, 'alice'); await start(app); await h.waitForCall(1);
    await expect(start(app)).rejects.toThrow();
    await expect(app.handle('start-import', { options: { ...importOptions, text: DEMO_STORY } })).rejects.toThrow();
    await expect(app.handle('test-connection', { connectionId: 'model' })).rejects.toThrow();
    expect(h.calls).toHaveLength(1);
    await app.handle('cancel-visuals', {}); await app.waitForVisuals();
  });

  test('final visual persistence keeps the generation lock until the prior task has fully settled', async () => {
    const h = harness(); seed(h);
    const originalWrite = h.api.userStorage.write;
    let writes = 0, release!: () => void, reached!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const saving = new Promise<void>(resolve => { reached = resolve; });
    h.api.userStorage.write = async (path, value, userId) => {
      if (path === 'workspace.json.tmp' && ++writes === 2) { reached(); await pending; }
      return originalWrite(path, value, userId);
    };
    const app = new SetPointsController(h.api, 'alice');
    await start(app); await saving;
    try {
      await expect(start(app)).rejects.toThrow('already running');
      await expect(app.handle('start-import', { options: importOptions })).rejects.toThrow('image descriptions');
      await expect(app.handle('test-connection', { connectionId: 'model' })).rejects.toThrow('image descriptions');
      expect(h.calls).toHaveLength(2);
    } finally { release(); }
    await app.waitForVisuals();
    await start(app); await app.waitForVisuals();
    expect(h.calls).toHaveLength(2);
    expect((await app.snapshot(null)).visuals?.job?.status).toBe('complete');
  });

  test('restore of malformed visual data preserves the valid main draft and its source binding', async () => {
    const h = harness(); const saved = draft();
    seed(h, saved, { draftSource: { signature: visualDraftSignature(saved), text: source }, visualPack: { version: 999, profiles: 'broken' }, visualJob: { id: 'visual', status: 'complete', completed: 2, total: 2, label: 'Ready' } });
    const app = new SetPointsController(h.api, 'alice'); const view = await app.snapshot(null);
    expect(view.draft).toEqual(saved); expect(view.visuals?.pack).toBeNull(); expect(h.calls).toHaveLength(0);
    expect(view.visuals?.sourceSignature).toBe(visualDraftSignature(saved));
    expect(JSON.stringify(view)).not.toContain('APPEARANCE_SOURCE_ONLY_7192');
  });

  test('editable appearance packs persist independently without model calls and validate draft identity', async () => {
    const h = harness(); seed(h); const app = new SetPointsController(h.api, 'alice');
    await start(app); await app.waitForVisuals();
    const pack = structuredClone((await app.snapshot(null)).visuals!.pack!) as VisualPack;
    pack.profiles[0].description = 'A reviewed description with brown hair.';
    const returned = await app.handle('save-visuals', { draft: draft(), pack });
    expect(returned).toEqual(pack); expect(h.calls).toHaveLength(2);
    const restored = new SetPointsController(h.api, 'alice');
    expect((await restored.snapshot(null)).visuals?.pack).toEqual(pack); expect((await restored.snapshot(null)).draft).toEqual(draft());
    await expect(restored.handle('save-visuals', { draft: draft(), pack: { ...pack, draftId: 'different-draft' } })).rejects.toThrow();
    expect((await restored.snapshot(null)).visuals?.pack).toEqual(pack); expect(h.calls).toHaveLength(2);
  });

  test('a failed workspace save prevents every visual model call', async () => {
    const h = harness(); seed(h); const app = new SetPointsController(h.api, 'alice'); await app.snapshot(null);
    h.failWrite(path => { if (path === 'workspace.json.tmp') throw new Error('Storage unavailable'); });
    await expect(start(app)).rejects.toThrow();
    expect(h.calls).toHaveLength(0); expect((await app.snapshot(null)).draft).toEqual(draft());
  });

  test('visual resume rejects a changed model before dispatch and storage remains user-scoped', async () => {
    const h = harness(async request => { if (body(request).task === 'set-points-visual-profile-v1') throw new Error('HTTP 503: unavailable'); return accepted(request); }); seed(h);
    const app = new SetPointsController(h.api, 'alice'); await start(app); await app.waitForVisuals();
    h.setModel('another-model');
    const restored = new SetPointsController(h.api, 'alice');
    await expect(restored.handle('resume-visuals', {})).rejects.toThrow(); expect(h.calls).toHaveLength(2);
    const bob = new SetPointsController(h.api, 'bob'); const other = await bob.snapshot(null);
    expect(other.draft).toBeNull(); expect(other.visuals?.pack).toBeNull(); expect(other.visuals?.resumeAvailable).toBe(false);
    await expect(bob.handle('resume-visuals', {})).rejects.toThrow(); expect(h.calls).toHaveLength(2);
    expect(h.calls.every(request => request.userId === 'alice')).toBe(true);
  });

  test('an unspecified profile cannot claim source grounding while silently dropping every appearance fact', async () => {
    const h = harness(async request => {
      const response: any = visualReply(request);
      if (body(request).task === 'set-points-visual-profile-v1') {
        response.profile.description = 'Not specified in the source.';
        response.profile.appearanceTags = [];
        response.grounding.appearanceTags = [];
        // A fabricated claim of coverage must not count as retaining the fact.
        // description still cites the exact saved brown-hair fact ID.
      }
      return { content: JSON.stringify(response), finish_reason: 'stop' };
    }); seed(h);
    const app = new SetPointsController(h.api, 'alice'); await start(app); await app.waitForVisuals();
    const view = await app.snapshot(null);
    expect(view.visuals?.job?.status).toBe('failed'); expect(view.visuals?.pack).toBeNull();
    expect(view.draft).toEqual(draft()); expect(h.calls).toHaveLength(3);
    h.setGenerate(accepted);
    await app.handle('resume-visuals', {}); await app.waitForVisuals();
    expect((await app.snapshot(null)).visuals?.pack?.profiles[0].appearanceTags).toEqual(['brown hair']);
    expect(h.calls).toHaveLength(4);
    expect(h.calls.filter(request => body(request).task === 'set-points-visual-facts-v1')).toHaveLength(1);
  });
});
