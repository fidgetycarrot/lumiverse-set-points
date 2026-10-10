import { describe, expect, test } from 'bun:test';
import type { Generate, GenerationMessage } from '../src/importer';
import { BASIS_LABELS, LOOK_FIELDS, LOOK_LIMITS, approvedFromLook, designLooks, lookAppearance, lookInUse, lookOutfit, rerollLook, useLooks, validateLookPack, type CharacterLook, type LookPack } from '../src/looks';
import type { StoryDraft } from '../src/types';

// An original neutral fixture. The story never says what Bram looks like.
const source = 'Mira keeps the ferry at Low Water. She is fifty this spring and has cropped white hair. At the landing she wears a patched oilskin. Bram, her nephew, has hauled the chain since he was a boy. Later, Mira breaks her wrist and wears a sling. Bram ducks under the lintel of the boathouse.';
const draft = (names = ['Mira', 'Bram']): StoryDraft => ({
  version: 1, id: 'looks-story', title: 'Low Water', premise: 'A ferry crossing in a river town.', playerRole: 'A traveler', startingPoint: 'The landing, before the crossing.',
  narratorInstructions: 'Leave the traveler’s choices open.',
  cast: names.map((name, index) => ({ id: `cast-${index + 1}`, name, aliases: [], personality: index ? 'Quiet and stubborn.' : 'Dry and exact.', voice: 'Plain speech.', relationships: 'Family who work the ferry.', knowledge: 'The river is rising.', sourceRefs: ['chunk:1'] })),
  lore: [{ id: 'low-water', name: 'Low Water', keys: ['Low Water'], content: 'A cold river town with one chain ferry.' }],
  scenes: [{ id: 'scene-1', title: 'The landing', greeting: 'The chain creaks. Mira looks up from the winch.', direction: 'Offer the crossing.', assumptions: [], sourceRefs: ['chunk:1'] }],
  warnings: [], source: { title: 'Low Water', characters: source.length, chunks: 1 }, createdAt: 1,
});
const reply = (value: unknown) => ({ content: JSON.stringify(value), finish_reason: 'stop' });
const body = (messages: GenerationMessage[]) => JSON.parse(messages[1].content);
const clues = () => ({ characters: [
  { characterId: 'cast-1', clues: [
    { kind: 'stated', about: 'age', timing: 'start', text: 'Fifty years old.', evidence: 'She is fifty this spring' },
    { kind: 'stated', about: 'hair', timing: 'start', text: 'Cropped white hair.', evidence: 'cropped white hair' },
    { kind: 'stated', about: 'outfit', timing: 'start', text: 'A patched oilskin.', evidence: 'she wears a patched oilskin' },
    { kind: 'stated', about: 'marks', timing: 'later', text: 'Arm in a sling.', evidence: 'wears a sling' },
  ] },
  { characterId: 'cast-2', clues: [
    { kind: 'implied', about: 'build', timing: 'start', text: 'Years hauling chain: heavy shoulders, rough hands.', evidence: 'has hauled the chain since he was a boy' },
    { kind: 'implied', about: 'height', timing: 'start', text: 'Ducks under a lintel: tall.', evidence: 'Bram ducks under the lintel' },
    { kind: 'stated', about: 'eyes', timing: 'start', text: 'Bright green eyes.', evidence: 'his eyes were bright green' },
  ] },
], warnings: [] });
type Brief = { characterId: string; clues: Array<{ id: string; kind: string; about: string }> };
/** A well-behaved designer: cites every clue it was given, invents the rest. */
function designed(person: Brief, tag = 'a') {
  return { characterId: person.characterId, traits: LOOK_FIELDS.map(field => {
    const cited = person.clues.filter(clue => clue.about === field);
    if (!cited.length) return { field, value: `${field} ${tag}.`, basis: 'invented', clueIds: [], why: 'fits a river life' };
    return { field, value: `${field} from clue`, basis: cited[0].kind === 'stated' ? 'story' : 'implied', clueIds: cited.map(clue => clue.id), why: 'the chain work' };
  }) };
}
function model(overrides: Partial<Record<string, (input: any) => unknown>> = {}) {
  const calls: any[] = [];
  const generate: Generate = async messages => {
    const input = body(messages); calls.push({ system: messages[0].content, input });
    const custom = overrides[input.task];
    if (custom) return reply(custom(input));
    if (input.task === 'set-points-look-clues-v1') return reply(clues());
    if (input.task === 'set-points-look-design-v1') return reply({ looks: input.characters.map((person: Brief) => designed(person)), warnings: [] });
    if (input.task === 'set-points-look-reroll-v1') return reply({ look: designed(input.character, `b${input.attempt}`), warnings: [] });
    throw new Error('Unexpected look request');
  };
  return { generate, calls };
}
const design = (generate: Generate, value = draft(), text = source) => designLooks({ draft: value, sourceText: text }, generate, () => {});
const trait = (look: CharacterLook, field: string) => look.traits.find(item => item.field === field)!;

