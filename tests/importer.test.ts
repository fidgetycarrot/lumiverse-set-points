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
  warnings: [] as string[],
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
const verboseLedger = (refs = ['chunk:1'], events = 12) => ({ ...ledger(refs), events: Array.from({length:events}, (_,i) => ({ ...ledger(refs).events[0], title:`Harbor event ${i + 1}`, summary:'A repeated description of the harbor and the incoming storm. '.repeat(40).trim() })) });
const shortenLedger = (value: ReturnType<typeof verboseLedger>) => ({ ...value, events:value.events.map(event => ({...event,summary:'Iona offers a clue at the harbor.'})) });

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

  test('accepts an oversized valid ledger without another paid shortening call or lost facts', async () => {
    const original = { ...verboseLedger(), warnings:['The arrival dates conflict.'] };
    expect(JSON.stringify(original).length).toBeGreaterThan(IMPORT_LIMITS.ledgerCharacters);
    const seen:GenerationMessage[][]=[],progress:Array<[number,number,string]>=[];
    const result = await adaptStory(options(), async messages => {
      seen.push(messages);
      if (messages[1].content.startsWith('SOURCE CHUNK')) return response(original);
      const input=JSON.parse(messages[1].content);
      expect(input.task).toBeUndefined();
      expect(input.ledger).toEqual(original);
      return response(draft());
    }, (...entry)=>progress.push(entry));
    expect(seen).toHaveLength(2);
    expect(result.warnings).toContain(original.warnings[0]);
    expect(progress.at(-1)?.slice(0,2)).toEqual([2,2]);
  });

  test('restores all merge warnings even when they push the ledger above the old target', async () => {
    const savedWarnings=[`First section: ${'uncertain chronology. '.repeat(60)}`,`Second section: ${'uncertain motives. '.repeat(60)}`].map(value=>value.trim());
    let mergeCalls=0;
    const result=await adaptStory(options({text:'x'.repeat(8000),chunkSize:4000}),async messages=>{
      if(messages[1].content.startsWith('SOURCE CHUNK')){
        const input=JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));
        const index=Number(input.reference.split(':')[1])-1;
        return response({...ledger([input.reference]),warnings:[savedWarnings[index]]});
      }
      const input=JSON.parse(messages[1].content);
      expect(input.task).toBeUndefined();
      if(input.ledgers){
        mergeCalls++;
        const merged=verboseLedger(['chunk:1','chunk:2'],9);
        expect(JSON.stringify(merged).length).toBeLessThan(IMPORT_LIMITS.ledgerCharacters);
        expect(JSON.stringify({...merged,warnings:savedWarnings}).length).toBeGreaterThan(IMPORT_LIMITS.ledgerCharacters);
        return response(merged);
      }
      expect(input.ledger.warnings).toEqual(savedWarnings);
      return response(draft());
    },()=>{});
    expect(mergeCalls).toBe(1);
    for(const warning of savedWarnings)expect(result.warnings).toContain(warning);
  });

  test('reuses valid saved shortening with byte-identical 0.1.3 extraction, shortening, and final prompts', async () => {
    const original=verboseLedger();let calls=0,peeks=0;
    const hash=(messages:GenerationMessage[])=>new Bun.CryptoHasher('sha256').update(JSON.stringify(messages)).digest('hex');
    const generate:Generate=async messages=>{
      calls++;
      if(messages[1].content.startsWith('SOURCE CHUNK')){
        expect(hash(messages)).toBe('8c3155f55f89e130f7e505abe529a1d0fb0cdba330f06946de8cfeb6cbb1c82b');
        return response(original);
      }
      expect(hash(messages)).toBe('15213314b9440503f884c0e674be4ff5da8e37a13b4a05a128e5babc33d2097b');
      expect(JSON.parse(messages[1].content).ledger).toEqual(shortenLedger(original));
      return response(draft());
    };
    generate.peek=async messages=>{
      peeks++;
      expect(hash(messages)).toBe('45786b2f65b9f678188e78e5131eb503c77ac9e8a0ec6a88dae43498f9596bcb');
      return response(shortenLedger(original));
    };
    await adaptStory(options(),generate,()=>{});
    expect(calls).toBe(2);expect(peeks).toBe(1);
  });

  test('retains byte-identical 0.1.3 merge prompts', async () => {
    await adaptStory(options({text:'x'.repeat(8000),chunkSize:4000}),async messages=>{
      if(messages[1].content.startsWith('SOURCE CHUNK')){
        const input=JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));
        return response(ledger([input.reference]));
      }
      const input=JSON.parse(messages[1].content);
      if(input.ledgers){
        expect(new Bun.CryptoHasher('sha256').update(JSON.stringify(messages)).digest('hex')).toBe('3c9879356e50c87272d718dedf1ce4ec6a14a4781505185a172ae2f4a54688c9');
        return response(ledger(['chunk:1','chunk:2']));
      }
      return response(draft());
    },()=>{});
  });

  test.each(['cast','relationships','references','events','chronology','settings','oversized','malformed','unsafe','absent'] as const)('falls back to the original when saved shortening is %s, with no paid repair', async field => {
    const original=verboseLedger();let calls=0,peeks=0;
    const generate:Generate=async messages=>{
      calls++;
      if(messages[1].content.startsWith('SOURCE CHUNK'))return response(original);
      expect(JSON.parse(messages[1].content).ledger).toEqual(original);
      return response(draft());
    };
    generate.peek=async()=>{
      peeks++;
      if(field==='absent')return undefined;
      if(field==='malformed')return {content:'{broken JSON'};
      if(field==='oversized')return response(original);
      const compact=shortenLedger(original);
      if(field==='cast')compact.cast=[];
      if(field==='relationships')compact.cast=[{...compact.cast[0],relationships:'Elias is an acquaintance.'}];
      if(field==='references')compact.events=[{...compact.events[0],sourceRefs:['chunk:99']},...compact.events.slice(1)];
      if(field==='events')compact.events=compact.events.slice(1);
      if(field==='chronology')compact.events=compact.events.reverse();
      if(field==='settings')compact.setting=[];
      if(field==='unsafe')compact.premise='{{setvar::secret::value}}';
      return response(compact);
    };
    await adaptStory(options(),generate,()=>{});
    expect(calls).toBe(2);expect(peeks).toBe(1);
  });

  test('a cached original and rejected shortening resume with only the final adaptation request', async () => {
    const original=verboseLedger();let paidCalls=0;
    const generate:Generate=async messages=>{
      if(messages[1].content.startsWith('SOURCE CHUNK'))return response(original); // Saved 0.1.3 response.
      paidCalls++;
      expect(JSON.parse(messages[1].content).ledger).toEqual(original);
      return response(draft());
    };
    generate.peek=async()=>response(original); // Saved rejected 0.1.3 shortening.
    await adaptStory(options(),generate,()=>{});
    expect(paidCalls).toBe(1);
  });

  test('preserves original warnings when reusing a saved shortening', async () => {
    const original={...verboseLedger(),warnings:['The source has conflicting dates.']};
    const generate:Generate=async messages=>{
      if(messages[1].content.startsWith('SOURCE CHUNK'))return response(original);
      expect(JSON.parse(messages[1].content).ledger.warnings).toEqual(original.warnings);
      return response(draft());
    };
    generate.peek=async()=>response({...shortenLedger(original),warnings:[]});
    expect((await adaptStory(options(),generate,()=>{})).warnings).toContain(original.warnings[0]);
  });

  test('accepts expanded descriptive fields and protected relationship text above the old target', async () => {
    for(const original of [
      {...ledger(),premise:'Detailed premise. '.repeat(400).trim()},
      {...ledger(),cast:Array.from({length:7},(_,i)=>({...ledger().cast[0],name:`Character ${i}`,relationships:'A relationship fact. '.repeat(175).trim()}))},
    ]){
      let calls=0;
      await adaptStory(options(),async messages=>{
        calls++;
        if(calls===1)return response(original);
        expect(JSON.parse(messages[1].content).ledger).toEqual(original);
        return response(draft());
      },()=>{});
      expect(calls).toBe(2);
    }
  });

  test('rejects hard-bound output and unsafe original markup before requesting more work', async () => {
    for(const original of [
      {...ledger(),premise:'x'.repeat(IMPORT_LIMITS.draftCharacters)},
      {...verboseLedger(),premise:'{{setvar::secret::value}}'},
    ]){
      let calls=0;
      await expect(adaptStory(options(),async()=>{calls++;return response(original);},()=>{})).rejects.toThrow();
      expect(calls).toBe(1);
    }
  });

  test('propagates storage failure and cancellation during cache-only recovery', async () => {
    let calls=0;
    const generate:Generate=async()=>{calls++;return response(verboseLedger());};
    generate.peek=async()=>{throw new Error('Checkpoint storage failed');};
    await expect(adaptStory(options(),generate,()=>{})).rejects.toThrow('Checkpoint storage failed');
    expect(calls).toBe(1);
    const controller=new AbortController();
    generate.peek=async()=>{controller.abort();return new Promise(()=>{});};
    await expect(adaptStory(options(),generate,()=>{},controller.signal)).rejects.toMatchObject({name:'AbortError'});
    expect(calls).toBe(2);
  });

  test('splits large three-way merges into bounded groups and still completes progress', async () => {
    const sizes:number[]=[],progress:Array<[number,number,string]>=[];
    await adaptStory(options({text:'x'.repeat(12000),chunkSize:4000}),async messages=>{
      expect(JSON.stringify(messages).length).toBeLessThanOrEqual(IMPORT_LIMITS.requestCharacters);
      if(messages[1].content.startsWith('SOURCE CHUNK')){
        const input=JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));
        return response({...ledger([input.reference]),premise:'A'.repeat(90000)});
      }
      const input=JSON.parse(messages[1].content);
      if(input.ledgers){
        sizes.push(input.ledgers.length);
        return response(ledger(input.ledgers.flatMap((item:{coveredChunks:string[]})=>item.coveredChunks)));
      }
      return response(draft());
    },(...entry)=>progress.push(entry));
    expect(sizes).toEqual([2,1,2]);
    expect(progress.at(-1)?.slice(0,2)).toEqual([7,7]);
  });

  test('stops locally when two complete ledgers cannot fit the request bound, with free cached resume', async () => {
    const cache=new Map<string,Awaited<ReturnType<Generate>>>();let paidCalls=0;
    const generate:Generate=async messages=>{
      expect(JSON.stringify(messages).length).toBeLessThanOrEqual(IMPORT_LIMITS.requestCharacters);
      const key=JSON.stringify(messages);if(cache.has(key))return structuredClone(cache.get(key)!);
      paidCalls++;
      expect(messages[1].content).toStartWith('SOURCE CHUNK');
      const input=JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));
      const result=response({...ledger([input.reference]),premise:'A'.repeat(130000)});
      cache.set(key,result);return result;
    };
    for(let attempt=0;attempt<2;attempt++){
      await expect(adaptStory(options({text:'x'.repeat(8000),chunkSize:4000}),generate,()=>{})).rejects.toMatchObject({code:'REQUEST_SIZE_LIMIT'});
    }
    expect(paidCalls).toBe(2);
  });

  test('preserves bounded final-format repair after accepting a large ledger', async () => {
    let calls=0;
    await adaptStory(options(),async messages=>{
      calls++;
      if(calls===1)return response(verboseLedger());
      if(calls===2)return {content:'{invalid JSON'};
      expect(messages.at(-1)?.content).toContain('required JSON schema');
      return response(draft());
    },()=>{});
    expect(calls).toBe(3);
  });

  test('does not dispatch a format repair when its serialized messages exceed the request bound', async () => {
    let calls=0;
    await expect(adaptStory(options(),async()=>{
      calls++;
      if(calls===1)return response({...ledger(),premise:'A'.repeat(130000)});
      return {content:`{${' '.repeat(130000)}invalid JSON`};
    },()=>{})).rejects.toMatchObject({code:'REQUEST_SIZE_LIMIT'});
    expect(calls).toBe(2);
  });

  test('retains cached stages when all merge warnings cannot fit the warning count limit', async () => {
    const cache=new Map<string,Awaited<ReturnType<Generate>>>();let paidCalls=0;
    const generate:Generate=async messages=>{
      const key=JSON.stringify(messages);if(cache.has(key))return structuredClone(cache.get(key)!);
      paidCalls++;let result;
      if(messages[1].content.startsWith('SOURCE CHUNK')){
        const input=JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));
        result=response({...ledger([input.reference]),warnings:Array.from({length:33},(_,i)=>`${input.reference} uncertain fact ${i + 1}.`)});
      }else{
        const input=JSON.parse(messages[1].content);
        expect(input.ledgers).toHaveLength(2);
        result=response(ledger(['chunk:1','chunk:2']));
      }
      cache.set(key,result);return result;
    };
    for(let attempt=0;attempt<2;attempt++){
      await expect(adaptStory(options({text:'x'.repeat(8000),chunkSize:4000}),generate,()=>{})).rejects.toMatchObject({code:'COMPACTION_IMPOSSIBLE'});
    }
    expect(paidCalls).toBe(3);
  });
});
