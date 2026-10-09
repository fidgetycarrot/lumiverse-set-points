import { describe, expect, test } from 'bun:test';
import { APPEARANCE_RULE, adaptStory, appearanceGuide, cardPayload, validateDraft, type Generate, type GenerationMessage } from '../src/importer';
import type { StoryDraft } from '../src/types';
import { enrichVisuals, INCOMPLETE_APPEARANCE, UNSPECIFIED_APPEARANCE, validateVisualPack, visualCaption, visualDraftSignature, visualTagPrompt, type VisualPack, type VisualProfile } from '../src/visuals';

const source = 'Mira is a woman, 30 years old. She has dark hair and green eyes. At the beginning, she wears a blue coat. Later, she changes into a red cloak. Rowan waits beside the harbor, with no appearance described.';
const draft = (): StoryDraft => ({ version:1,id:'story-1',title:'The Harbor',premise:'A meeting at the harbor.',playerRole:'Mira',startingPoint:'The beginning, before anyone changes clothes.',narratorInstructions:'Leave the player choices open.',cast:['Mira','Rowan'].map((name,index)=>({id:`cast-${index+1}`,name,aliases:[],personality:'Curious.',voice:'Plain speech.',relationships:'Harbor acquaintances.',knowledge:'A meeting is planned.',sourceRefs:['chunk:1']})),lore:[],scenes:[{id:'scene-1',title:'Meeting',greeting:'The harbor bell rings. Someone is waiting by the dock.',direction:'Offer a chance to talk.',assumptions:[],sourceRefs:['chunk:1']}],warnings:[],source:{title:'The Harbor',characters:source.length,chunks:1},createdAt:1 });
const reply = (value:unknown) => ({content:JSON.stringify(value)});
const sourceFacts = () => ({characters:[{characterId:'cast-1',facts:[
  {kind:'appearance',timing:'start',text:'Dark hair and green eyes.',evidence:'dark hair and green eyes'},
  {kind:'clothing',timing:'start',text:'A blue coat.',evidence:'a blue coat'},
  {kind:'identity',timing:'start',text:'A woman, 30 years old.',evidence:'woman, 30 years old'},
  {kind:'clothing',timing:'later',text:'A red cloak later in the story.',evidence:'a red cloak'},
]}],warnings:[]});
const profile = (): VisualProfile => ({characterId:'cast-1',description:'Mira has dark hair and green eyes.',appearanceTags:['dark hair','green eyes'],startingOutfit:'At the beginning, Mira wears a blue coat.',outfitTags:['blue coat'],suggestedDetails:'An optional silver hairpin could complete the design.',suggestedTags:['silver hairpin'],unknowns:['Height is not specified.'],sourceRefs:['chunk:1'],subject:'30 year old woman',countTag:'1girl'});
function profileResponse(messages:GenerationMessage[]) {
  const input=JSON.parse(messages[1].content),byKind=(kind:string)=>input.facts.filter((fact:{kind:string})=>fact.kind===kind).map((fact:{id:string})=>fact.id);
  return {profile:{...profile(),characterId:input.characterId},grounding:{description:byKind('appearance'),appearanceTags:[byKind('appearance'),byKind('appearance')],startingOutfit:byKind('clothing'),outfitTags:[byKind('clothing')],subject:byKind('identity'),countTag:byKind('identity')},warnings:[]};
}
const knownOnlyDraft = () => ({...draft(),cast:draft().cast.slice(0,1)});
const pack = ():VisualPack=>({version:1,draftId:'story-1',profiles:[profile()],warnings:[]});

