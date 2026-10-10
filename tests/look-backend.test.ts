import { describe, expect, test } from 'bun:test';
import type { SpindleAPI } from 'lumiverse-spindle-types';
import { SetPointsController } from '../src/backend';
import { LOOK_FIELDS, lookDraftSignature, type LookPack } from '../src/looks';
import { visualDraftSignature } from '../src/visuals';
import type { StoryDraft } from '../src/types';
import { draft } from './fixtures';

const source = 'LOOK_SOURCE_4417. Iona keeps the harbor boat. She has cropped grey hair and hauls the nets alone each morning. A traveler arrives with a letter while the lantern is lit and the sea is calm.';
function body(request: any): any { return JSON.parse(request.messages[1].content); }
function lookReply(request: any): unknown {
  const input = body(request);
  const traits = (person: any, tag: string) => LOOK_FIELDS.map(field => {
    const cited = person.clues.filter((clue: any) => clue.about === field);
    return cited.length ? { field, value: 'Cropped grey hair', basis: 'story', clueIds: cited.map((clue: any) => clue.id), why: '' } : { field, value: `${field} ${tag}`, basis: 'invented', clueIds: [], why: 'fits harbor work' };
  });
  if (input.task === 'set-points-look-clues-v1') return { characters: input.cast.map((person: any) => ({ characterId: person.characterId, clues: [{ kind: 'stated', about: 'hair', timing: 'start', text: 'Cropped grey hair.', evidence: 'cropped grey hair' }] })), warnings: [] };
  if (input.task === 'set-points-look-design-v1') return { looks: input.characters.map((person: any) => ({ characterId: person.characterId, traits: traits(person, 'first') })), warnings: [] };
  if (input.task === 'set-points-look-reroll-v1') return { look: { characterId: input.character.characterId, traits: traits(input.character, `reroll-${input.attempt}`) }, warnings: [] };
  throw new Error('Unexpected look request in test');
}
const accepted = (request: any) => Promise.resolve({ content: JSON.stringify(lookReply(request)), finish_reason: 'stop' });
function harness(initial: (request: any) => Promise<unknown> = accepted, granted = ['generation']) {
  const stored = new Map<string, unknown>(), calls: any[] = [], personas = [{ id: 'mine', name: 'Eric', title: 'Me', description: 'Private text.', metadata: {} }], switched: Array<string | null> = [];
  let generate = initial;
  const key = (path: string, userId?: string) => `${userId}:${path}`;
  const api = {
    permissions: { has: (permission: string) => granted.includes(permission), getGranted: async () => [...granted] },
    userStorage: {
      exists: async (path: string, userId?: string) => stored.has(key(path, userId)),
      read: async (path: string, userId?: string) => { const value = stored.get(key(path, userId)); if (value === undefined) throw new Error('Missing storage file'); return typeof value === 'string' ? value : JSON.stringify(value); },
      write: async (path: string, value: string, userId?: string) => { stored.set(key(path, userId), value); },
      move: async (from: string, to: string, userId?: string) => { const value = stored.get(key(from, userId)); if (value === undefined) throw new Error('Missing storage file'); stored.set(key(to, userId), value); stored.delete(key(from, userId)); },
      getJson: async (path: string, options: any) => { const value = stored.get(key(path, options?.userId)); return value === undefined ? structuredClone(options?.fallback) : typeof value === 'string' ? JSON.parse(value) : structuredClone(value); },
      setJson: async (path: string, value: unknown, options: any) => { stored.set(key(path, options?.userId), structuredClone(value)); },
    },
    connections: { get: async (id: string) => id === 'model' ? { id, name: 'Model', provider: 'test', model: 'test' } : null, list: async () => [{ id: 'model', name: 'Model', provider: 'test', model: 'test' }] },
    generate: { raw: async (request: any) => { calls.push(request); return generate(request); } },
    personas: { list: async () => ({ data: personas, total: personas.length }), get: async (id: string) => personas.find(item => item.id === id) ?? null, switchActive: async (id: string | null) => { switched.push(id); } },
  } as unknown as SpindleAPI;
  return {
    api, stored, calls, switched,
    setGenerate(next: typeof generate) { generate = next; },
    workspace(): any { const value = stored.get('alice:workspace.json'); return typeof value === 'string' ? JSON.parse(value) : structuredClone(value); },
    tasks() { return calls.map(call => body(call).task); },
  };
}
function seed(h: ReturnType<typeof harness>, value: StoryDraft = draft(), bind = true, extra: Record<string, unknown> = {}) {
  h.stored.set('alice:workspace.json', { draft: value, saved: null, job: null, ...(bind ? { draftSource: { signature: visualDraftSignature(value), text: source } } : {}), ...extra });
}
async function design(app: SetPointsController, input: Record<string, unknown> = {}) {
  await app.handle('start-looks', { draft: draft(), connectionId: 'model', ...input }); await app.waitForLooks();
  return (await app.snapshot(null)).looks!;
}
const value = (pack: LookPack | null, field: string) => pack!.looks[0].traits.find(trait => trait.field === field)!.value;

