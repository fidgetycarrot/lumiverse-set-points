import { describe, expect, test } from 'bun:test';
import type { SpindleAPI } from 'lumiverse-spindle-types';
import { adaptStory, cardPayload, validateDraft, type GenerationMessage } from '../src/importer';
import { leadFromEvents, roleInstruction, roleIssues, roleReviewFingerprint, requireRoleReview, sourceLead } from '../src/roles';
import { newcomerFromPersona, personaBody, personaDraft, personaIsAutomatic, setNewcomer } from '../src/persona';
import { newcomerMessages, validateNewcomer } from '../src/newcomer';
import { repairSceneOpenings } from '../src/scene-repair';
import { SetPointsController } from '../src/backend';
import type { CastMember, ImportOptions, StoryDraft } from '../src/types';

const person = (id: string, name: string, relationships = 'Knows the town.', knowledge = 'Knows the town.'): CastMember => ({ id, name, aliases: [], personality: 'Steady.', voice: 'Plain.', relationships, knowledge, sourceRefs: ['chunk:1'] });
// Wren is the source's lead. The draft's openings wrongly put the human in her place.
const story = (overrides: Partial<StoryDraft> = {}): StoryDraft => ({
  version: 1, id: 'newcomer-draft', title: 'The Moss Gate', premise: 'After Wren opens the moss gate, the forest town of Fenmoor stirs.', playerRole: 'Someone new', startingPoint: 'After the gate opens',
  narratorInstructions: 'Narrate in third person. Leave the player’s choices to them.',
  cast: [person('wren', 'Wren', 'Owes Tamsin a favor.'), person('tamsin', 'Tamsin', 'Wren’s oldest friend; worried about Wren.', 'Wren went through the gate.'), person('oriel', 'Oriel', 'Guards the gate and distrusts Wren.', 'The gate answered Wren.')],
  lore: [{ id: 'gate', name: 'Moss gate', keys: ['gate'], content: 'Only Wren has opened the moss gate.' }],
  scenes: [
    { id: 'gate', title: 'At the gate', greeting: 'The gate glows green. The charm Oriel gave you still hums against your wrist. Mist curls around your boots.', direction: 'Oriel watches from the trees.', assumptions: [], sourceRefs: ['chunk:1'] },
    { id: 'town', title: 'Back in Fenmoor', greeting: 'Tamsin waves from the well as Wren walks past with an armful of herbs. A stranger in the square looks your way.', direction: 'Wren tells Tamsin about the gate.', assumptions: [], sourceRefs: ['chunk:1'] },
  ],
  warnings: [], source: { title: 'The Moss Gate', characters: 1000, chunks: 1 }, createdAt: 1,
  roles: { narration: 'neutral', playerCharacterId: null, viewpointCharacterId: null, sourceViewpoint: '' },
  ...overrides,
});