describe('designing looks from the story', () => {
  test('reads clues first, then designs the whole cast in one request', async () => {
    const { generate, calls } = model(), progress: string[] = [];
    const pack = await designLooks({ draft: draft(), sourceText: source }, generate, (_done, _total, label) => progress.push(label));
    expect(calls.map(call => call.input.task)).toEqual(['set-points-look-clues-v1', 'set-points-look-design-v1']);
    expect(progress).toEqual(['Reading the story for clues, section 1 of 1', 'Designing the cast together', 'Looks ready to review']);
    // Both characters go to the designer together so it can make them differ.
    expect(calls[1].input.characters.map((person: Brief) => person.characterId)).toEqual(['cast-1', 'cast-2']);
    expect(calls[1].system).toContain('Design the cast as a set');
    expect(calls[1].system).toContain('Avoid stock description');
    expect(calls[1].system).toContain('design them as an adult');
    expect(calls[1].input.story.setting).toEqual([{ name: 'Low Water', details: 'A cold river town with one chain ferry.' }]);
    expect(pack.looks.map(look => look.characterId)).toEqual(['cast-1', 'cast-2']);
    expect(pack.looks.every(look => look.traits.map(item => item.field).join() === LOOK_FIELDS.join())).toBe(true);
    expect(validateLookPack(JSON.parse(JSON.stringify(pack)), draft())).toEqual(pack);
  });
  test('labels each trait by where it came from', async () => {
    const pack = await design(model().generate), [mira, bram] = pack.looks;
    expect(trait(mira, 'hair')).toMatchObject({ basis: 'story', why: '' });
    expect(trait(mira, 'outfit').basis).toBe('story');
    expect(trait(bram, 'build')).toMatchObject({ basis: 'implied', why: 'the chain work' });
    expect(trait(bram, 'hair')).toMatchObject({ basis: 'invented', clueIds: [], why: 'fits a river life' });
    expect(BASIS_LABELS[trait(bram, 'hair').basis]).toBe('Made up to fit');
    expect(mira.clues.find(clue => clue.id === trait(mira, 'hair').clueIds[0])!.text).toBe('Cropped white hair.');
  });
  test('drops clues that are later in the story or not in its words', async () => {
    const pack = await design(model().generate), [mira, bram] = pack.looks;
    // The sling comes later; the green eyes quote is not in the text at all.
    expect(mira.clues.map(clue => clue.about)).toEqual(['age', 'hair', 'outfit']);
    expect(bram.clues.map(clue => clue.about)).toEqual(['build', 'height']);
    expect(trait(bram, 'eyes').basis).toBe('invented');
    expect(pack.warnings).toContain('Character 1: 1 clue about later or unclear moments was left out of the starting look.');
    expect(pack.warnings.some(warning => warning.includes('could not be matched to the story’s own words') || warning.includes("could not be matched to the story's own words"))).toBe(true);
  });
  test('matches quotes despite curly quotes and line wrapping', async () => {
    const wrapped = source.replace('cropped white hair', 'cropped\nwhite hair').replace('Bram, her nephew', '“Bram,” her nephew');
    const pack = await design(model().generate, draft(), wrapped);
    expect(trait(pack.looks[0], 'hair').basis).toBe('story');
  });
  test('never raises a label above its evidence', async () => {
    const { generate } = model({ 'set-points-look-design-v1': input => ({ looks: input.characters.map((person: Brief) => {
      const look = designed(person);
      for (const item of look.traits) {
        if (item.field === 'skin') Object.assign(item, { basis: 'story', clueIds: ['clue-9-9-9'] });       // points at nothing we hold
        if (item.field === 'face') Object.assign(item, { basis: 'story', clueIds: [] });                    // claims the story, cites nothing
        if (item.field === 'build' && person.characterId === 'cast-2') Object.assign(item, { basis: 'story' }); // only an implied clue behind it
      }
      return look;
    }), warnings: [] }) });
    const [mira, bram] = (await design(generate)).looks;
    expect(trait(mira, 'skin')).toMatchObject({ basis: 'invented', clueIds: [] });
    expect(trait(mira, 'face')).toMatchObject({ basis: 'invented', clueIds: [] });
    expect(trait(bram, 'build').basis).toBe('implied');
  });
  test('keeps the story’s own words in view when a design ignores them', async () => {
    const { generate } = model({ 'set-points-look-design-v1': input => ({ looks: input.characters.map((person: Brief) => {
      const look = designed(person);
      for (const item of look.traits) if (item.field === 'hair') Object.assign(item, { value: 'Long black braid', basis: 'invented', clueIds: [] });
      return look;
    }), warnings: [] }) });
    const pack = await design(generate), mira = pack.looks[0];
    expect(trait(mira, 'hair')).toMatchObject({ value: 'Long black braid', basis: 'invented', check: ['Cropped white hair.'] });
    expect(trait(mira, 'age').check).toBeUndefined();
    expect(pack.warnings).toContain('Mira: the story describes a trait that this look does not point to. Compare the note shown under that trait before using the look.');
  });
  test('asks once more for a look that is missing a trait, then stops', async () => {
    let attempts = 0;
    const { generate } = model({ 'set-points-look-design-v1': input => { attempts++; return { looks: input.characters.map((person: Brief) => ({ ...designed(person), traits: designed(person).traits.slice(1) })), warnings: [] }; } });
    await expect(design(generate)).rejects.toThrow('exactly one "age" trait');
    expect(attempts).toBe(2);
  });
  test('rejects looks for the wrong people and unsafe text', async () => {
    const wrong = model({ 'set-points-look-design-v1': input => ({ looks: [designed(input.characters[0]), { ...designed(input.characters[0]) }], warnings: [] }) });
    await expect(design(wrong.generate)).rejects.toThrow('each requested character exactly once');
    const unsafe = model({ 'set-points-look-design-v1': input => ({ looks: input.characters.map((person: Brief) => { const look = designed(person); look.traits[0].value = '{{setvar::x::1}}'; return look; }), warnings: [] }) });
    await expect(design(unsafe.generate)).rejects.toThrow('reserved template');
  });
  test('designs a large cast in groups that know about each other', async () => {
    const names = Array.from({ length: LOOK_LIMITS.batch + 3 }, (_, index) => `Person ${index + 1}`), { generate, calls } = model({ 'set-points-look-clues-v1': () => ({ characters: [], warnings: [] }) });
    const pack = await design(generate, draft(names));
    const designs = calls.filter(call => call.input.task === 'set-points-look-design-v1');
    expect(designs.map(call => call.input.characters.length)).toEqual([LOOK_LIMITS.batch, 3]);
    expect(designs[0].input.alreadyDesigned).toEqual([]);
    expect(designs[1].input.alreadyDesigned).toHaveLength(LOOK_LIMITS.batch);
    expect(designs[1].input.alreadyDesigned[0]).toEqual({ name: 'Person 1', look: expect.stringContaining('hair: hair a') });
    expect(pack.looks).toHaveLength(names.length);
  });
  test('returns nothing to design for an empty cast and honors cancellation', async () => {
    const { generate, calls } = model();
    expect((await design(generate, draft([]))).looks).toEqual([]);
    expect(calls).toHaveLength(0);
    const stop = new AbortController(); stop.abort();
    await expect(designLooks({ draft: draft(), sourceText: source }, generate, () => {}, stop.signal)).rejects.toThrow('cancelled');
    expect(calls).toHaveLength(0);
  });
});

