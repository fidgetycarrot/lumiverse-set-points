import { describe, expect, test } from 'bun:test';
import type { SpindleAPI } from 'lumiverse-spindle-types';
import { validateDraft } from '../src/importer';
import { personaDraft, personaIsAutomatic, playerCharacter, savePersona } from '../src/persona';
import { CardPublisher, draftKey } from '../src/publisher';
import { EXTENSION_ID, type StoryDraft } from '../src/types';
import { draft } from './fixtures';

/** The fixture with the human playing Iona, a cast member. */
function playing(): StoryDraft {
  const story = draft();
  story.playerRole = 'Iona';
  story.roles = { narration: 'neutral', playerCharacterId: 'iona', viewpointCharacterId: null, sourceViewpoint: '' };
  story.appearances = [{ characterId: 'iona', description: 'Age: early fifties\nHair: iron grey, cropped', startingOutfit: 'Salt-stained coat' }];
  return story;
}
function host(granted = true) {
  const storage = new Map<string, unknown>(), personas: any[] = [], cards: any[] = [], books: any[] = [], entries: any[] = [], users: Array<string | undefined> = [];
  let loseReply = false;
  const api = {
    permissions: { has: (permission: string) => granted || permission !== 'personas' },
    userStorage: { getJson: async (key: string, options: any) => structuredClone(storage.get(key) ?? options.fallback), setJson: async (key: string, value: unknown) => { storage.set(key, structuredClone(value)); } },
    personas: {
      list: async ({ offset = 0, limit = 100 }: any) => ({ data: personas.slice(offset, offset + limit), total: personas.length }),
      get: async (id: string) => personas.find(item => item.id === id) ?? null,
      create: async (input: any, userId?: string) => { users.push(userId); const persona = { title: '', description: '', metadata: {}, ...input, id: `persona-${personas.length}` }; personas.push(persona); if (loseReply) { loseReply = false; throw new Error('Reply lost'); } return persona; },
      update: async (id: string, input: any, userId?: string) => { users.push(userId); const persona = personas.find(item => item.id === id); Object.assign(persona, input); return persona; },
    },
    characters: { list: async () => ({ data: cards, total: cards.length }), create: async (input: any) => { const card = { ...input, id: `card-${cards.length}` }; cards.push(card); return card; } },
    world_books: {
      list: async () => ({ data: books, total: books.length }), get: async (id: string) => books.find(book => book.id === id),
      create: async (input: any) => { const book = { ...input, id: `book-${books.length}` }; books.push(book); return book; },
      entries: { list: async (bookId: string) => { const data = entries.filter(entry => entry.world_book_id === bookId); return { data, total: data.length }; }, create: async (bookId: string, input: any) => { const entry = { ...input, id: `entry-${entries.length}`, world_book_id: bookId }; entries.push(entry); return entry; } },
    },
  } as unknown as SpindleAPI;
  return { api, personas, cards, books, users, loseReply: () => { loseReply = true; } };
}
const withPersona = (story = playing()): StoryDraft => ({ ...story, persona: { mode: 'create', ...personaDraft(story) } });

describe('writing a persona from the draft', () => {
  test('uses only the played character’s starting facts and approved look', () => {
    const story = playing(), persona = personaDraft(story);
    expect(playerCharacter(story)?.id).toBe('iona');
    expect(persona.name).toBe('Iona');
    expect(persona.title).toBe('The Lighthouse Letter');
    expect(persona.description).toBe([
      'Iona, also called Captain Iona. From "The Lighthouse Letter", starting at: At the harbor',
      'Personality: Blunt and dependable.',
      'Voice: Short, direct sentences.',
      'Relationships at the start: She knows Elias and is wary of Mara.',
      'What Iona knows at the start: Elias left a letter in the chart room.',
      'Appearance:\nAge: early fifties\nHair: iron grey, cropped',
      'Outfit at the start: Salt-stained coat',
    ].join('\n\n'));
    // Later scenes, private direction, and lore are not part of a persona.
    expect(persona.description).not.toContain('sealed letter rests');
    expect(persona.description).not.toContain('Let the player decide');
    expect(persona.description).not.toContain('coastal village');
    delete story.appearances;
    expect(personaDraft(story).description).not.toContain('Appearance');
  });
  test('gives a newcomer a short starting point instead of someone else’s profile', () => {
    const story = draft(); story.playerRole = 'Mara, the cartographer';
    expect(playerCharacter(story)).toBeUndefined();
    expect(personaDraft(story)).toEqual({ name: 'Mara', title: 'The Lighthouse Letter', description: 'Mara, the cartographer\nJoining "The Lighthouse Letter" at: At the harbor' });
  });
  test('follows the draft until its wording is changed by hand', () => {
    const story = withPersona();
    expect(personaIsAutomatic(story)).toBe(true);
    story.cast[0].voice = 'Clipped orders.';
    expect(personaIsAutomatic(story)).toBe(false);
    Object.assign(story.persona!, personaDraft(story));
    expect(story.persona!.description).toContain('Voice: Clipped orders.');
    story.persona!.description += '\nShe hums when she is nervous.';
    expect(personaIsAutomatic(story)).toBe(false);
    expect(personaIsAutomatic({ ...story, persona: { ...story.persona!, mode: 'none' } })).toBe(false);
  });
});