describe('joining a story as someone new', () => {
  test('finds who the source follows from how the cast and world talk about them, not from scene openings', () => {
    expect(sourceLead(story())?.name).toBe('Wren');
    // Even with Wren missing from every opening, she is still found.
    const erased = story(); erased.scenes = erased.scenes.map(scene => ({ ...scene, greeting: 'Mist moves.', direction: 'Oriel waits. Oriel listens. Oriel watches.' }));
    expect(sourceLead(erased)?.name).toBe('Wren');
    expect(sourceLead(story({ roles: { narration: 'neutral', playerCharacterId: null, viewpointCharacterId: null, sourceViewpoint: 'Told by Tamsin in first person' } }))?.name).toBe('Tamsin');
    expect(sourceLead(story({ playerRole: 'Wren', roles: { narration: 'neutral', playerCharacterId: 'wren', viewpointCharacterId: null, sourceViewpoint: '' } }))).toBeUndefined();
    expect(sourceLead(story({ premise: 'A quiet town.', lore: [], cast: [person('a', 'Ash'), person('b', 'Birch')] }))).toBeUndefined();
  });

  test('names the lead as a separate character in the role contract, only for someone new', () => {
    const text = roleInstruction(story());
    expect(text).toContain('someone new, not any character from the source story');
    expect(text).toContain('Wren, whom the source story follows, stays a separate supporting character');
    expect(text).toContain('Never give the human that character\'s body, history, memories');
    expect(roleInstruction(story(), { newcomer: false })).not.toContain('someone new');
    expect(roleInstruction(story({ playerRole: 'Wren', roles: { narration: 'neutral', playerCharacterId: 'wren', viewpointCharacterId: null, sourceViewpoint: '' } }))).not.toContain('someone new');
    expect(cardPayload(validateDraft(story())).description).toContain('Wren, whom the source story follows');
  });

  test('flags an opening that speaks to “you” where the lead should be', () => {
    const issues = roleIssues(story()).filter(issue => issue.kind === 'identity');
    expect(issues.map(issue => issue.sceneId)).toEqual(['gate']);
    expect(issues[0].message).toContain('Wren is part of this scene’s story but isn’t in this opening');
    expect(issues[0].excerpt).toContain('you');
    // The second scene names Wren, so it is fine.
    expect(() => requireRoleReview(validateDraft(story()))).toThrow('Review the player and viewpoint checks');
    const reviewed = validateDraft(story()); reviewed.roleReview = roleReviewFingerprint(reviewed);
    expect(() => requireRoleReview(reviewed)).not.toThrow();
    // Not for a played source character.
    expect(roleIssues(story({ playerRole: 'Tamsin', roles: { narration: 'neutral', playerCharacterId: 'tamsin', viewpointCharacterId: null, sourceViewpoint: '' } })).some(issue => issue.message.includes('standing in for'))).toBe(false);
  });

  test('takes the lead from who is in the most events before scenes exist', () => {
    const cast = story().cast;
    expect(leadFromEvents(cast, [{ participants: ['Wren', 'Oriel'] }, { participants: ['Wren'] }, { participants: ['Tamsin', 'Wren'] }])?.name).toBe('Wren');
    expect(leadFromEvents(cast, [{ participants: ['Wren'] }, { participants: ['Oriel'] }])).toBeUndefined();
    expect(leadFromEvents(cast, [{ participants: ['Wren'] }, { participants: ['Wren'] }], 'Oriel narrates')?.name).toBe('Oriel');
  });

  test('a written character keeps a new name and a role line that starts with it', () => {
    expect(() => validateNewcomer({ name: 'wren', role: 'Wren, a gatekeeper', description: 'x' }, story().cast)).toThrow('belongs to the source character Wren');
    expect(validateNewcomer({ name: 'Bryn', role: 'a wandering tinker', description: 'Who they are: a tinker.' }, story().cast).role).toBe('Bryn, a wandering tinker');
    expect(validateNewcomer({ name: 'Bryn', role: 'Bryn, a tinker', description: 'A tinker.' }, story().cast).role).toBe('Bryn, a tinker');
    expect(() => validateNewcomer({ name: 'Bryn', role: 'tinker', description: '<script>x</script>' }, story().cast)).toThrow();
    const prompt = newcomerMessages({ title: 't', premise: 'p', startingPoint: 's', playerRole: 'a dwarf smith named Bryn', lead: 'Wren', cast: [], setting: [], opening: '' });
    expect(prompt[0].content).toContain('Keep every detail the player gave');
    expect(prompt[0].content).toContain('The character is an adult');
    expect(prompt[0].content).toContain('Wren, whom the source story follows');
  });

  test('the persona is written from the new character and follows the draft', () => {
    const draft = story({ newcomer: { name: 'Bryn', description: 'Who they are: a tinker.\nAppearance: short, freckled.' } });
    const persona = personaDraft(draft);
    expect(persona.name).toBe('Bryn');
    expect(persona.description).toContain('a tinker');
    expect(persona.description).toContain('Joining "The Moss Gate" at: After the gate opens');
    draft.persona = { mode: 'create', ...persona };
    expect(personaIsAutomatic(draft)).toBe(true);
    expect(validateDraft(draft).newcomer).toEqual({ name: 'Bryn', description: 'Who they are: a tinker.\nAppearance: short, freckled.' });
    expect(() => validateDraft({ ...draft, newcomer: { name: '', description: 'x' } })).toThrow('newcomer.name');
  });

  test('scene repair names the newcomer and the lead in new repairs, and keeps old repair prompts byte for byte', async () => {
    const draft = validateDraft(story({ newcomer: { name: 'Bryn', description: 'A tinker.' } }));
    const seen: GenerationMessage[][] = [];
    const generate = async (messages: GenerationMessage[]) => { seen.push(messages); const body = JSON.parse(messages[1].content); return { content: JSON.stringify({ id: body.scene.id, greeting: 'Wren stands at the glowing gate. A stranger arrives on the path.', direction: 'Wren may speak first.', assumptions: [], roles: { playerCharacterId: null, narration: 'neutral', viewpointCharacterId: null } }) }; };
    await repairSceneOpenings(draft, ['gate'], generate, () => {}, undefined, 3);
    await repairSceneOpenings(draft, ['gate'], generate, () => {}, undefined, 2);
    expect(seen[0][0].content).toContain('Wren, whom the source story follows');
    expect(JSON.parse(seen[0][1].content).player.name).toBe('Bryn');
    expect(seen[1][0].content).not.toContain('someone new');
    expect(JSON.parse(seen[1][1].content).player).toBeUndefined();
  });
});

