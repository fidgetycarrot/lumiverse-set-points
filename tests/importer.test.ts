import { describe, expect, test } from 'bun:test';
import { adaptStory, cardPayload, IMPORT_LIMITS, splitSource, validateDraft, type Generate, type GenerationMessage } from '../src/importer';
import { EXTENSION_ID, type ImportOptions, type StoryDraft } from '../src/types';

const options = (overrides: Partial<ImportOptions> = {}): ImportOptions => ({ text: 'Mara arrives at the harbor to seek her brother. Iona offers directions to a lighthouse.', sourceTitle: 'The Lighthouse Letter', playerRole: 'Mara', startingPoint: 'At the harbor', sceneCount: 2, connectionId: 'test', chunkSize: 12_000, ...overrides });
const ledger = (coveredChunks = ['chunk:1']) => ({
  coveredChunks,
  premise: 'Mara seeks her missing brother near the lighthouse.',
  cast: [{ name: 'Mara', aliases: ['Mapmaker'], personality: 'Cautious and curious.', voice: 'Dry humor.', relationships: 'Elias is her brother.', knowledgeAtIntroduction: 'Elias is missing.', developments: 'She may learn he left willingly.', sourceRefs: coveredChunks }],
  setting: [{ name: 'Greyhaven', details: 'A coastal village.', sourceRefs: coveredChunks }],
  events: [{ title: 'The harbor', summary: 'Iona points toward the lighthouse.', participants: ['Mara', 'Iona'], changes: 'Mara receives a lead.', sourceRefs: coveredChunks }],
  warnings: [],
});
const draft = (overrides: Partial<StoryDraft> = {}): StoryDraft => ({
  version: 1, id: 'test-draft', title: 'The Lighthouse Letter', premise: 'Find Elias before the storm arrives.', playerRole: 'Mara', startingPoint: 'At the harbor',
  narratorInstructions: 'Play the narrator and supporting cast. Leave the player’s decisions open.',
  cast: [{ id: 'mara', name: 'Mara', aliases: [], personality: 'Cautious and curious.', voice: 'Dry humor.', relationships: 'Elias is her brother.', knowledge: 'Elias is missing.', sourceRefs: ['chunk:1'] }],
  lore: [{ id: 'harbor', name: 'Greyhaven', keys: ['Greyhaven'], content: 'A coastal village with an old lighthouse.' }],
  scenes: [
    { id: 'harbor', title: 'The harbor', greeting: 'Iona studies {{user}}. “Looking for someone?”', direction: 'Iona can suggest checking the lighthouse.', assumptions: [], sourceRefs: ['chunk:1'] },
    { id: 'chart-room', title: 'The chart room', greeting: 'A sealed letter rests on the desk. The door creaks in the wind.', direction: 'If opened, the letter reveals that Elias left willingly.', assumptions: ['The player chooses to visit the chart room.'], sourceRefs: ['chunk:1'] },
  ], warnings: [], source: { title: 'The Lighthouse Letter', characters: 200, chunks: 1 }, createdAt: 1,
  ...overrides,
});
const response = (value: unknown, finish_reason?: string) => ({ content: JSON.stringify(value), finish_reason });

describe('source boundaries', () => {
  test('preserves every character and avoids cutting surrogate pairs', () => {
    const source = `${'a'.repeat(3999)}🦊${'b'.repeat(3500)}\n${'word '.repeat(1700)}`;
    const pieces = splitSource(source, 4000);
    expect(pieces.join('')).toBe(source);
    expect(pieces.every(piece => piece.length <= 4000)).toBe(true);
    expect(pieces.some(piece => /[\ud800-\udbff]$/.test(piece))).toBe(false);
  });
  test('rejects empty, oversized, and over-chunked sources without truncation', () => {
    expect(() => splitSource('   ')).toThrow('Paste a story');
    expect(() => splitSource('a'.repeat(IMPORT_LIMITS.sourceCharacters + 1))).toThrow('500,000');
    expect(() => splitSource('a'.repeat(200_000), 4000)).toThrow('Nothing was truncated');
    expect(() => splitSource('story', 300)).toThrow('chunkSize');
  });
});