describe('rerolling one look', () => {
  test('uses one request, keeps the story notes, and remembers what was turned down', async () => {
    const { generate, calls } = model(), first = await design(generate);
    const second = await rerollLook({ draft: draft(), pack: first, characterId: 'cast-2', note: 'older, keep the height' }, generate, () => {});
    expect(calls).toHaveLength(3);
    const request = calls[2].input;
    expect(request).toMatchObject({ task: 'set-points-look-reroll-v1', change: 'older, keep the height', attempt: 1 });
    expect(request.rejected).toHaveLength(1);
    expect(request.rejected[0]).toContain('hair: hair a');
    expect(request.others).toEqual([{ name: 'Mira', look: expect.stringContaining('hair: hair from clue') }]);
    expect(calls[2].system).toContain('clearly different from every look in "rejected"');
    const [mira, bram] = second.looks;
    expect(mira).toEqual(first.looks[0]);
    expect(bram.rerolls).toBe(1);
    expect(bram.clues).toEqual(first.looks[1].clues);
    expect(trait(bram, 'hair').value).toBe('hair b1');
    expect(trait(bram, 'build').basis).toBe('implied');
    // A third look is told about both earlier ones, so each request is new work.
    const third = await rerollLook({ draft: draft(), pack: second, characterId: 'cast-2' }, generate, () => {});
    expect(calls[3].input.rejected).toHaveLength(2);
    expect(calls[3].input.attempt).toBe(2);
    expect(third.looks[1].rerolls).toBe(2);
  });
  test('drops a stale note about the old look and refuses unknown characters', async () => {
    const { generate } = model({ 'set-points-look-design-v1': input => ({ looks: input.characters.map((person: Brief) => {
      const look = designed(person);
      for (const item of look.traits) if (item.field === 'hair' && person.characterId === 'cast-1') Object.assign(item, { basis: 'invented', clueIds: [] });
      return look;
    }), warnings: [] }) });
    const first = await design(generate);
    expect(first.warnings.some(warning => warning.startsWith('Mira: the story describes'))).toBe(true);
    const second = await rerollLook({ draft: draft(), pack: first, characterId: 'cast-1' }, generate, () => {});
    expect(second.warnings.some(warning => warning.startsWith('Mira: the story describes'))).toBe(false);
    await expect(rerollLook({ draft: draft(), pack: first, characterId: 'nobody' }, generate, () => {})).rejects.toThrow('Choose a character');
    await expect(rerollLook({ draft: draft(), pack: first, characterId: 'cast-1', note: 'x'.repeat(LOOK_LIMITS.note + 1) }, generate, () => {})).rejects.toThrow();
  });
});

