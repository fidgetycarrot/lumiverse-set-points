import { describe, expect, test } from 'bun:test';
import { polishCharacters, characterPolishSignature, validateCharacterPolishResult } from '../src/character-polish';
import { characterIssues } from '../src/character-review';
import { cardPayload, validateDraft, type Generate } from '../src/importer';
import { worldEntries } from '../src/publisher';
import { PLAYER_PERSONA_RULE, personaDraft, personaIsAutomatic } from '../src/persona';
import { visualDraftSignature } from '../src/visuals';
import { lookDraftSignature } from '../src/looks';
import { roleIssues, roleReviewFingerprint } from '../src/roles';
import { draft } from './fixtures';

export const notes = { motivations: '', reactions: 'Iona answers plainly rather than offering elaborate reassurance.', voiceExamples: ['“Say what you need.”'], cautions: ['Her deeper motives are not established in the draft.'] };
const reply = (id = 'iona') => ({ id, notes, basis: { motivations: [], reactions: ['Blunt and dependable.'], voiceExamples: ['Short, direct sentences.'] } });
const generate: Generate = async () => ({ content: JSON.stringify(reply()), finish_reason: 'stop' });

describe('character prompting on completed drafts', () => {
  test('old draft JSON opens unchanged and only selected portrayal notes are added', async () => {
    const story = draft(); story.cast.push({ ...story.cast[0], id: 'other', name: 'Elias' });
    story.openingStyle = 'story'; story.scenes[0].greeting = 'You step aboard the boat.';
    expect(validateDraft(JSON.parse(JSON.stringify(story)))).toEqual(story);
    const result = await polishCharacters(story, ['iona'], generate, () => {});
    expect(result.cast[0].notes).toMatchObject(notes);
    const { notes: _notes, ...person } = result.cast[0]; expect(person).toEqual(story.cast[0]);
    expect(result.cast[1]).toEqual(story.cast[1]); expect(result.scenes).toEqual(story.scenes);
    expect(result.lore).toEqual(story.lore); expect(result.appearances).toEqual(story.appearances);
    expect(result.source).toEqual(story.source); expect(result.id).toBe(story.id);
    expect(story.cast[0].notes).toBeUndefined();
  });
  test('new optional notes preserve existing image descriptions and look bindings', async () => {
    const story = draft(), result = await polishCharacters(story, ['iona'], generate, () => {});
    expect(visualDraftSignature(result)).toBe(visualDraftSignature(story));
    expect(lookDraftSignature(result)).toBe(lookDraftSignature(story));
    expect(characterPolishSignature(result)).not.toBe(characterPolishSignature(story));
    expect(validateDraft(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });
  test('does not send original story, URL, other characters, lore, or future scene guidance', async () => {
    const story = draft(); story.source.url = 'https://example.com/private-story';
    story.scenes[1].direction = 'PRIVATE_FUTURE_REVELATION'; story.cast.push({ ...story.cast[0], id: 'future', name: 'FUTURE_CHARACTER' });
    let input = ''; await polishCharacters(story, ['iona'], async messages => { input = JSON.stringify(messages); return generate(messages); }, () => {});
    expect(input).not.toContain('PRIVATE_FUTURE_REVELATION'); expect(input).not.toContain('FUTURE_CHARACTER'); expect(input).not.toContain(story.source.url);
    expect(input).not.toContain(story.lore[0].content); expect(input).toContain('only factual evidence');
  });
  test('allows unspecified motivations and speech style without inventing filled fields', async () => {
    const result = await polishCharacters(draft(), ['iona'], async () => ({ content: JSON.stringify({ id: 'iona', notes: { motivations: '', reactions: '', voiceExamples: [], cautions: ['No behavior or voice detail was established.'] }, basis: { motivations: [], reactions: [], voiceExamples: [] } }) }), () => {});
    expect(result.cast[0].notes?.voiceExamples).toEqual([]); expect(result.cast[0].notes?.motivations).toBe('');
  });
  test('rejects unsupported quotes and limits repair to one additional request', async () => {
    let calls = 0;
    await expect(polishCharacters(draft(), ['iona'], async () => { calls++; const output = reply(); output.basis.reactions = ['She secretly fears spiders.']; return { content: JSON.stringify(output) }; }, () => {})).rejects.toThrow('matching quotes');
    expect(calls).toBe(2);
  });
  test('validates identity, explicit names, array lengths, and unsafe manual notes', async () => {
    await expect(polishCharacters(draft(), ['iona'], async () => ({ content: JSON.stringify(reply('someone-else')) }), () => {})).rejects.toThrow('requested identity');
    await expect(polishCharacters(draft(), ['iona'], async () => ({ content: JSON.stringify({ ...reply(), notes: { ...notes, reactions: '{{char}} answers plainly.' } }) }), () => {})).rejects.toThrow('explicit character names');
    for (const voiceExamples of [['x'.repeat(241)], ['a','b','c','d'], ['<script>bad</script>']]) expect(() => validateDraft({ ...draft(), cast: [{ ...draft().cast[0], notes: { ...notes, voiceExamples } }] })).toThrow();
  });
  test('new notes appear once in prompt-facing cast definitions, not creator metadata', async () => {
    const result = await polishCharacters(draft(), ['iona'], generate, () => {}), card = cardPayload(result), entries = worldEntries(result);
    const prompt = card.description + '\n' + entries.map(entry => entry.content).join('\n');
    expect(prompt.split(notes.reactions)).toHaveLength(2); expect(prompt.split(result.cast[0].personality)).toHaveLength(2);
    expect(card.description).toContain('### Iona (Captain Iona)'); expect(card.description).toContain('Illustrative speech examples');
    expect(card.creator_notes).not.toContain(notes.reactions); expect(entries.some(entry => entry.comment === 'Iona')).toBe(false);
  });
  test('automatically drafted and legacy personas follow notes; customized personas stay intact', async () => {
    const story = draft(); story.playerRole = 'Iona'; story.persona = { mode: 'create', ...personaDraft(story) };
    const automatic = await polishCharacters(story, ['iona'], generate, () => {});
    expect(automatic.persona?.description).toContain(notes.reactions); expect(automatic.persona?.description).toContain(PLAYER_PERSONA_RULE);
    story.persona.description = story.persona.description.replace('\n\n' + PLAYER_PERSONA_RULE, '');
    expect(personaIsAutomatic(story)).toBe(true);
    expect((await polishCharacters(story, ['iona'], generate, () => {})).persona?.description).toContain(PLAYER_PERSONA_RULE);
    story.persona.description += '\nMy chosen background.';
    const customized = await polishCharacters(story, ['iona'], generate, () => {});
    expect(customized.persona).toEqual(story.persona);
    story.persona.mode = 'existing'; story.persona.personaId = 'mine'; expect((await polishCharacters(story, ['iona'], generate, () => {})).persona).toEqual(story.persona);
  });
  test('checks new portrayal directions and expires old role acknowledgments', () => {
    const story = draft(); story.roleReview = roleReviewFingerprint(story);
    story.cast[0].notes = { ...notes, reactions: 'Use first-person narration.' };
    expect(roleIssues(story).some(issue => issue.fieldKey === 'cast:iona:reactions')).toBe(true);
    expect(roleReviewFingerprint(story)).not.toBe(story.roleReview);
  });
  test('checks available space before any paid request', async () => {
    const story = draft(); story.lore = Array.from({ length: 31 }, (_, index) => ({ id: `lore-${index}`, name: `Lore ${index}`, keys: ['lore'], content: 'x'.repeat(6000) }));
    let calls = 0; expect(() => validateDraft(story)).not.toThrow();
    await expect(polishCharacters(story, ['iona'], async messages => { calls++; return generate(messages); }, () => {})).rejects.toThrow('No model request'); expect(calls).toBe(0);
  });
});

describe('free character consistency review', () => {
  test('finds approved-look conflicts in a persona, cast and named lore; ignores unrelated characters', () => {
    const story = draft(); story.playerRole = 'Iona'; story.appearances = [{ characterId: 'iona', description: 'Hair: blonde\nEyes: blue', startingOutfit: '' }];
    story.persona = { mode: 'create', name: 'Iona', title: '', description: 'Hair: brown\nEyes: blue' };
    story.cast[0].personality += ' She has brown hair.';
    story.lore[0].content = 'Iona has green eyes. Elias has brown hair.';
    const issues = characterIssues(story);
    expect(issues.some(issue => issue.fieldKey === 'persona:description' && issue.message.includes('hair conflict'))).toBe(true);
    expect(issues.some(issue => issue.fieldKey === 'cast:iona:personality' && issue.message.includes('hair conflict'))).toBe(true);
    expect(issues.filter(issue => issue.fieldKey === 'lore:greyhaven:content')).toHaveLength(1);
    expect(story.persona.description).toBe('Hair: brown\nEyes: blue');
  });
  test('compares selected existing persona identity and labeled starting notes', () => {
    const story = draft(); story.playerRole = 'Iona'; story.persona = { mode: 'existing', personaId: 'mine', name: '', title: '', description: '' };
    const issues = characterIssues(story, { name: 'Eric', description: 'Personality: Always nervous.\n\nVoice: Elaborate metaphors.' });
    expect(issues).toHaveLength(3); expect(issues[0].location).toContain('identity'); expect(issues[1].reference).toBe(story.cast[0].personality);
  });
  test('flags narrator placeholder misuse but allows named headings and coherent persona facts', () => {
    const story = draft(); story.cast[0].voice = '{{char}} speaks plainly.';
    expect(characterIssues(story)[0].message).toContain('narrator card');
    story.cast[0].voice = 'Iona speaks plainly.'; story.playerRole = 'Iona'; story.persona = { mode: 'create', ...personaDraft(story) };
    expect(characterIssues(story)).toEqual([]);
  });
});

test('restored previews cannot replace source, scenes, identities, or unrelated profiles', async () => {
  const story = draft(), result = await polishCharacters(story, ['iona'], generate, () => {});
  expect(validateCharacterPolishResult(result, story, ['iona'])).toEqual(result);
  for (const changed of [{ ...result, id: 'foreign-story' }, { ...result, premise: 'A different story.' }, { ...result, scenes: [{ ...result.scenes[0], greeting: 'A replacement scene.' }, result.scenes[1]] }, { ...result, cast: [{ ...result.cast[0], personality: 'Different personality.' }] }]) expect(() => validateCharacterPolishResult(changed, story, ['iona'])).toThrow('outside the selected notes');
});