describe('approved appearances in the playable draft',()=>{
  test('round-trips approved details and preserves explicit unknowns',()=>{
    const original={...draft(),appearances:[
      {characterId:'cast-1',description:'  Dark hair and green eyes.  ',startingOutfit:' A blue coat. '},
      {characterId:'cast-2',description:'',startingOutfit:'  '},
    ]};
    const checked=validateDraft(original);
    expect(checked.appearances).toEqual([
      {characterId:'cast-1',description:'Dark hair and green eyes.',startingOutfit:'A blue coat.'},
      {characterId:'cast-2',description:'',startingOutfit:''},
    ]);
    expect(validateDraft(JSON.parse(JSON.stringify(checked)))).toEqual(checked);
    expect(appearanceGuide(checked)).toContain('### Rowan\nAppearance: Unspecified.\nStarting outfit: Unspecified.');
    expect(original.appearances[0].description).toBe('  Dark hair and green eyes.  ');
  });
  test('requires unique existing cast IDs and bounded safe prose',()=>{
    const entry={characterId:'cast-1',description:'Dark hair.',startingOutfit:''};
    for(const entries of [[{...entry,characterId:'absent'}],[entry,entry],[{...entry,description:'x'.repeat(4001)}],[{...entry,startingOutfit:'x'.repeat(2001)}],[{...entry,description:'{{setvar::appearance::changed}}'}],[{...entry,startingOutfit:'<script>changed</script>'}]]){
      expect(()=>validateDraft({...draft(),appearances:entries})).toThrow();
    }
    expect(()=>validateDraft({...draft(),appearances:null})).toThrow();
    expect(()=>validateDraft({...draft(),appearances:Array.from({length:65},()=>entry)})).toThrow();
  });
  test('old drafts keep the same serialized shape and card fields',()=>{
    const original=draft(),checked=validateDraft(original),card=cardPayload(original);
    expect(JSON.stringify(checked)).toBe(JSON.stringify(original));
    expect('appearances' in checked).toBe(false);
    expect(cardPayload({...original,appearances:[]})).toEqual(card);
    expect(appearanceGuide(original)).toBe('');
    expect(card.description).not.toContain('Approved appearance guide');
    expect(card.system_prompt).toBe(`${original.narratorInstructions}\n\nThe human alone decides their character's speech, actions, thoughts, emotions, and consent. Describe situations and supporting characters, then leave the human space to respond. Honor established choices and do not retroactively assign actions to the player. Future scene guidance is conditional; surface revelations only as that scene becomes relevant.`);
  });
  test('publishes only approved descriptions with the authority rule and no scene rewrites',()=>{
    const original=draft(),generated=profile();
    const approved={...original,appearances:[{characterId:generated.characterId,description:generated.description,startingOutfit:generated.startingOutfit}]};
    const card=cardPayload(approved),guide=appearanceGuide(approved);
    expect(card.description).toContain(guide);
    expect(guide).toContain(generated.description);
    expect(guide).toContain(generated.startingOutfit);
    expect(JSON.stringify(card)).not.toContain('silver hairpin');
    expect(card.system_prompt).toContain(APPEARANCE_RULE);
    expect(card.system_prompt).toContain('human explicitly approves a change');
    expect(card.system_prompt).toContain('explicit action in the story');
    expect(card.first_mes).toBe(original.scenes[0].greeting);
    expect(card.extensions).toEqual(cardPayload(original).extensions);
    expect(visualDraftSignature(approved)).toBe(visualDraftSignature(original));
    expect(visualDraftSignature({...approved,appearances:[{characterId:'cast-1',description:'Different approved design.',startingOutfit:''}]})).toBe(visualDraftSignature(original));
  });
  test('a cached model answer cannot mark unsolicited appearance fields as user approved',async()=>{
    let paidCalls=0,cachedCalls=0;
    const generate:Generate=async()=>{
      paidCalls++;
      return reply({coveredChunks:['chunk:1'],premise:'A meeting at the harbor.',cast:[],setting:[],events:[{title:'Meeting',summary:'A meeting begins.',participants:[],changes:'A conversation becomes possible.',sourceRefs:['chunk:1']}],warnings:[]});
    };
    generate.peek=async()=>{cachedCalls++;return reply({...draft(),appearances:[{characterId:'cast-1',description:'An unapproved model invention.',startingOutfit:'An unapproved outfit.'}]});};
    const result=await adaptStory({text:source,sourceTitle:'The Harbor',playerRole:'Mira',startingPoint:'The beginning',sceneCount:1,chunkSize:12000,connectionId:'model'},generate,()=>{});
    expect(paidCalls).toBe(1);expect(cachedCalls).toBe(1);
    expect('appearances' in result).toBe(false);
    expect(cardPayload(result).system_prompt).not.toContain(APPEARANCE_RULE);
    expect(JSON.stringify(cardPayload(result))).not.toContain('unapproved');
  });
});