const ledger = {
  coveredChunks: ['chunk:1'], premise: 'Wren opens the moss gate.',
  cast: [{ name: 'Wren', aliases: [], personality: 'Bold.', voice: 'Quick.', relationships: 'Friend of Tamsin.', knowledgeAtIntroduction: 'Knows the woods.', developments: 'Opens the gate.', sourceRefs: ['chunk:1'] },
    { name: 'Tamsin', aliases: [], personality: 'Kind.', voice: 'Soft.', relationships: 'Friend of Wren.', knowledgeAtIntroduction: 'Knows the town.', developments: 'Worries.', sourceRefs: ['chunk:1'] }],
  setting: [{ name: 'Fenmoor', details: 'A forest town.', sourceRefs: ['chunk:1'] }],
  events: [{ title: 'The gate', summary: 'Wren opens the gate.', participants: ['Wren'], changes: 'The gate wakes.', sourceRefs: ['chunk:1'] },
    { title: 'The town', summary: 'Wren returns to Tamsin.', participants: ['Wren', 'Tamsin'], changes: 'Tamsin learns of it.', sourceRefs: ['chunk:1'] }],
  warnings: [],
};
const importOptions = (overrides: Partial<ImportOptions> = {}): ImportOptions => ({ text: 'Wren opens the moss gate and walks home to Tamsin in Fenmoor before nightfall comes.'.repeat(3), sourceTitle: 'The Moss Gate', playerRole: 'someone new', startingPoint: 'After the gate opens', sceneCount: 2, connectionId: 'test', chunkSize: 12_000, narrationMode: 'neutral', narratorCharacter: '', sourceViewpoint: '', openingStyle: 'interactive', profilePromptVersion: 2, planPromptVersion: 3, ...overrides });
function reply(messages: GenerationMessage[]) {
  const json = (value: unknown) => ({ content: JSON.stringify(value), finish_reason: 'stop' });
  if (messages[1].content.startsWith('SOURCE CHUNK')) return json(ledger);
  const input = JSON.parse(messages[1].content);
  if (input.task === 'set-points-plan-v1') return json({ title: 'The Moss Gate', premise: 'Fenmoor stirs after the gate opens.', narratorInstructions: 'Third person.', startingLore: [0], scenes: [{ title: 'At the gate', eventIndexes: [0], brief: 'The gate glows.', assumptions: [] }, { title: 'Town', eventIndexes: [1], brief: 'Wren returns.', assumptions: [] }], warnings: [] });
  if (input.task === 'set-points-newcomer-v1') return json({ name: 'Bryn', role: 'a wandering tinker who heard the gate wake', description: 'Who they are: a wandering tinker.\nAppearance: short and freckled.' });
  if (input.task === 'set-points-cast-v1') return json({ cast: input.characters.map((item: { id: string }) => ({ id: item.id, personality: 'Steady.', voice: 'Plain.', relationships: 'Known.', knowledge: 'Some.' })), warnings: [] });
  if (input.task === 'set-points-lore-v1') return json({ lore: input.entries.map((item: { id: string }) => ({ id: item.id, keys: ['Fenmoor'], content: 'A forest town.' })), warnings: [] });
  if (input.task === 'set-points-scenes-v1') return json({ scenes: input.scenes.map((scene: { id: string }) => ({ id: scene.id, greeting: 'Wren stands by the glowing gate as a stranger comes up the path.', direction: 'Wren may greet the stranger.', assumptions: [], roles: { playerCharacterId: null, narration: 'neutral', viewpointCharacterId: null } })), warnings: [] });
  throw new Error(`Unexpected request ${input.task}`);
}

