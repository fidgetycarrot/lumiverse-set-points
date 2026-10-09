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

function stagedReply(messages: GenerationMessage[], sample = draft()) {
  const input = JSON.parse(messages[1].content);
  if (input.task === 'set-points-plan-v1') return response({ title: sample.title, premise: sample.premise, narratorInstructions: sample.narratorInstructions, startingLore: input.ledger.setting.map((_: unknown, index: number) => index), scenes: sample.scenes.slice(0, input.preferences.requestedScenes).map((scene, i) => ({ title: scene.title, eventIndexes: [Math.min(i, input.ledger.events.length - 1)], brief: scene.direction, assumptions: scene.assumptions })), warnings: sample.warnings });
  if (input.task === 'set-points-cast-v1') return response({ cast: input.characters.map((person: {id:string;name:string}) => ({ ...sample.cast.find(item => item.name === person.name) ?? draft().cast[0], id: person.id })), warnings: [] });
  if (input.task === 'set-points-lore-v1') return response({ lore: input.entries.map((entry: {id:string}) => ({ ...sample.lore[0] ?? draft().lore[0], id: entry.id })), warnings: [] });
  if (input.task === 'set-points-scenes-v1') return response({ scenes: input.scenes.map((scene: {id:string;assumptions:string[]}, i:number) => ({ ...sample.scenes[Number(scene.id.split('-')[1]) - 1] ?? sample.scenes[i % sample.scenes.length], id: scene.id, assumptions: scene.assumptions })), warnings: [] });
  throw new Error(`Unexpected staged request ${input.task}`);
}

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
      return stagedReply(messages);
    };
    const result = await adaptStory(options({ text: source, chunkSize: 4000 }), generate, (...update) => progress.push(update));
    expect(seenSource.join('')).toBe(source);
    expect(calls.length).toBe(chunks.length + Math.ceil(chunks.length / 3) + 4);
    expect(result.source).toMatchObject({ characters: source.length, chunks: chunks.length });
    expect(result.scenes[0].sourceRefs).toEqual(chunks.map((_,i)=>`chunk:${i + 1}`));
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
      return stagedReply(messages);
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
      return stagedReply(messages);
    }, () => {});
    expect(generated.title).toBe('The Lighthouse Letter');
    expect(calls).toBe(6);
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
    const result = await adaptStory(options({ sceneCount: 3 }), async messages => {
      calls++;
      return calls === 1 ? response({ ...ledger(), warnings: ['The source gives conflicting arrival dates.'] }) : stagedReply(messages);
    }, () => {});
    expect(result.warnings).toContain('The source gives conflicting arrival dates.');
    expect(result.warnings.some(item => item.includes('2 scenes of the 3 requested'))).toBe(true);
  });
  test('flags cast identities lost by adaptation rather than silently discarding their context', async () => {
    const generate:Generate = async () => response(ledger());
    generate.peek = async () => response(draft({cast:[]}));
    const result = await adaptStory(options(), generate, () => {});
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

  test('keeps oversized ledgers intact while replacing one large final request with small stages', async () => {
    const original={...verboseLedger(),warnings:['The arrival dates conflict.']};
    const tasks:string[]=[],progress:Array<[number,number,string]>=[];
    const result=await adaptStory(options(),async messages=>{
      if(messages[1].content.startsWith('SOURCE CHUNK'))return response(original);
      const input=JSON.parse(messages[1].content);tasks.push(input.task);
      expect(input.ledger).toEqual(original);
      expect(input.task).not.toBe('compact-existing-ledger');
      return stagedReply(messages);
    },(...entry)=>progress.push(entry));
    expect(tasks).toEqual(['set-points-plan-v1','set-points-cast-v1','set-points-lore-v1','set-points-scenes-v1']);
    expect(result.warnings).toContain(original.warnings[0]);
    expect(progress.at(-1)?.slice(0,2)).toEqual([5,5]);
  });

  test('restores merge warnings above the old ledger target without another shortening request', async () => {
    const warnings=[`First: ${'Uncertain date. '.repeat(90)}`,`Second: ${'Uncertain motive. '.repeat(80)}`].map(item=>item.trim());
    const result=await adaptStory(options({text:'x'.repeat(8000),chunkSize:4000}),async messages=>{
      if(messages[1].content.startsWith('SOURCE CHUNK')){
        const input=JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));
        return response({...ledger([input.reference]),warnings:[warnings[Number(input.reference.split(':')[1])-1]]});
      }
      const input=JSON.parse(messages[1].content);
      if(input.ledgers)return response(verboseLedger(['chunk:1','chunk:2'],9));
      expect(input.ledger.warnings).toEqual(warnings);
      return stagedReply(messages);
    },()=>{});
    for(const warning of warnings)expect(result.warnings).toContain(warning);
  });

  test('reuses complete legacy output with exact0.1.3 extraction, shortening, and final hashes', async () => {
    let calls=0,peeks=0;
    const hash=(messages:GenerationMessage[])=>new Bun.CryptoHasher('sha256').update(JSON.stringify(messages)).digest('hex');
    const generate:Generate=async messages=>{
      calls++;
      expect(hash(messages)).toBe('8c3155f55f89e130f7e505abe529a1d0fb0cdba330f06946de8cfeb6cbb1c82b');
      return response(verboseLedger());
    };
    generate.peek=async(messages,_signal,settings)=>{
      peeks++;
      const input=JSON.parse(messages[1].content);
      if(input.task==='compact-existing-ledger'){
        expect(hash(messages)).toBe('45786b2f65b9f678188e78e5131eb503c77ac9e8a0ec6a88dae43498f9596bcb');
        return response(shortenLedger(input.ledger));
      }
      expect(settings?.requireSettled).toBe(true);
      expect(hash(messages)).toBe('15213314b9440503f884c0e674be4ff5da8e37a13b4a05a128e5babc33d2097b');
      return response(draft());
    };
    expect((await adaptStory(options(),generate,()=>{})).scenes[0].id).toBe('harbor');
    expect(calls).toBe(1);expect(peeks).toBe(2);
  });

  test('retains byte-identical0.1.3 merge requests', async () => {
    await adaptStory(options({text:'x'.repeat(8000),chunkSize:4000}),async messages=>{
      if(messages[1].content.startsWith('SOURCE CHUNK')){
        const input=JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));return response(ledger([input.reference]));
      }
      if(JSON.parse(messages[1].content).ledgers){
        expect(new Bun.CryptoHasher('sha256').update(JSON.stringify(messages)).digest('hex')).toBe('3c9879356e50c87272d718dedf1ce4ec6a14a4781505185a172ae2f4a54688c9');
        return response(ledger(['chunk:1','chunk:2']));
      }
      return stagedReply(messages);
    },()=>{});
  });

  test('reuses a successful cached legacy schema repair without paying for either legacy request', async () => {
    let paid=0,peeks=0;
    const generate:Generate=async()=>{paid++;return response(ledger());};
    generate.peek=async(messages,_signal,settings)=>{
      expect(settings?.requireSettled).toBe(true);
      if(++peeks===1)return {content:'{broken JSON'};
      expect(messages.at(-2)).toEqual({role:'assistant',content:'{broken JSON'});
      expect(messages.at(-1)?.content).toBe('Your output did not match the required JSON schema: The model returned invalid JSON. Try another connection or a shorter source. Return the complete corrected JSON object. Do not omit source material to fix formatting.');
      return response(draft());
    };
    await adaptStory(options(),generate,()=>{});
    expect(paid).toBe(1);expect(peeks).toBe(2);
  });

  test.each(['cast','relationships','references','events','chronology','settings','oversized','malformed','unsafe','absent'] as const)('keeps the complete original when old saved shortening has invalid %s', async field=>{
    const original=verboseLedger();let calls=0,shorteningPeeks=0;
    const generate:Generate=async messages=>{
      calls++;if(messages[1].content.startsWith('SOURCE CHUNK'))return response(original);
      expect(JSON.parse(messages[1].content).ledger).toEqual(original);
      return stagedReply(messages);
    };
    generate.peek=async messages=>{
      if(JSON.parse(messages[1].content).task!=='compact-existing-ledger')return undefined;
      shorteningPeeks++;
      if(field==='absent')return undefined;
      if(field==='malformed')return {content:'{broken JSON'};
      if(field==='oversized')return response(original);
      const compact=structuredClone(shortenLedger(original));
      if(field==='cast')compact.cast=[];
      if(field==='relationships')compact.cast[0].relationships='Elias is an acquaintance.';
      if(field==='references')compact.events[0].sourceRefs=['chunk:99'];
      if(field==='events')compact.events=compact.events.slice(1);
      if(field==='chronology')compact.events.reverse();
      if(field==='settings')compact.setting=[];
      if(field==='unsafe')compact.premise='{{setvar::secret::value}}';
      return response(compact);
    };
    await adaptStory(options(),generate,()=>{});
    expect(calls).toBe(5);expect(shorteningPeeks).toBe(1);
  });

  test('falls back from a complete legacy draft whose inherited warnings cannot fit', async () => {
    let calls=0,peeks=0;
    const generate:Generate=async messages=>{
      calls++;
      if(messages[1].content.startsWith('SOURCE CHUNK'))return response({...ledger(),warnings:['A source warning.']});
      return stagedReply(messages);
    };
    generate.peek=async()=>{peeks++;return response(draft({warnings:Array.from({length:96},(_,i)=>`Old warning ${i}.`)}));};
    const result=await adaptStory(options(),generate,()=>{});
    expect(result.warnings).toContain('A source warning.');
    expect(calls).toBe(5);expect(peeks).toBe(1);
  });

  test('blocks fresh staged work when the old final request has an uncertain outcome', async () => {
    let calls=0;
    const generate:Generate=async()=>{calls++;return response(ledger());};
    generate.peek=async(_messages,_signal,settings)=>{
      expect(settings?.requireSettled).toBe(true);
      throw Object.assign(new Error('Previous paid outcome is unknown'),{code:'UNCERTAIN_REQUEST'});
    };
    await expect(adaptStory(options(),generate,()=>{})).rejects.toMatchObject({code:'UNCERTAIN_REQUEST'});
    expect(calls).toBe(1);
  });

  test('bounds batches, retains every identity and planned scene, and keeps progress free of story names', async () => {
    const original={...ledger(),cast:Array.from({length:9},(_,i)=>({...ledger().cast[0],name:`Person ${i + 1}`})),setting:Array.from({length:9},(_,i)=>({...ledger().setting[0],name:`Location ${i + 1}`})),events:Array.from({length:5},(_,i)=>({...ledger().events[0],title:`Event ${i + 1}`}))};
    const sample=draft({scenes:Array.from({length:5},(_,i)=>({...draft().scenes[i%2],id:`sample-${i}`,title:`Scene ${i + 1}`}))});
    const counts:{cast:number[];lore:number[];scenes:number[]}={cast:[],lore:[],scenes:[]};
    const labels:string[]=[],snapshots:Array<[number,number]>=[];
    const result=await adaptStory(options({sceneCount:5}),async messages=>{
      expect(JSON.stringify(messages).length).toBeLessThanOrEqual(IMPORT_LIMITS.requestCharacters);
      if(messages[1].content.startsWith('SOURCE CHUNK'))return response(original);
      const input=JSON.parse(messages[1].content);
      if(input.characters)counts.cast.push(input.characters.length);
      if(input.entries)counts.lore.push(input.entries.length);
      if(input.scenes)counts.scenes.push(input.scenes.length);
      expect(messages[0].content).toContain('Never write these for the human');
      expect(messages[0].content).toContain('Keep future revelations');
      return stagedReply(messages,sample);
    },(done,total,label)=>{labels.push(label);snapshots.push([done,total]);});
    expect(counts).toEqual({cast:[4,4,1],lore:[4,4,1],scenes:[2,2,1]});
    expect(result.cast.map(person=>person.name)).toEqual(original.cast.map(person=>person.name));
    expect(result.lore.map(entry=>entry.name)).toEqual(original.setting.map(entry=>entry.name));
    expect(result.scenes.map(scene=>scene.title)).toEqual(sample.scenes.map(scene=>scene.title));
    expect(result.scenes.every(scene=>scene.sourceRefs[0]==='chunk:1')).toBe(true);
    expect(labels.every(label=>!label.includes('Person')&&!label.includes('Location'))).toBe(true);
    expect(snapshots.at(-1)).toEqual([11,11]);
  });

  test.each(['cast','lore','scenes'] as const)('rejects a %s batch that omits requested records after one bounded repair', async kind=>{
    let failures=0;
    await expect(adaptStory(options(),async messages=>{
      if(messages[1].content.startsWith('SOURCE CHUNK'))return response(ledger());
      const result=stagedReply(messages),input=JSON.parse(messages[1].content);
      if(input.task===`set-points-${kind}-v1`){failures++;const value=JSON.parse(result.content);value[kind]=[];return response(value);}
      return result;
    },()=>{})).rejects.toMatchObject({code:'INVALID_SCHEMA'});
    expect(failures).toBe(2);
  });

  test('preserves starting-state exclusions and the plan’s continuity assumptions', async () => {
    const result=await adaptStory(options(),async messages=>{
      if(messages[1].content.startsWith('SOURCE CHUNK'))return response(ledger());
      const input=JSON.parse(messages[1].content),result=JSON.parse(stagedReply(messages).content);
      if(input.task==='set-points-plan-v1'){result.startingLore=[];result.warnings=['Greyhaven details become known after the opening.'];}
      if(input.task==='set-points-scenes-v1')for(const scene of result.scenes)scene.assumptions=[];
      expect(input.task).not.toBe('set-points-lore-v1');
      return response(result);
    },()=>{});
    expect(result.lore).toEqual([]);
    expect(result.cast[0].name).toBe('Mara');
    expect(result.scenes[1].assumptions).toContain('The player chooses to visit the chart room.');
    expect(result.warnings.some(warning=>warning.includes('1 source setting entries were excluded'))).toBe(true);
  });

  test('rejects scene plans that move backwards after spanning later source events', async () => {
    const original=verboseLedger();let planCalls=0;
    await expect(adaptStory(options(),async messages=>{
      if(messages[1].content.startsWith('SOURCE CHUNK'))return response(original);
      planCalls++;const result=JSON.parse(stagedReply(messages).content);
      result.scenes[0].eventIndexes=[0,5];result.scenes[1].eventIndexes=[1];return response(result);
    },()=>{})).rejects.toThrow('chronology');
    expect(planCalls).toBe(2);
  });

  test('a truncated scene batch resumes independently without paying for completed reading or profiles', async () => {
    const cache=new Map<string,Awaited<ReturnType<Generate>>>();let last='',reads=0,plans=0,profiles=0,sceneCalls=0;
    const generate:Generate=async messages=>{
      const key=JSON.stringify(messages);last=key;if(cache.has(key))return structuredClone(cache.get(key)!);
      let result;
      if(messages[1].content.startsWith('SOURCE CHUNK')){reads++;result=response(ledger());}
      else{
        const input=JSON.parse(messages[1].content);
        if(input.task==='set-points-plan-v1')plans++;
        if(['set-points-cast-v1','set-points-lore-v1'].includes(input.task))profiles++;
        result=input.task==='set-points-scenes-v1'&&++sceneCalls===1?{content:'{"scenes":',finish_reason:'length'}:stagedReply(messages);
      }
      cache.set(key,result);return result;
    };
    await expect(adaptStory(options(),generate,()=>{})).rejects.toMatchObject({code:'TRUNCATED_RESPONSE'});
    expect(sceneCalls).toBe(1);cache.delete(last);
    await adaptStory(options(),generate,()=>{});
    expect({reads,plans,profiles,sceneCalls}).toEqual({reads:1,plans:1,profiles:2,sceneCalls:2});
  });

  test('repairs malformed staged JSON once without regenerating the plan or reading', async () => {
    let sceneCalls=0,otherCalls=0;
    await adaptStory(options(),async messages=>{
      if(messages[1].content.startsWith('SOURCE CHUNK'))return response(ledger());
      if(JSON.parse(messages[1].content).task==='set-points-scenes-v1'){
        if(++sceneCalls===1)return {content:'{invalid JSON'};
        expect(messages.at(-1)?.content).toContain('required JSON schema');
      }else otherCalls++;
      return stagedReply(messages);
    },()=>{});
    expect(sceneCalls).toBe(2);expect(otherCalls).toBe(3);
  });

  test('checks fixed draft size before buying prose batches and retains all identities', async () => {
    const original={...ledger(),cast:Array.from({length:55},(_,i)=>({...ledger().cast[0],name:`Person ${i}`,aliases:Array.from({length:16},(_,j)=>`${j}-${'a'.repeat(178)}`)}))};
    expect(JSON.stringify(original).length).toBeLessThan(IMPORT_LIMITS.draftCharacters);
    let calls=0;
    await expect(adaptStory(options(),async messages=>{
      calls++;if(calls===1)return response(original);
      expect(JSON.parse(messages[1].content).task).toBe('set-points-plan-v1');return stagedReply(messages);
    },()=>{})).rejects.toMatchObject({code:'DRAFT_SIZE_LIMIT'});
    expect(calls).toBe(2);
  });

  test('rejects oversized staged prose without silently cutting it or making another paid attempt', async () => {
    let calls=0;
    await expect(adaptStory(options(),async messages=>{
      calls++;if(messages[1].content.startsWith('SOURCE CHUNK'))return response(ledger());
      const result=JSON.parse(stagedReply(messages).content);
      if(JSON.parse(messages[1].content).task==='set-points-cast-v1'){
        result.cast[0].personality='a'.repeat(3500);result.cast[0].knowledge='b'.repeat(3500);
      }
      return response(result);
    },()=>{})).rejects.toThrow('character share of the draft');
    expect(calls).toBe(3);
  });

  test('splits large merge groups while keeping all dispatched messages within the input bound', async () => {
    const sizes:number[]=[],progress:Array<[number,number]>=[];
    await adaptStory(options({text:'x'.repeat(12000),chunkSize:4000}),async messages=>{
      expect(JSON.stringify(messages).length).toBeLessThanOrEqual(IMPORT_LIMITS.requestCharacters);
      if(messages[1].content.startsWith('SOURCE CHUNK')){
        const input=JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));return response({...ledger([input.reference]),premise:'A'.repeat(90000)});
      }
      const input=JSON.parse(messages[1].content);
      if(input.ledgers){sizes.push(input.ledgers.length);return response(ledger(input.ledgers.flatMap((item:{coveredChunks:string[]})=>item.coveredChunks)));}
      return stagedReply(messages);
    },(done,total)=>progress.push([done,total]));
    expect(sizes).toEqual([2,1,2]);expect(progress.at(-1)).toEqual([10,10]);
  });

  test('an impossible merge stays cached and stops before another paid request on resume', async () => {
    const cache=new Map<string,Awaited<ReturnType<Generate>>>();let paid=0;
    const generate:Generate=async messages=>{
      const key=JSON.stringify(messages);if(cache.has(key))return cache.get(key)!;
      paid++;expect(messages[1].content).toStartWith('SOURCE CHUNK');
      const input=JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));
      const result=response({...ledger([input.reference]),premise:'A'.repeat(130000)});cache.set(key,result);return result;
    };
    for(let attempt=0;attempt<2;attempt++)await expect(adaptStory(options({text:'x'.repeat(8000),chunkSize:4000}),generate,()=>{})).rejects.toMatchObject({code:'REQUEST_SIZE_LIMIT'});
    expect(paid).toBe(2);
  });

  test('hard response bounds and unsafe original markup fail without extra model calls', async () => {
    for(const original of [{...ledger(),premise:'x'.repeat(IMPORT_LIMITS.draftCharacters)},{...verboseLedger(),premise:'{{setvar::secret::value}}'}]){
      let calls=0;await expect(adaptStory(options(),async()=>{calls++;return response(original);},()=>{})).rejects.toThrow();expect(calls).toBe(1);
    }
  });

  test('storage errors and cancellation propagate during cache-only recovery', async () => {
    let calls=0;const generate:Generate=async()=>{calls++;return response(verboseLedger());};
    generate.peek=async()=>{throw new Error('Checkpoint storage failed');};
    await expect(adaptStory(options(),generate,()=>{})).rejects.toThrow('Checkpoint storage failed');expect(calls).toBe(1);
    const controller=new AbortController();generate.peek=async()=>{controller.abort();return new Promise(()=>{});};
    await expect(adaptStory(options(),generate,()=>{},controller.signal)).rejects.toMatchObject({name:'AbortError'});expect(calls).toBe(2);
  });
});