describe('draft validation and persistence', () => {
  test('accepts a valid edited draft and returns a defensive copy', () => {
    const original = draft(), checked = validateDraft(original);
    checked.scenes[0].greeting = 'Changed';
    expect(original.scenes[0].greeting).not.toBe('Changed');
  });
  test('detects missing fields, duplicate IDs, impossible references, and empty openings', () => {
    const missing = draft() as unknown as Record<string, unknown>;
    delete missing.cast;
    expect(() => validateDraft(missing)).toThrow('cast');
    const duplicate = draft(); duplicate.scenes[1].id = duplicate.scenes[0].id;
    expect(() => validateDraft(duplicate)).toThrow('duplicate IDs');
    const badRef = draft(); badRef.scenes[1].sourceRefs = ['chunk:99'];
    expect(() => validateDraft(badRef)).toThrow('unknown source chunk');
    const empty = draft(); empty.scenes[0].greeting = '';
    expect(() => validateDraft(empty)).toThrow('greeting is required');
  });
  test('rejects active templates, HTML code, reserved signals, and non-web source URLs', () => {
    for (const value of ['{{setvar::x::yes}}', '<% return process.env %>', '[[SET_POINTS:0123456789abcdef0123456789abcdef]]', '<!--SET_POINTS:0123456789abcdef0123456789abcdef-->', '<script>alert(1)</script>', '<img src=x onerror="alert(1)">', '<img src=x onerror=alert(1)>', '[run](javascript:alert(1))']) {
      const bad = draft(); bad.scenes[0].greeting = value;
      expect(() => validateDraft(bad)).toThrow();
    }
    expect(() => validateDraft(draft({ source: { title: 'Story', characters: 1, chunks: 1, url: 'file:///private/story' } }))).toThrow('HTTP');
    expect(() => validateDraft(draft({ source: { title: 'Story', characters: 1, chunks: 1, url: 'https://name:password@example.com/story' } }))).toThrow('credentials');
    const safe = draft(); safe.scenes[0].greeting = '{{char}} waits for {{user}}.';
    expect(validateDraft(safe).scenes[0].greeting).toContain('{{user}}');
  });
  test('card export maps the opening and later scenes without leaking directions into starting fields', () => {
    const source = draft(), card = cardPayload(source);
    expect(card.first_mes).toBe(source.scenes[0].greeting);
    expect(card.alternate_greetings).toEqual([source.scenes[1].greeting]);
    expect(card.description).toContain('Elias is her brother');
    expect(card.description).not.toContain('left willingly');
    expect(card.scenario).not.toContain('left willingly');
    expect(card.extensions[EXTENSION_ID].scenes[1].direction).toContain('left willingly');
    expect(card.system_prompt).toContain('human alone decides');
  });
});