describe('importing as someone new', () => {
  test('writes the new character after planning and keeps the lead separate in every later step', async () => {
    const seen: GenerationMessage[][] = [];
    const result = await adaptStory(importOptions(), async messages => { seen.push(messages); return reply(messages); }, () => {});
    const tasks = seen.map(messages => messages[1].content.startsWith('SOURCE CHUNK') ? 'read' : JSON.parse(messages[1].content).task);
    expect(tasks.slice(0, 3)).toEqual(['read', 'set-points-plan-v1', 'set-points-newcomer-v1']);
    expect(seen[1][0].content).toContain('Wren, whom the source story follows, stays a separate supporting character');
    for (const messages of seen.slice(3)) {
      expect(messages[0].content).toContain('The human plays Bryn, a wandering tinker');
      expect(JSON.parse(messages[1].content).foundation.player.name).toBe('Bryn');
    }
    expect(result.playerRole).toBe('Bryn, a wandering tinker who heard the gate wake');
    expect(result.roles?.playerCharacterId).toBeNull();
    expect(result.roles?.sourceViewpoint).toBe('The source story mainly follows Wren.');
    expect(result.newcomer?.name).toBe('Bryn');
    expect(result.persona?.mode).toBe('create');
    expect(result.persona?.name).toBe('Bryn');
    expect(result.persona?.description).toContain('wandering tinker');
    expect(validateDraft(result).newcomer?.name).toBe('Bryn');
  });

  test('a story character keeps the old flow, with a persona made from that character', async () => {
    const seen: string[] = [];
    const result = await adaptStory(importOptions({ playerRole: 'Tamsin' }), async messages => { const reading = messages[1].content.startsWith('SOURCE CHUNK'); seen.push(reading ? 'read' : JSON.parse(messages[1].content).task); const out = reply(messages); if (!reading && JSON.parse(messages[1].content).task === 'set-points-scenes-v1') { const body = JSON.parse(out.content); body.scenes.forEach((scene: { roles: { playerCharacterId: string } }) => { scene.roles.playerCharacterId = 'cast-2'; }); return { ...out, content: JSON.stringify(body) }; } return out; }, () => {});
    expect(seen).not.toContain('set-points-newcomer-v1');
    expect(result.newcomer).toBeUndefined();
    expect(result.persona?.mode).toBe('create');
    expect(result.persona?.name).toBe('Tamsin');
  });

  test('an older saved import resumes with its original prompts and no new request', async () => {
    const seen: string[] = [];
    await adaptStory(importOptions({ planPromptVersion: 2 }), async messages => { const content = messages[0].content; seen.push(content); return reply(messages); }, () => {});
    expect(seen.some(content => content.includes('whom the source story follows') || content.includes('not any character from the source story'))).toBe(false);
  });
});