describe('designing looks as a saved, resumable step', () => {
  test('uses the story saved with the draft and leaves the draft untouched', async () => {
    const h = harness(); seed(h);
    const app = new SetPointsController(h.api, 'alice'), looks = await design(app);
    expect(looks.job).toMatchObject({ status: 'complete', label: 'Looks ready to review', completed: 2, total: 2 });
    expect(h.tasks()).toEqual(['set-points-look-clues-v1', 'set-points-look-design-v1']);
    expect(body(h.calls[0]).source.text).toBe(source);
    expect(looks.resultSignature).toBe(lookDraftSignature(draft()));
    expect(looks.pack!.looks[0].traits.find(trait => trait.field === 'hair')).toMatchObject({ basis: 'story', value: 'Cropped grey hair' });
    const view = await app.snapshot(null);
    expect(view.draft).toEqual(draft());
    expect(h.workspace().lookPack).toEqual(looks.pack);
  });
  test('needs the story text when none is saved for this version of the draft', async () => {
    const h = harness(); seed(h, draft(), false);
    const app = new SetPointsController(h.api, 'alice');
    await expect(app.handle('start-looks', { draft: draft(), connectionId: 'model' })).rejects.toThrow('Add the original story');
    await expect(app.handle('start-looks', { draft: draft(), connectionId: 'model', sourceText: 'too short' })).rejects.toThrow('between 100 and 500,000');
    expect(h.calls).toHaveLength(0);
    const looks = await design(app, { sourceText: source });
    expect(looks.job?.status).toBe('complete');
    // The text given once is remembered for this draft, for looks and image descriptions alike.
    expect(h.workspace().draftSource).toEqual({ signature: visualDraftSignature(draft()), text: source });
    expect((await app.snapshot(null)).visuals?.sourceSignature).toBe(visualDraftSignature(draft()));
  });
  test('rerolls one character with a single request and no second read of the story', async () => {
    const h = harness(); seed(h);
    const app = new SetPointsController(h.api, 'alice'), first = await design(app);
    await app.handle('reroll-look', { draft: draft(), connectionId: 'model', characterId: 'iona', note: 'shorter' }); await app.waitForLooks();
    const second = (await app.snapshot(null)).looks!;
    expect(h.tasks()).toEqual(['set-points-look-clues-v1', 'set-points-look-design-v1', 'set-points-look-reroll-v1']);
    expect(body(h.calls[2])).toMatchObject({ change: 'shorter', attempt: 1 });
    expect(JSON.stringify(body(h.calls[2]))).not.toContain('LOOK_SOURCE_4417');
    expect(second.job).toMatchObject({ status: 'complete', label: 'New look ready to review' });
    expect(value(first.pack, 'build')).toBe('build first');
    expect(value(second.pack, 'build')).toBe('build reroll-1');
    expect(value(second.pack, 'hair')).toBe('Cropped grey hair');
    expect(second.pack!.looks[0].rerolls).toBe(1);
    expect(second.rerolling).toBeUndefined();
  });
  test('keeps looks through review edits but never rerolls them against another draft or cast', async () => {
    const h = harness(); seed(h);
    const app = new SetPointsController(h.api, 'alice'); await design(app);
    const other = { ...draft(), id: 'another-draft' }, grown = draft(); grown.cast.push({ ...grown.cast[0], id: 'elias', name: 'Elias', aliases: [] });
    await expect(app.handle('reroll-look', { draft: other, connectionId: 'model', characterId: 'iona' })).rejects.toThrow('different draft or cast');
    await expect(app.handle('reroll-look', { draft: grown, connectionId: 'model', characterId: 'iona' })).rejects.toThrow('different draft or cast');
    await expect(app.handle('reroll-look', { draft: draft(), connectionId: 'model', characterId: 'nobody' })).rejects.toThrow('Choose a character');
    expect(h.calls).toHaveLength(2);
    // Rewording a character or approving a look does not undo the design; the reroll sees the newer text.
    const edited = { ...draft(), premise: 'A reworded premise.', appearances: [{ characterId: 'iona', description: 'Hair: cropped grey', startingOutfit: '' }] };
    edited.cast[0].personality = 'Gentle and slow to anger.';
    await app.handle('reroll-look', { draft: edited, connectionId: 'model', characterId: 'iona' }); await app.waitForLooks();
    expect((await app.snapshot(null)).looks?.job?.status).toBe('complete');
    expect(body(h.calls[2]).character.personality).toBe('Gentle and slow to anger.');
  });
  test('keeps the earlier looks when a reroll fails, and resumes without repeating finished steps', async () => {
    const h = harness(); seed(h);
    const app = new SetPointsController(h.api, 'alice'), first = await design(app);
    h.setGenerate(async () => ({ content: 'not json', finish_reason: 'stop' }));
    await app.handle('reroll-look', { draft: draft(), connectionId: 'model', characterId: 'iona' }); await app.waitForLooks();
    let looks = (await app.snapshot(null)).looks!;
    expect(looks.job?.status).toBe('failed');
    expect(looks.job?.error).toContain('Resume reuses them');
    expect(looks.resumeAvailable).toBe(true);
    expect(looks.pack).toEqual(first.pack);
    const before = h.calls.length;
    h.setGenerate(accepted);
    await app.handle('resume-looks', {}); await app.waitForLooks();
    looks = (await app.snapshot(null)).looks!;
    expect(looks.job?.status).toBe('complete');
    expect(value(looks.pack, 'build')).toBe('build reroll-1');
    expect(h.calls.length - before).toBe(1);
  });
  test('a failed design resumes from the saved clue reading', async () => {
    const h = harness(async request => body(request).task === 'set-points-look-design-v1' ? { content: '{"looks":[]}', finish_reason: 'stop' } : accepted(request)); seed(h);
    const app = new SetPointsController(h.api, 'alice'), failed = await design(app);
    expect(failed.job).toMatchObject({ status: 'failed', phase: 'Designing the cast together' });
    expect(failed.pack).toBeNull();
    h.setGenerate(accepted); const before = h.calls.length;
    await app.handle('resume-looks', {}); await app.waitForLooks();
    expect((await app.snapshot(null)).looks?.job?.status).toBe('complete');
    // Only the design is asked for again; the story was already read.
    expect(h.tasks().slice(before)).toEqual(['set-points-look-design-v1']);
  });
  test('cancelling keeps finished steps and offers resume', async () => {
    let release: () => void = () => {};
    const h = harness(request => body(request).task === 'set-points-look-design-v1' ? new Promise(resolve => { release = () => resolve({ content: JSON.stringify(lookReply(request)), finish_reason: 'stop' }); }) : accepted(request)); seed(h);
    const app = new SetPointsController(h.api, 'alice');
    await app.handle('start-looks', { draft: draft(), connectionId: 'model' });
    while (h.calls.length < 2) await new Promise(resolve => setTimeout(resolve, 2));
    expect((await app.snapshot(null)).looks?.job?.status).toBe('running');
    expect(await app.handle('cancel-looks', {})).toEqual({ cancelled: true });
    await app.waitForLooks(); release();
    const looks = (await app.snapshot(null)).looks!;
    expect(looks.job).toMatchObject({ status: 'cancelled', label: 'Look design cancelled; saved steps kept' });
    expect(looks.resumeAvailable).toBe(true);
    expect((await app.snapshot(null)).draft).toEqual(draft());
  });
  test('survives a restart and sets aside saved looks it cannot read', async () => {
    const h = harness(); seed(h);
    const first = await design(new SetPointsController(h.api, 'alice'));
    const reopened = await new SetPointsController(h.api, 'alice').snapshot(null);
    expect(reopened.looks?.pack).toEqual(first.pack);
    expect(reopened.looks?.resultSignature).toBe(first.resultSignature);
    const saved = h.workspace();
    h.stored.set('alice:workspace.json', { ...saved, lookJob: { ...saved.lookJob, status: 'running' } });
    const interrupted = await new SetPointsController(h.api, 'alice').snapshot(null);
    expect(interrupted.looks?.job).toMatchObject({ status: 'failed', label: 'Look design interrupted' });
    h.stored.set('alice:workspace.json', { ...saved, lookPack: { version: 1, draftId: 'test-draft', looks: [{ characterId: 'iona', traits: [] }], warnings: [] } });
    const damaged = await new SetPointsController(h.api, 'alice').snapshot(null);
    expect(damaged.draft).toEqual(draft());
    expect(damaged.looks?.pack).toBeNull();
    expect(damaged.looks?.job?.label).toBe('Saved looks need attention');
    expect([...h.stored.keys()].some(path => path.startsWith('alice:recovery/looks-'))).toBe(true);
  });
  test('does not run alongside other model work', async () => {
    let release: () => void = () => {};
    const h = harness(request => new Promise(resolve => { release = () => resolve({ content: JSON.stringify(lookReply(request)), finish_reason: 'stop' }); })); seed(h);
    const app = new SetPointsController(h.api, 'alice');
    await app.handle('start-looks', { draft: draft(), connectionId: 'model' });
    await expect(app.handle('start-looks', { draft: draft(), connectionId: 'model' })).rejects.toThrow('already being designed');
    await expect(app.handle('start-visuals', { draft: draft(), connectionId: 'model' })).rejects.toThrow('Wait for look design');
    await expect(app.handle('test-connection', { connectionId: 'model' })).rejects.toThrow('Wait for look design');
    await expect(app.handle('start-scene-repair', { draft: draft(), sceneIds: ['harbor'], connectionId: 'model' })).rejects.toThrow('Wait for the current operation');
    await expect(app.handle('start-import', { options: { text: source, sourceTitle: 'T', playerRole: 'Mara', startingPoint: 'Start', sceneCount: 2, chunkSize: 12000, connectionId: 'model' } })).rejects.toThrow('Wait for look design');
    await app.handle('cancel-looks', {}); await app.waitForLooks(); release();
  });
  test('reports look progress in diagnostics without story text', async () => {
    const h = harness(); seed(h);
    const app = new SetPointsController(h.api, 'alice'); await design(app);
    const report = JSON.stringify(await app.handle('diagnostics', {}));
    expect(JSON.parse(report).lookJob).toMatchObject({ status: 'complete', completed: 2, total: 2 });
    expect(report).not.toContain('LOOK_SOURCE_4417');
    expect(report).not.toContain('Cropped grey hair');
  });
});