describe('adaptation pipeline', () => {
  test('extracts every source section, merges references, then adapts with agency and starting-state rules', async () => {
    const source = `${'harbor '.repeat(650)}${'lighthouse '.repeat(500)}`;
    const chunks = splitSource(source, 4000), seenSource: string[] = [], calls: GenerationMessage[][] = [], progress: Array<[number, number, string]> = [];
    const generate: Generate = async messages => {
      calls.push(messages);
      const user = messages[1].content;
      if (user.startsWith('SOURCE CHUNK')) {
        const input = JSON.parse(user.slice(user.indexOf('\n') + 1));
        seenSource.push(input.text);
        return response(ledger([input.reference]));
      }
      const input = JSON.parse(user);
      if (input.ledgers) return response(ledger(input.ledgers.flatMap((item: { coveredChunks: string[] }) => item.coveredChunks)));
      return response(draft({ scenes: draft().scenes.map(scene => ({ ...scene, sourceRefs: [`chunk:${chunks.length}`] })) }));
    };
    const result = await adaptStory(options({ text: source, chunkSize: 4000 }), generate, (...update) => progress.push(update));
    expect(seenSource.join('')).toBe(source);
    expect(calls.length).toBe(chunks.length + Math.ceil(chunks.length / 3) + 1);
    expect(result.source).toMatchObject({ characters: source.length, chunks: chunks.length });
    expect(result.scenes[0].sourceRefs).toEqual([`chunk:${chunks.length}`]);
    expect(calls.at(-1)![0].content).toContain('Never write these for the human');
    expect(calls.at(-1)![0].content).toContain('Keep future revelations');
    expect(calls.at(-1)![0].content).toContain('relationship context');
    expect(result.warnings.some(warning => warning.includes('condensed story ledger'))).toBe(true);
    expect(progress.at(-1)?.[0]).toBe(progress.at(-1)?.[1]);
  });
  test('uses hierarchical merges instead of one unbounded final prompt', async () => {
    const source = 'x'.repeat(28_000), mergedGroupSizes: number[] = [];
    const generate: Generate = async messages => {
      const user = messages[1].content;
      if (user.startsWith('SOURCE CHUNK')) {
        const input = JSON.parse(user.slice(user.indexOf('\n') + 1));
        return response(ledger([input.reference]));
      }
      const input = JSON.parse(user);
      if (input.ledgers) {
        mergedGroupSizes.push(input.ledgers.length);
        return response(ledger(input.ledgers.flatMap((item: { coveredChunks: string[] }) => item.coveredChunks)));
      }
      expect(input.ledger.coveredChunks).toHaveLength(7);
      return response(draft());
    };
    await adaptStory(options({ text: source, chunkSize: 4000 }), generate, () => {});
    expect(mergedGroupSizes).toEqual([3, 3, 1, 3]);
  });
  test('accepts fenced JSON and repairs malformed output only once', async () => {
    let calls = 0;
    const generated = await adaptStory(options(), async messages => {
      calls++;
      if (calls === 1) return { content: '{bad json}' };
      if (calls === 2) {
        expect(messages.at(-1)?.content).toContain('required JSON schema');
        return { content: `\`\`\`json\n${JSON.stringify(ledger())}\n\`\`\`` };
      }
      return response(draft());
    }, () => {});
    expect(generated.title).toBe('The Lighthouse Letter');
    expect(calls).toBe(3);
    let badCalls = 0;
    await expect(adaptStory(options(), async () => { badCalls++; return { content: '{bad}' }; }, () => {})).rejects.toThrow('invalid JSON');
    expect(badCalls).toBe(2);
  });
  test('detects refusals and truncation without saving partial content or repair retries', async () => {
    for (const modelResponse of [
      response({ refusal: 'Unable to comply.' }),
      { content: 'I cannot assist with this request.' },
      response(ledger(), 'length'),
      { content: '', finish_reason: 'content_filter' },
      { content: '' },
    ]) {
      let calls = 0;
      await expect(adaptStory(options(), async () => { calls++; return modelResponse; }, () => {})).rejects.toThrow();
      expect(calls).toBe(1);
    }
  });
  test('does not silently accept a merge that forgets a source section', async () => {
    let mergeCalls = 0;
    await expect(adaptStory(options({ text: 'x'.repeat(8000), chunkSize: 4000 }), async messages => {
      if (messages[1].content.startsWith('SOURCE CHUNK')) {
        const input = JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));
        return response(ledger([input.reference]));
      }
      mergeCalls++;
      return response(ledger(['chunk:1']));
    }, () => {})).rejects.toThrow('every source chunk');
    expect(mergeCalls).toBe(2);
  });
  test('preserves extraction warnings and explicitly flags a reduced scene count', async () => {
    let calls = 0;
    const result = await adaptStory(options({ sceneCount: 3 }), async () => {
      calls++;
      return response(calls === 1 ? { ...ledger(), warnings: ['The source gives conflicting arrival dates.'] } : draft());
    }, () => {});
    expect(result.warnings).toContain('The source gives conflicting arrival dates.');
    expect(result.warnings.some(item => item.includes('2 scenes of the 3 requested'))).toBe(true);
  });
  test('flags cast identities lost by adaptation rather than silently discarding their context', async () => {
    let calls = 0;
    const result = await adaptStory(options(), async () => response(++calls === 1 ? ledger() : draft({ cast: [] })), () => {});
    expect(result.warnings.some(item => item.includes('missing cast member: Mara'))).toBe(true);
  });
  test('cancels an in-flight model request even if the provider ignores the signal', async () => {
    const controller = new AbortController();
    let requested = false;
    const operation = adaptStory(options(), async () => { requested = true; return new Promise(() => {}); }, () => {}, controller.signal);
    expect(requested).toBe(true);
    controller.abort();
    await expect(operation).rejects.toMatchObject({ name: 'AbortError' });
  });
  test('checks cancellation and source limits before requesting the model', async () => {
    const controller = new AbortController(); controller.abort();
    let called = false;
    const generate: Generate = async () => { called = true; return response(ledger()); };
    await expect(adaptStory(options(), generate, () => {}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await expect(adaptStory(options({ text: 'x'.repeat(500_001) }), generate, () => {})).rejects.toThrow('500,000');
    expect(called).toBe(false);
  });
});