function host() {
  const stored = new Map<string, unknown>(), chats = new Map<string, { id: string; character_id: string; metadata: Record<string, unknown> }>();
  let active: string | null = 'old-persona';
  const personas = new Map([['story-persona', { id: 'story-persona', name: 'Bryn', title: '', description: '', metadata: {} }], ['mine', { id: 'mine', name: 'Mine', title: '', description: '', metadata: {} }]]);
  const switches: Array<string | null> = [];
  const api = {
    permissions: { has: (name: string) => ['generation', 'personas', 'chats'].includes(name), getGranted: async () => ['generation', 'personas', 'chats'] },
    userStorage: {
      getJson: async (path: string, opts: any) => stored.has(path) ? structuredClone(stored.get(path)) : structuredClone(opts?.fallback),
      setJson: async (path: string, value: unknown) => { stored.set(path, structuredClone(value)); },
      exists: async (path: string) => stored.has(path), read: async (path: string) => { if (!stored.has(path)) throw new Error('missing'); return String(stored.get(path)); },
      write: async (path: string, value: string) => { stored.set(path, value); }, move: async (from: string, to: string) => { stored.set(to, stored.get(from)); stored.delete(from); },
      delete: async (path: string) => { stored.delete(path); }, mkdir: async () => {}, list: async () => [],
    },
    chats: { get: async (id: string) => structuredClone(chats.get(id) ?? null), update: async (id: string, input: { metadata: Record<string, unknown> }) => { chats.get(id)!.metadata = structuredClone(input.metadata); return chats.get(id); } },
    personas: { get: async (id: string) => personas.get(id) ?? null, getActive: async () => (active && personas.get(active)) || null, switchActive: async (id: string | null) => { active = id; switches.push(id); } },
    connections: { get: async (id: string) => id === 'model' ? { id, name: 'Model', model: 'test', provider: 'test' } : null, list: async () => [] },
    generate: { raw: async (input: { messages: GenerationMessage[] }) => ({ content: JSON.stringify({ name: 'Bryn', role: 'a tinker', description: 'Who they are: a tinker.' }), finish_reason: 'stop', input }) },
  } as unknown as SpindleAPI;
  return { api, stored, chats, switches, setActive: (id: string | null) => { active = id; } };
}

describe('using the story persona in its chats', () => {
  test('a new chat with the card plays as the story persona once, stored on that chat', async () => {
    const h = host();
    h.stored.set('personas/card-card-1.json', { personaId: 'story-persona' });
    h.chats.set('chat-1', { id: 'chat-1', character_id: 'card-1', metadata: { chat_variables: { keep: 'me' } } });
    const app = new SetPointsController(h.api, 'alice');
    expect(await app.handle('use-story-persona', { chatId: 'chat-1' })).toEqual({ personaId: 'story-persona', personaName: 'Bryn' });
    expect(h.chats.get('chat-1')!.metadata).toEqual({ chat_variables: { keep: 'me' }, active_persona_id: 'story-persona', lumiverse_set_points_persona: 'story-persona' });
    expect(h.switches).toEqual(['story-persona']);
    // Switching away later is respected: the chat is only set up once.
    h.setActive('mine');
    expect(await app.handle('use-story-persona', { chatId: 'chat-1' })).toBeNull();
    expect(h.switches).toEqual(['story-persona']);
  });

  test('puts the persona back once if Lumiverse picked another while the chat opened', async () => {
    const h = host();
    h.chats.set('chat-1', { id: 'chat-1', character_id: 'card-1', metadata: { active_persona_id: 'story-persona', lumiverse_set_points_persona: 'story-persona' } });
    const app = new SetPointsController(h.api, 'alice');
    h.setActive(null);
    expect((await app.handle('use-story-persona', { chatId: 'chat-1', confirm: true }) as { personaName: string }).personaName).toBe('Bryn');
    expect(await app.handle('use-story-persona', { chatId: 'chat-1', confirm: true })).toBeNull();
  });

  test('leaves a persona already chosen for the chat, and ignores other cards', async () => {
    const h = host();
    h.stored.set('personas/card-card-1.json', { personaId: 'story-persona' });
    h.chats.set('chat-1', { id: 'chat-1', character_id: 'card-1', metadata: { active_persona_id: 'mine' } });
    h.chats.set('chat-2', { id: 'chat-2', character_id: 'other-card', metadata: {} });
    const app = new SetPointsController(h.api, 'alice');
    expect(await app.handle('use-story-persona', { chatId: 'chat-1' })).toBeNull();
    expect(h.chats.get('chat-1')!.metadata.active_persona_id).toBe('mine');
    expect(await app.handle('use-story-persona', { chatId: 'chat-2' })).toBeNull();
    expect(h.chats.get('chat-2')!.metadata).toEqual({});
    expect(h.switches).toEqual([]);
  });

  test('a card saved before this version uses the persona from the last save', async () => {
    const h = host();
    h.stored.set('workspace.json', JSON.stringify({ draft: null, saved: { characterId: 'card-1', worldBookId: 'b', draftId: 'd', title: 't', personaId: 'story-persona', personaName: 'Bryn' }, job: null }));
    h.chats.set('chat-1', { id: 'chat-1', character_id: 'card-1', metadata: {} });
    const app = new SetPointsController(h.api, 'alice');
    expect((await app.handle('use-story-persona', { chatId: 'chat-1' }) as { personaName: string }).personaName).toBe('Bryn');
  });

  test('writes a new character for an existing draft with one request', async () => {
    const h = host();
    const app = new SetPointsController(h.api, 'alice');
    const result = await app.handle('write-newcomer', { draft: story(), connectionId: 'model' }) as { newcomer: { name: string }; role: string };
    expect(result.newcomer.name).toBe('Bryn');
    expect(result.role).toBe('Bryn, a tinker');
    await expect(app.handle('write-newcomer', { draft: story({ playerRole: 'Wren', roles: { narration: 'neutral', playerCharacterId: 'wren', viewpointCharacterId: null, sourceViewpoint: '' } }), connectionId: 'model' })).rejects.toThrow('Custom or unbound role');
  });
});