describe('visual profile validation and copy helpers',()=>{
  test('keeps suggested details out of default tags and captions',()=>{
    const value=profile();
    expect(visualTagPrompt(value)).toBe('1girl, dark hair, green eyes, blue coat');
    expect(visualTagPrompt(value,true)).toContain('silver hairpin');
    expect(visualCaption(value)).not.toContain('silver hairpin');
    expect(visualCaption(value,true)).toContain('silver hairpin');
    expect(visualCaption({...value,subject:'',description:UNSPECIFIED_APPEARANCE,startingOutfit:UNSPECIFIED_APPEARANCE})).toBe('');
  });
  test('validates stable identities and makes defensive copies',()=>{
    const original=pack(),checked=validateVisualPack(original,knownOnlyDraft());
    checked.profiles[0].appearanceTags.push('freckles');
    expect(original.profiles[0].appearanceTags).not.toContain('freckles');
    expect(()=>validateVisualPack({...pack(),draftId:'another-draft'},knownOnlyDraft())).toThrow('another draft');
    expect(()=>validateVisualPack({...pack(),profiles:[]},knownOnlyDraft())).toThrow('every cast member');
    expect(()=>validateVisualPack({...pack(),profiles:[profile(),profile()]})).toThrow('exactly once');
    expect(()=>validateVisualPack(undefined)).toThrow('object');
  });
  test.each(['dark_hair','Dark Hair','one two three four five six seven eight','a'.repeat(73),'masterpiece','best quality','rating explicit','anime style','1girl'])('rejects unsupported or preset image tag %s',tag=>{
    expect(()=>validateVisualPack({...pack(),profiles:[{...profile(),appearanceTags:[tag]}]})).toThrow();
  });
  test('checks controls, provenance syntax, suggestions, and unspecified fields',()=>{
    for(const value of ['<script>bad</script>','{{setvar::x::yes}}','<!--SET_POINTS:secret-->','abc\u0000def']){
      expect(()=>validateVisualPack({...pack(),profiles:[{...profile(),description:value}]})).toThrow();
    }
    expect(()=>validateVisualPack({...pack(),profiles:[{...profile(),sourceRefs:['chunk:2']}]},undefined,1)).toThrow('unknown');
    expect(()=>validateVisualPack({...pack(),profiles:[{...profile(),suggestedDetails:''}]})).toThrow('Suggested tags');
    expect(()=>validateVisualPack({...pack(),profiles:[{...profile(),description:UNSPECIFIED_APPEARANCE}]})).toThrow('unspecified appearance');
    expect(()=>validateVisualPack({...pack(),profiles:[{...profile(),countTag:'2girls'}]})).toThrow('countTag');
  });
  test('limits the Lumi Studio outfit field to twelve tags without trimming its description',()=>{
    const many=Array.from({length:13},(_,i)=>`clothing detail ${i + 1}`),value={...profile(),outfitTags:many};
    expect(()=>validateVisualPack({...pack(),profiles:[value]})).toThrow('at most 12');
    const accepted=validateVisualPack({...pack(),profiles:[{...value,outfitTags:many.slice(0,12)}]});
    expect(accepted.profiles[0].startingOutfit).toBe(value.startingOutfit);
    expect(accepted.profiles[0].outfitTags).toHaveLength(12);
  });
  test('retained facts round-trip separately from copied prompts with bounded safe provenance',()=>{
    const original={...pack(),profiles:[{...profile(),reviewFacts:[{kind:'identity' as const,text:'An extracted age needing review.',sourceRefs:['chunk:1']}]}]};
    const checked=validateVisualPack(original,knownOnlyDraft());
    expect(validateVisualPack(JSON.parse(JSON.stringify(checked)),knownOnlyDraft())).toEqual(checked);
    expect(visualCaption(checked.profiles[0],true)).not.toContain('extracted age');
    expect(visualTagPrompt(checked.profiles[0],true)).not.toContain('extracted age');
    checked.profiles[0].reviewFacts![0].sourceRefs.push('chunk:2');
    expect(original.profiles[0].reviewFacts[0].sourceRefs).toEqual(['chunk:1']);
    for(const fact of [{kind:'future',text:'Later look.',sourceRefs:['chunk:1']},{kind:'appearance',text:'x'.repeat(1001),sourceRefs:['chunk:1']},{kind:'appearance',text:'<script>bad</script>',sourceRefs:['chunk:1']},{kind:'appearance',text:'Brown hair.',sourceRefs:['chunk:2']}])expect(()=>validateVisualPack({...pack(),profiles:[{...profile(),reviewFacts:[fact]}]},undefined,1)).toThrow();
    expect('reviewFacts' in validateVisualPack(pack()).profiles[0]).toBe(false);
    expect(visualCaption({...profile(),description:INCOMPLETE_APPEARANCE,startingOutfit:INCOMPLETE_APPEARANCE})).toBe(profile().subject);
  });
  test('revision signature covers exactly the fields used in visual requests',()=>{
    const original=draft(),signature=visualDraftSignature(original);
    expect(visualDraftSignature({...original,createdAt:2,narratorInstructions:'Changed narration',scenes:[],warnings:['Changed warning']})).toBe(signature);
    for(const changed of [
      {...original,title:'New title'}, {...original,premise:'New premise'}, {...original,playerRole:'Rowan'}, {...original,startingPoint:'Later'},
      {...original,cast:[{...original.cast[0],voice:'New voice'},original.cast[1]]}, {...original,source:{...original.source,characters:source.length+1}},
    ])expect(visualDraftSignature(changed)).not.toBe(signature);
    expect(visualDraftSignature({...original,title:` ${original.title} `,cast:original.cast.map(person=>({...person,name:` ${person.name} `,sourceRefs:[' chunk:1 ','chunk:1']}))})).toBe(signature);
    expect(()=>visualDraftSignature({...original,title:''})).not.toThrow();
  });
});