describe('the persona in a saved draft', () => {
  test('round-trips each choice and stays out of old drafts', () => {
    const plain = validateDraft(draft());
    expect('persona' in plain).toBe(false);
    const made = validateDraft(withPersona());
    expect(made.persona).toEqual({ mode: 'create', ...personaDraft(playing()) });
    expect(validateDraft(JSON.parse(JSON.stringify(made)))).toEqual(made);
    expect(validateDraft({ ...draft(), persona: { mode: 'existing', name: '', title: '', description: '', personaId: 'b9d2c1e0-7a44-4f0e-9c3a-1f2e3d4c5b6a' } }).persona?.personaId).toBe('b9d2c1e0-7a44-4f0e-9c3a-1f2e3d4c5b6a');
    // A skipped persona keeps the text typed so far but never an ID.
    expect(validateDraft({ ...draft(), persona: { mode: 'none', name: 'Kept', title: '', description: 'Kept text', personaId: 'x' } }).persona).toEqual({ mode: 'none', name: 'Kept', title: '', description: 'Kept text' });
  });
  test('rejects unsafe or incomplete choices', () => {
    const base = { mode: 'create', name: 'Iona', title: '', description: 'A captain.' };
    for (const persona of [{ ...base, mode: 'other' }, { ...base, name: ' ' }, { ...base, description: '{{setvar::a::b}}' }, { ...base, title: '<script>x</script>' }, { ...base, name: 'x'.repeat(201) }, { ...base, mode: 'existing' }, { ...base, mode: 'existing', personaId: 'has spaces' }, null, 'Iona']) {
      expect(() => validateDraft({ ...draft(), persona })).toThrow();
    }
  });
});