describe('using a look in the story', () => {
  test('writes short labeled facts with the outfit kept apart', async () => {
    const pack = await design(model().generate), mira = pack.looks[0];
    expect(lookAppearance(mira)).toBe('Age: age from clue\nHeight: height a\nBuild: build a\nSkin: skin a\nHair: hair from clue\nEyes: eyes a\nFace: face a\nMarks: marks a');
    expect(lookOutfit(mira)).toBe('outfit from clue');
    expect(lookAppearance(mira)).not.toContain('outfit');
    expect(approvedFromLook(mira)).toEqual({ characterId: 'cast-1', description: lookAppearance(mira), startingOutfit: 'outfit from clue' });
  });
  test('replaces a character’s approved text in place and notices hand edits', async () => {
    const pack = await design(model().generate), story = draft();
    story.appearances = [{ characterId: 'cast-1', description: 'Typed by hand.', startingOutfit: '' }];
    expect(lookInUse(story, pack.looks[0])).toBe(false);
    useLooks(story, pack.looks);
    expect(story.appearances).toHaveLength(2);
    expect(story.appearances!.map(item => item.characterId)).toEqual(['cast-1', 'cast-2']);
    expect(pack.looks.every(look => lookInUse(story, look))).toBe(true);
    story.appearances![0].description += '\nMarks: a new tattoo';
    expect(lookInUse(story, pack.looks[0])).toBe(false);
    // A look for someone no longer in the cast is ignored.
    const smaller = { ...draft(['Mira']), appearances: [] as NonNullable<StoryDraft['appearances']> };
    useLooks(smaller, pack.looks);
    expect(smaller.appearances.map(item => item.characterId)).toEqual(['cast-1']);
  });
});

describe('saved looks', () => {
  const valid = async (): Promise<LookPack> => design(model().generate);
  test('must cover the draft’s cast exactly', async () => {
    const pack = await valid();
    expect(() => validateLookPack({ ...pack, draftId: 'another' }, draft())).toThrow('another draft');
    expect(() => validateLookPack({ ...pack, looks: pack.looks.slice(0, 1) }, draft())).toThrow('every cast member');
    expect(() => validateLookPack({ ...pack, looks: [pack.looks[0], pack.looks[0]] }, draft())).toThrow('one cast member, once');
    expect(() => validateLookPack({ ...pack, version: 2 })).toThrow('unsupported version');
    expect(validateLookPack(pack)).toEqual(pack);
  });
  test('rejects labels that claim more than the saved notes support', async () => {
    const pack = await valid(), tamper = (change: (look: CharacterLook) => void) => { const copy = structuredClone(pack); change(copy.looks[1]); return copy; };
    expect(() => validateLookPack(tamper(look => { trait(look, 'hair').basis = 'story'; }))).toThrow('without a stated story note');
    expect(() => validateLookPack(tamper(look => { trait(look, 'build').basis = 'story'; }))).toThrow('without a stated story note');
    expect(() => validateLookPack(tamper(look => { trait(look, 'hair').clueIds = ['clue-1-2-1']; }))).toThrow('made up but points to story notes');
    expect(() => validateLookPack(tamper(look => { trait(look, 'build').clueIds = ['missing']; }))).toThrow('not saved with this look');
    expect(() => validateLookPack(tamper(look => { look.traits.pop(); }))).toThrow('each trait exactly once');
    expect(() => validateLookPack(tamper(look => { trait(look, 'eyes').value = '<b>green</b>'; }))).toThrow('HTML');
  });
});