describe('source-grounded visual enrichment',()=>{
  test('reads source once, separates later outfits and suggestions, and leaves unknown characters unspecified',async()=>{
    const original=draft(),before=JSON.stringify(original),calls:GenerationMessage[][]=[],progress:Array<[number,number,string]>=[];
    const result=await enrichVisuals({draft:original,sourceText:source},async messages=>{
      calls.push(messages);const input=JSON.parse(messages[1].content);
      if(input.task==='set-points-visual-facts-v1')return reply(sourceFacts());
      expect(input.task).toBe('set-points-visual-profile-v1');
      expect(input.facts.every((fact:{timing:string})=>fact.timing==='start')).toBe(true);
      expect(input.facts.some((fact:{text:string})=>fact.text.includes('red cloak'))).toBe(false);
      return reply(profileResponse(messages));
    },(...entry)=>progress.push(entry));
    expect(calls).toHaveLength(2);expect(JSON.stringify(original)).toBe(before);
    expect(result.profiles[0].sourceRefs).toEqual(['chunk:1']);
    expect(result.profiles[0].outfitTags).toEqual(['blue coat']);
    expect(result.profiles[0].suggestedTags).toEqual(['silver hairpin']);
    expect(result.profiles[1]).toMatchObject({characterId:'cast-2',description:UNSPECIFIED_APPEARANCE,startingOutfit:UNSPECIFIED_APPEARANCE,appearanceTags:[],outfitTags:[],subject:'',countTag:'',sourceRefs:[]});
    expect(result.warnings.some(warning=>warning.includes('1 later or uncertain'))).toBe(true);
    expect(progress.at(-1)?.slice(0,2)).toEqual([2,2]);
    expect(progress.every(item=>!item[2].includes('Mira')&&!item[2].includes('Rowan'))).toBe(true);
  });
  test('unknown source facts do not trigger a paid design-invention request',async()=>{
    let calls=0;const result=await enrichVisuals({draft:draft(),sourceText:source},async()=>{calls++;return reply({characters:[],warnings:[]});},()=>{});
    expect(calls).toBe(1);expect(result.profiles.every(value=>value.description===UNSPECIFIED_APPEARANCE&&value.suggestedDetails==='')).toBe(true);
  });
  test.each(['nested', 'factIds', 'factId', 'mixed', 'single'] as const)('accepts equivalent explicit grounding references without a paid repair: %s',async format=>{
    let calls=0;
    const result=await enrichVisuals({draft:knownOnlyDraft(),sourceText:source},async messages=>{
      calls++;
      if(JSON.parse(messages[1].content).task==='set-points-visual-facts-v1')return reply(sourceFacts());
      const output=profileResponse(messages),id=output.grounding.description[0];
      const variants={nested:[[id]],factIds:[{factIds:[id]}],factId:[{factId:id}],mixed:[[{id}],id],single:id};
      (output.grounding as any).description=variants[format];
      return reply(output);
    },()=>{});
    expect(calls).toBe(2);expect(result.profiles[0].appearanceTags).toEqual(['dark hair','green eyes']);
  });
  test.each([1, {evidence:'dark hair'}, {id:'absent'}, {factIds:['visual-1-1-3']}])('does not infer or trust unsupported references: %j',async reference=>{
    await expect(enrichVisuals({draft:knownOnlyDraft(),sourceText:source},async messages=>{
      if(JSON.parse(messages[1].content).task==='set-points-visual-facts-v1')return reply(sourceFacts());
      const output=profileResponse(messages);(output.grounding as any).description=[reference];return reply(output);
    },()=>{})).rejects.toBeInstanceOf(Error);
  });
  test('preserves all sections and deduplicates matching facts while retaining their references',async()=>{
    const text=`${'neutral harbor. '.repeat(1600)}dark hair${' neutral harbor.'.repeat(1600)}`;
    let read='',sections=0;
    const result=await enrichVisuals({draft:knownOnlyDraft(),sourceText:text},async messages=>{
      const input=JSON.parse(messages[1].content);
      if(input.task==='set-points-visual-facts-v1'){
        read+=input.source.text;sections++;
        return reply({characters:[{characterId:'cast-1',facts:[{kind:'appearance',timing:'start',text:'A described harbor visitor.',evidence:input.source.text.slice(0,Math.min(20,input.source.text.length)).trim()}]}],warnings:[]});
      }
      expect(input.facts).toHaveLength(1);expect(input.facts[0].sourceRefs).toHaveLength(sections);
      return reply({profile:{...profile(),description:'A described harbor visitor.',appearanceTags:['harbor visitor'],startingOutfit:UNSPECIFIED_APPEARANCE,outfitTags:[],subject:'',countTag:''},grounding:{description:[input.facts[0].id],appearanceTags:[[input.facts[0].id]],startingOutfit:[],outfitTags:[],subject:[],countTag:[]},warnings:[]});
    },()=>{});
    expect(read).toBe(text);expect(sections).toBeGreaterThan(1);expect(result.profiles[0].sourceRefs).toHaveLength(sections);
  });
  test('rejects fabricated evidence before creating any character profile',async()=>{
    let calls=0;
    await expect(enrichVisuals({draft:draft(),sourceText:source},async()=>{
      calls++;const result=sourceFacts();result.characters[0].facts[0].evidence='a quote that is not in the story';return reply(result);
    },()=>{})).rejects.toMatchObject({code:'INVALID_REFERENCE'});
    expect(calls).toBe(2);
  });
  test.each(['appearance','clothing','identity','count-only'] as const)('retains uncited starting facts without a repair request: %s',async omission=>{
    let calls=0;
    const result=await enrichVisuals({draft:knownOnlyDraft(),sourceText:source},async messages=>{
      calls++;
      if(JSON.parse(messages[1].content).task==='set-points-visual-facts-v1')return reply(sourceFacts());
      const output=profileResponse(messages);
      if(omission==='appearance'){output.profile.description=UNSPECIFIED_APPEARANCE;output.profile.appearanceTags=[];output.grounding.description=[];output.grounding.appearanceTags=[];}
      if(omission==='clothing'){output.profile.startingOutfit=UNSPECIFIED_APPEARANCE;output.profile.outfitTags=[];output.grounding.startingOutfit=[];output.grounding.outfitTags=[];}
      if(omission==='identity'||omission==='count-only'){output.profile.subject='';output.grounding.subject=[];}
      if(omission==='identity'){output.profile.countTag='';output.grounding.countTag=[];}
      (output.profile as any).reviewFacts=[{kind:'appearance',text:'Model-invented review detail.',sourceRefs:['chunk:1']}];
      return reply(output);
    },()=>{});
    expect(calls).toBe(2);
    const value=result.profiles[0],kind=omission==='count-only'?'identity':omission;
    expect(value.reviewFacts).toEqual([{kind,text:sourceFacts().characters[0].facts.find(fact=>fact.kind===kind)!.text,sourceRefs:['chunk:1']}]);
    expect(result.warnings.some(warning=>warning.includes('1 extracted starting facts'))).toBe(true);
    expect(JSON.stringify(result)).not.toContain('Model-invented');
    if(omission==='appearance')expect(value.description).toBe(INCOMPLETE_APPEARANCE);
    if(omission==='clothing')expect(value.startingOutfit).toBe(INCOMPLETE_APPEARANCE);
    expect(visualCaption(value)).not.toContain(INCOMPLETE_APPEARANCE);
  });
  test.each(['identity','tag','later','character','unspecified'] as const)('rejects unsupported profile grounding: %s',async fault=>{
    let calls=0;
    await expect(enrichVisuals({draft:draft(),sourceText:source},async messages=>{
      calls++;
      if(JSON.parse(messages[1].content).task==='set-points-visual-facts-v1')return reply(sourceFacts());
      const result=profileResponse(messages);
      if(fault==='identity')result.grounding.subject=[];
      if(fault==='tag')result.grounding.appearanceTags[0]=[];
      if(fault==='later')result.grounding.startingOutfit=['visual-1-1-4'];
      if(fault==='character')result.profile.characterId='cast-2';
      if(fault==='unspecified'){result.profile.description=UNSPECIFIED_APPEARANCE;result.profile.appearanceTags=[];result.grounding.appearanceTags=[];}
      return reply(result);
    },()=>{})).rejects.toThrow();
    expect(calls).toBe(3);
  });
  test('an uncited fact in profile one does not stop the other eight profiles',async()=>{
    const original=draft();original.cast=Array.from({length:9},(_,i)=>({...original.cast[0],id:`cast-${i+1}`,name:`Harbor visitor ${i+1}`}));
    let calls=0;
    const result=await enrichVisuals({draft:original,sourceText:source},async messages=>{
      calls++;const input=JSON.parse(messages[1].content);
      if(input.task==='set-points-visual-facts-v1')return reply({characters:original.cast.map(person=>({...sourceFacts().characters[0],characterId:person.id})),warnings:[]});
      const answer=profileResponse(messages);
      if(input.characterId==='cast-1'){answer.profile.subject='';answer.profile.countTag='';answer.grounding.subject=[];answer.grounding.countTag=[];}
      return reply(answer);
    },()=>{});
    expect(result.profiles).toHaveLength(9);expect(calls).toBe(10);
    expect(result.profiles[0].reviewFacts).toHaveLength(1);
    expect(result.profiles.slice(1).every(value=>!value.reviewFacts&&value.subject==='30 year old woman')).toBe(true);
    expect(JSON.stringify(original)).not.toContain('reviewFacts');
  });
  test('completed fact extraction resumes from exact-prompt cache when profile generation fails',async()=>{
    const cache=new Map<string,Awaited<ReturnType<Generate>>>();let reads=0,profiles=0;
    const generate:Generate=async messages=>{
      const key=JSON.stringify(messages);if(cache.has(key))return structuredClone(cache.get(key)!);
      let result;
      if(JSON.parse(messages[1].content).task==='set-points-visual-facts-v1'){reads++;result=reply(sourceFacts());}
      else{if(++profiles===1)throw new Error('Provider temporarily unavailable');result=reply(profileResponse(messages));}
      cache.set(key,result);return result;
    };
    await expect(enrichVisuals({draft:draft(),sourceText:source},generate,()=>{})).rejects.toThrow('temporarily unavailable');
    await enrichVisuals({draft:draft(),sourceText:source},generate,()=>{});
    expect(reads).toBe(1);expect(profiles).toBe(2);
  });
  test('source limits and cancellation are checked before any paid request',async()=>{
    let calls=0;const generate:Generate=async()=>{calls++;return reply(sourceFacts());};
    await expect(enrichVisuals({draft:draft(),sourceText:'x'.repeat(500001)},generate,()=>{})).rejects.toMatchObject({code:'SOURCE_LIMIT'});
    await expect(enrichVisuals({draft:draft(),sourceText:''},generate,()=>{})).rejects.toMatchObject({code:'EMPTY_SOURCE'});
    const controller=new AbortController();controller.abort();
    await expect(enrichVisuals({draft:draft(),sourceText:source},generate,()=>{},controller.signal)).rejects.toMatchObject({name:'AbortError'});
    expect(calls).toBe(0);
  });
  test('cancel settles an ignored provider signal without changing the story draft',async()=>{
    const controller=new AbortController(),original=draft(),before=JSON.stringify(original);
    const work=enrichVisuals({draft:original,sourceText:source},async()=>new Promise(()=>{}),()=>{},controller.signal);
    controller.abort();await expect(work).rejects.toMatchObject({name:'AbortError'});expect(JSON.stringify(original)).toBe(before);
  });
});