describe('saving the persona to Lumiverse', () => {
  test('makes one persona, marked as ours, and reuses it on an unchanged save', async () => {
    const h = host(), story = withPersona();
    const first = await savePersona(h.api, story, 'user-a');
    expect(h.personas).toHaveLength(1);
    expect(h.personas[0]).toMatchObject({ name: 'Iona', title: 'The Lighthouse Letter', description: story.persona!.description });
    expect(h.personas[0].metadata[EXTENSION_ID].draftId).toBe(story.id);
    expect(first).toEqual({ personaId: 'persona-0', personaName: 'Iona' });
    expect(await savePersona(h.api, story, 'user-a')).toEqual(first);
    expect(h.personas).toHaveLength(1);
    expect(h.users).toEqual(['user-a']);
  });
  test('updates the persona it made when the draft changes', async () => {
    const h = host(), story = withPersona();
    await savePersona(h.api, story, 'user-a');
    story.persona!.description += '\n\nKeeps a brass compass.';
    const saved = await savePersona(h.api, story, 'user-a');
    expect(h.personas).toHaveLength(1);
    expect(h.personas[0].description).toContain('Keeps a brass compass.');
    expect(saved).toEqual({ personaId: 'persona-0', personaName: 'Iona' });
    // The new text becomes the baseline, so a further change still applies.
    story.persona!.name = 'Captain Iona';
    expect((await savePersona(h.api, story, 'user-a')).personaName).toBe('Captain Iona');
    expect(h.personas).toHaveLength(1);
  });
  test('leaves a persona alone once it was edited in Lumiverse', async () => {
    const h = host(), story = withPersona();
    await savePersona(h.api, story, 'user-a');
    h.personas[0].description = 'Rewritten by hand in Lumiverse.';
    story.persona!.description += '\n\nKeeps a brass compass.';
    const saved = await savePersona(h.api, story, 'user-a');
    expect(h.personas[0].description).toBe('Rewritten by hand in Lumiverse.');
    expect(saved.personaId).toBe('persona-0');
    expect(saved.personaNote).toContain('left as it is');
    expect(h.personas).toHaveLength(1);
  });
  test('finds its persona again when the create reply was lost', async () => {
    const h = host(), story = withPersona(); h.loseReply();
    await expect(savePersona(h.api, story, 'user-a')).rejects.toThrow('Reply lost');
    expect((await savePersona(h.api, story, 'user-a')).personaId).toBe('persona-0');
    expect(h.personas).toHaveLength(1);
  });
  test('remembers a chosen persona without changing it, and says when it is gone', async () => {
    const h = host(), story = { ...playing(), persona: { mode: 'existing' as const, name: '', title: '', description: '', personaId: 'mine' } };
    h.personas.push({ id: 'mine', name: 'Eric', title: 'Me', description: 'Unchanged.', metadata: {} });
    expect(await savePersona(h.api, story, 'user-a')).toEqual({ personaId: 'mine', personaName: 'Eric' });
    expect(h.personas).toEqual([{ id: 'mine', name: 'Eric', title: 'Me', description: 'Unchanged.', metadata: {} }]);
    h.personas.length = 0;
    await expect(savePersona(h.api, story, 'user-a')).rejects.toThrow('no longer in Lumiverse');
    expect(await savePersona(h.api, { ...playing(), persona: { mode: 'none', name: '', title: '', description: '' } }, 'user-a')).toEqual({});
    expect(await savePersona(h.api, playing(), 'user-a')).toEqual({});
  });
});

describe('saving a story with a persona', () => {
  test('saves the card and persona together and reports both', async () => {
    const h = host(), saved = await new CardPublisher(h.api, 'user-a').publish(withPersona());
    expect(saved).toMatchObject({ characterId: 'card-0', worldBookId: 'book-0', personaId: 'persona-0', personaName: 'Iona' });
    expect(h.cards).toHaveLength(1); expect(h.personas).toHaveLength(1);
    // The persona is the human's; it is not copied into the narrator card.
    expect(JSON.stringify(h.cards[0])).not.toContain('"persona"');
  });
  test('stops before saving anything when it may not touch personas', async () => {
    const h = host(false);
    await expect(new CardPublisher(h.api, 'user-a').publish(withPersona())).rejects.toThrow('Grant personas');
    expect(h.cards).toHaveLength(0); expect(h.books).toHaveLength(0); expect(h.personas).toHaveLength(0);
    // Skipping the persona needs no extra permission.
    await new CardPublisher(h.api, 'user-a').publish(playing());
    expect(h.cards).toHaveLength(1);
  });
  test('editing only the persona updates it without making a second card', async () => {
    const h = host(), publisher = new CardPublisher(h.api, 'user-a'), story = withPersona();
    const first = await publisher.publish(story), changed = structuredClone(story);
    changed.persona!.description += '\n\nKeeps a brass compass.';
    expect(await draftKey(changed)).toBe(await draftKey(story));
    expect(await draftKey(story)).toBe(await draftKey(playing()));
    const second = await publisher.publish(changed);
    expect(second.characterId).toBe(first.characterId);
    expect(h.cards).toHaveLength(1); expect(h.books).toHaveLength(1); expect(h.personas).toHaveLength(1);
    expect(h.personas[0].description).toContain('Keeps a brass compass.');
  });
  test('finishes the persona on a retry after the card was already saved', async () => {
    const h = host(), publisher = new CardPublisher(h.api, 'user-a'), story = withPersona(); h.loseReply();
    await expect(publisher.publish(story)).rejects.toThrow('Reply lost');
    expect(h.cards).toHaveLength(1);
    const saved = await publisher.publish(story);
    expect(saved).toMatchObject({ characterId: 'card-0', personaId: 'persona-0' });
    expect(h.cards).toHaveLength(1); expect(h.personas).toHaveLength(1);
  });
});