describe('your own character stays yours', () => {
  test('your own description is kept word for word; the model only adds what is missing', () => {
    const own = 'Bruenor is a huge warrior with a battle hammer.\n\nAppearance: brown hair, blue eyes, short beard.';
    const made = validateNewcomer({ name: 'Bruenor', role: 'Bruenor, a warrior', missing: 'Why they are here: looking for his lost party.' }, story().cast, own);
    expect(made.description.startsWith(own)).toBe(true);
    expect(made.description).toContain('looking for his lost party');
    expect(validateNewcomer({ name: 'Bruenor', role: 'Bruenor, a warrior', missing: '' }, story().cast, own).description).toBe(own);
    const prompt = newcomerMessages({ title: 't', premise: 'p', startingPoint: 's', playerRole: 'someone new', cast: [], setting: [], opening: '', playerDetails: own });
    expect(prompt[0].content).toContain('kept exactly as they wrote it');
    expect(JSON.parse(prompt[1].content).task).toBe('set-points-newcomer-details-v1');
    // Without details, the request is unchanged from 0.1.15.
    expect(JSON.parse(newcomerMessages({ title: 't', premise: 'p', startingPoint: 's', playerRole: 'x', cast: [], setting: [], opening: '' })[1].content)).not.toHaveProperty('playerDetails');
  });

  test('editing the persona renames the character, remembers the old name, and keeps the role in step', () => {
    const draft = validateDraft(story({ playerRole: 'Maren, a traveling tinker', newcomer: { name: 'Maren', description: 'A tinker.' } }));
    draft.persona = { mode: 'create', ...personaDraft(draft) };
    draft.persona.name = 'Bruenor';
    draft.persona.description = 'Bruenor is a huge warrior.\n\nJoining "The Moss Gate" at: After the gate opens\n\n' + personaDraft(draft).description.split('\n\n').at(-1);
    expect(newcomerFromPersona(draft)).toBe(true);
    expect(draft.newcomer).toEqual({ name: 'Bruenor', description: 'Bruenor is a huge warrior.', previousNames: ['Maren'] });
    expect(draft.playerRole).toBe('Bruenor, a traveling tinker');
    expect(personaIsAutomatic(draft)).toBe(true);
    expect(personaBody(draft.persona.description)).toBe('Bruenor is a huge warrior.');
    expect(validateDraft(draft).newcomer?.previousNames).toEqual(['Maren']);
    // Renaming back drops the name from the old list.
    setNewcomer(draft, { name: 'Maren', description: 'A tinker.' });
    expect(draft.newcomer?.previousNames).toEqual(['Bruenor']);
  });

  test('flags a role that names someone else, and openings that call you by name or an old name', () => {
    const draft = story({ playerRole: 'Bruenor, a warrior', newcomer: { name: 'Maren', description: 'A tinker.' } });
    draft.scenes[1].greeting = 'Wren nods. Maren’s footsteps echo as Tamsin turns to face Maren.';
    const issues = roleIssues(draft);
    expect(issues.find(issue => issue.fieldKey === 'playerRole')?.message).toBe('Your role doesn’t name your character, Maren. Use the same name in both, so the narrator knows who you are.');
    expect(issues.find(issue => issue.sceneId === 'town' && issue.kind === 'identity')?.message).toBe('This opening calls you “Maren”. Openings should speak to you as “you”.');
    const renamed = story({ playerRole: 'Bruenor, a warrior', newcomer: { name: 'Bruenor', description: 'A warrior.', previousNames: ['Maren'] } });
    renamed.scenes[1].greeting = draft.scenes[1].greeting; renamed.scenes[1].direction = 'Wren greets Maren.';
    const after = roleIssues(renamed);
    expect(after.some(issue => issue.fieldKey === 'playerRole')).toBe(false);
    expect(after.find(issue => issue.fieldKey === 'scene:town:greeting')?.message).toContain('old name, “Maren”');
    expect(after.find(issue => issue.fieldKey === 'scene:town:direction')?.message).toContain('Change it to Bruenor');
    // Quoted dialogue that uses the name is fine.
    renamed.scenes[1].greeting = 'Wren calls out, “Bruenor, over here!”'; renamed.scenes[1].direction = 'Wren waves.';
    expect(roleIssues(renamed).some(issue => issue.sceneId === 'town' && issue.message.includes('calls you'))).toBe(false);
  });

  test('new repairs tell the model to call you “you” and drop old names; older repair prompts are unchanged', async () => {
    const draft = validateDraft(story({ newcomer: { name: 'Bruenor', description: 'A warrior.', previousNames: ['Maren'] } }));
    const seen: GenerationMessage[][] = [];
    const generate = async (messages: GenerationMessage[]) => { seen.push(messages); const body = JSON.parse(messages[1].content); return { content: JSON.stringify({ id: body.scene.id, greeting: 'Wren stands at the gate as you arrive.', direction: 'Wren may speak first.', assumptions: [], roles: { playerCharacterId: null, narration: 'neutral', viewpointCharacterId: null } }) }; };
    await repairSceneOpenings(draft, ['gate'], generate, () => {}, undefined, 4);
    await repairSceneOpenings(draft, ['gate'], generate, () => {}, undefined, 3);
    expect(seen[0][0].content).toContain('The human plays the supplied player, Bruenor. In narration, call them “you”');
    expect(seen[0][0].content).toContain('any of their previous names');
    expect(JSON.parse(seen[0][1].content).player.previousNames).toEqual(['Maren']);
    expect(seen[1][0].content).not.toContain('The human plays the supplied player');
  });

  test('an import with your own description uses it as your character and persona', async () => {
    const own = 'Bruenor is a huge warrior with a battle hammer.';
    const seen: GenerationMessage[][] = [];
    const result = await adaptStory(importOptions({ playerDetails: own }), async messages => {
      seen.push(messages);
      if (!messages[1].content.startsWith('SOURCE CHUNK') && JSON.parse(messages[1].content).task === 'set-points-newcomer-details-v1') return { content: JSON.stringify({ name: 'Bruenor', role: 'Bruenor, a warrior', missing: 'Why they are here: he lost his party.' }), finish_reason: 'stop' };
      return reply(messages);
    }, () => {});
    expect(result.newcomer?.description).toBe(`${own}\n\nWhy they are here: he lost his party.`);
    expect(result.persona?.name).toBe('Bruenor');
    expect(result.persona?.description.startsWith(own)).toBe(true);
    expect(result.playerRole).toBe('Bruenor, a warrior');
    const later = seen.filter(messages => !messages[1].content.startsWith('SOURCE CHUNK') && JSON.parse(messages[1].content).task === 'set-points-scenes-v1');
    expect(later[0][1].content).toContain('call them “you”, never by name');
  });

  test('Write my character keeps a persona you wrote yourself', async () => {
    const h = host();
    let sent: any;
    (h.api as any).generate.raw = async (input: any) => { sent = input; return { content: JSON.stringify({ name: 'Bruenor', role: 'Bruenor, a warrior', missing: '' }), finish_reason: 'stop' }; };
    const draft = story({ newcomer: { name: 'Maren', description: 'A tinker.' } });
    draft.persona = { mode: 'create', name: 'Bruenor', title: 't', description: 'Bruenor is a huge warrior.' };
    const result = await new SetPointsController(h.api, 'alice').handle('write-newcomer', { draft, connectionId: 'model' }) as { newcomer: { description: string } };
    expect(JSON.parse(sent.messages[1].content).playerDetails).toBe('Bruenor is a huge warrior.');
    expect(result.newcomer.description).toBe('Bruenor is a huge warrior.');
  });
});