describe('personas in the workspace', () => {
  test('lists personas only when allowed, by name and label alone', async () => {
    const without = harness(); seed(without);
    expect((await new SetPointsController(without.api, 'alice').snapshot(null)).personas).toBeUndefined();
    const h = harness(accepted, ['generation', 'personas']); seed(h);
    const view = await new SetPointsController(h.api, 'alice').snapshot(null);
    expect(view.personas).toEqual([{ id: 'mine', name: 'Eric', title: 'Me' }]);
    expect(JSON.stringify(view)).not.toContain('Private text.');
  });
  test('switches the active persona only on request, and only to one that exists', async () => {
    const denied = harness(); seed(denied);
    await expect(new SetPointsController(denied.api, 'alice').handle('switch-persona', { personaId: 'mine' })).rejects.toThrow('Grant personas');
    const h = harness(accepted, ['generation', 'personas']); seed(h);
    const app = new SetPointsController(h.api, 'alice');
    await expect(app.handle('switch-persona', { personaId: 'gone' })).rejects.toThrow('no longer in Lumiverse');
    expect(h.switched).toEqual([]);
    expect(await app.handle('switch-persona', { personaId: 'mine' })).toEqual({ personaId: 'mine', name: 'Eric' });
    expect(h.switched).toEqual(['mine']);
  });
});
