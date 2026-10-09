import { describe, expect, spyOn, test } from 'bun:test';
import type { SpindleAPI } from 'lumiverse-spindle-types';
import { SetPointsController, setupBackend } from '../src/backend';
import { draft } from './fixtures';
import { DEMO_STORY, type ImportOptions, type ImportJob, type WebStoryPage } from '../src/types';
import { repairSignature } from '../src/scene-repair';

const options:ImportOptions={text:DEMO_STORY,sourceTitle:'The Lighthouse Letter',playerRole:'Mara',startingPoint:'The harbor',sceneCount:4,chunkSize:12000,connectionId:'model'};
function stagedReply(input:any) {
  const body=JSON.parse(input.messages[1].content), example=draft();
  if(body.task==='set-points-plan-v1')return {title:example.title,premise:example.premise,narratorInstructions:example.narratorInstructions,startingLore:[],scenes:example.scenes.map(scene=>({title:scene.title,eventIndexes:[0],brief:'A traveler follows a clue.',assumptions:scene.assumptions})),warnings:[]};
  if(body.task==='set-points-cast-v1')return {cast:body.characters.map((person:any)=>({id:person.id,personality:'Cautious and resourceful.',voice:'Direct.',relationships:'Acquainted with the traveler.',knowledge:'Knows the harbor.'})),warnings:[]};
  if(body.task==='set-points-lore-v1')return {lore:body.entries.map((entry:any)=>({id:entry.id,keys:['harbor'],content:'A small coastal harbor.'})),warnings:[]};
  if(body.task==='set-points-scenes-v1')return {scenes:body.scenes.map((scene:any)=>({id:scene.id,greeting:'A lantern glows by the harbor. What do you do?',direction:'Offer the next clue without choosing for the player.',assumptions:scene.assumptions})),warnings:[]};
  throw new Error('Unexpected adaptation request in test');
}
function harness(generate: (input:any)=>Promise<unknown> = async()=>({content:'not json',finish_reason:'stop'})) {
  const stored=new Map<string,unknown>();const calls:any[]=[];
  const api={
    permissions:{has:(name:string)=>name==='generation',getGranted:async()=>['generation']},
    userStorage:{
      getJson:async(path:string,opts:any)=>{const value=stored.get(`${opts?.userId}:${path}`);if(value===undefined){if(opts&&'fallback' in opts)return structuredClone(opts.fallback);throw new Error('Missing storage file');}return typeof value==='string'?JSON.parse(value):structuredClone(value);},
      setJson:async(path:string,value:unknown,opts:any)=>{stored.set(`${opts?.userId}:${path}`,structuredClone(value));},
      exists:async(path:string,userId:string)=>stored.has(`${userId}:${path}`),
      read:async(path:string,userId:string)=>{const value=stored.get(`${userId}:${path}`);if(value===undefined)throw new Error('Missing storage file');return typeof value==='string'?value:JSON.stringify(value);},
      write:async(path:string,value:string,userId:string)=>{stored.set(`${userId}:${path}`,value);},
      move:async(from:string,to:string,userId:string)=>{const key=`${userId}:${from}`;if(!stored.has(key))throw new Error('Missing storage file');stored.set(`${userId}:${to}`,stored.get(key));stored.delete(key);},
      delete:async(path:string,userId:string)=>{stored.delete(`${userId}:${path}`);},
      mkdir:async()=>{},
      list:async(prefix:string,userId:string)=>[...stored.keys()].filter(key=>key.startsWith(`${userId}:${prefix}`)).map(key=>key.slice(`${userId}:`.length)),
    },
    connections:{get:async(id:string,userId:string)=>id==='model'?{id,name:'Model',model:'test',provider:'test',userId}:null,list:async()=>[{id:'model',name:'Model',model:'test',provider:'test'}]},
    generate:{raw:async(input:any)=>{calls.push(input);return generate(input);}},
  } as unknown as SpindleAPI;
  return {api,stored,calls};
}
function repairReply(input:any){const body=JSON.parse(input.messages[1].content);return {content:JSON.stringify({id:body.scene.id,greeting:'Iona holds a letter beside the boat.',direction:'Offer the clue while leaving the response open.',assumptions:[],roles:{playerCharacterId:body.roles.playerCharacterId,narration:body.roles.narration,viewpointCharacterId:body.roles.viewpointCharacterId}}),finish_reason:'stop'};}
describe('completed-draft scene repair',()=>{
  test('does not repeat an uncertain request until an explicit retry and retains completed results after restart',async()=>{
    let fail=true;const h=harness(async input=>{if(fail)throw new Error('The operation timed out');return repairReply(input);});
    const app=new SetPointsController(h.api,'alice'),story=draft();await app.handle('save-draft',{draft:story});
    await app.handle('start-scene-repair',{draft:story,sceneIds:['harbor'],connectionId:'model'});await app.waitForRepair();expect((await app.snapshot(null)).repairs?.retryUncertain).toBe(true);
    fail=false;await app.handle('resume-scene-repair',{draft:story});await app.waitForRepair();expect(h.calls).toHaveLength(1);
    await app.handle('resume-scene-repair',{draft:story,retryUncertain:true});await app.waitForRepair();expect(h.calls).toHaveLength(2);
    const restarted=new SetPointsController(h.api,'alice'),view=await restarted.snapshot(null);expect(view.repairs?.job?.status).toBe('complete');expect(view.draft).toEqual(story);
    await restarted.handle('apply-scene-repair',{draft:story});expect((await restarted.snapshot(null)).draft?.scenes[0].greeting).toBe('Iona holds a letter beside the boat.');expect(h.calls).toHaveLength(2);
  });
  test('does not replace the draft until explicitly applied and rejects an edited input',async()=>{
    const h=harness(async input=>repairReply(input)),app=new SetPointsController(h.api,'alice'),story=draft();
    await app.handle('save-draft',{draft:story});await app.handle('start-scene-repair',{draft:story,sceneIds:['harbor'],connectionId:'model'});await app.waitForRepair();
    const view=await app.snapshot(null);expect(view.repairs?.job?.status).toBe('complete');expect(view.draft).toEqual(story);expect(view.repairs?.result?.scenes[0].greeting).not.toBe(story.scenes[0].greeting);
    expect(view.repairs?.requestSignature).toBe(repairSignature(story));expect(h.calls).toHaveLength(1);
    const edited={...story,premise:'My newer premise.'};await expect(app.handle('apply-scene-repair',{draft:edited})).rejects.toThrow('different draft version');expect((await app.snapshot(null)).draft).toEqual(story);
    await app.handle('apply-scene-repair',{draft:story});expect((await app.snapshot(null)).draft).toEqual(view.repairs!.result);expect(h.calls).toHaveLength(1);
    const diagnostics=JSON.stringify(await app.handle('diagnostics',{}));expect(diagnostics).not.toContain('Iona');expect(diagnostics).not.toContain('holds a letter');
  });
  test('resumes only the failed scene across restart and response allowance changes',async()=>{
    let fail=true;const h=harness(async input=>{if(JSON.parse(input.messages[1].content).scene.id==='letter'&&fail)throw new Error('OpenRouter generate failed (503): unavailable');return repairReply(input);});
    const first=new SetPointsController(h.api,'alice'),story=draft();await first.handle('save-draft',{draft:story});
    await first.handle('start-scene-repair',{draft:story,sceneIds:['harbor','letter'],connectionId:'model'});await first.waitForRepair();
    expect((await first.snapshot(null)).repairs?.job?.status).toBe('failed');expect(h.calls).toHaveLength(2);fail=false;
    const second=new SetPointsController(h.api,'alice');await second.handle('resume-scene-repair',{draft:story,maxOutputTokens:32000,reasoningMode:'off'});await second.waitForRepair();
    expect((await second.snapshot(null)).repairs?.job?.status).toBe('complete');expect(h.calls).toHaveLength(3);
    expect(h.calls.filter(input=>JSON.parse(input.messages[1].content).scene.id==='harbor')).toHaveLength(1);expect(h.calls.at(-1).parameters.max_tokens).toBe(32000);
    expect((await second.snapshot(null)).draft).toEqual(story);
  });
  test('rejects changed connection or draft on resume without a model request',async()=>{
    const h=harness(async()=>{throw new Error('HTTP 503');}),app=new SetPointsController(h.api,'alice'),story=draft();
    await app.handle('start-scene-repair',{draft:story,sceneIds:['harbor'],connectionId:'model'});await app.waitForRepair();
    await expect(app.handle('resume-scene-repair',{draft:{...story,playerRole:'Another visitor'}})).rejects.toThrow('different draft version');
    Object.assign(h.api.connections,{get:async()=>({id:'model',model:'changed',provider:'test'})});
    await expect(app.handle('resume-scene-repair',{draft:story})).rejects.toThrow('connection changed');expect(h.calls).toHaveLength(1);
  });
  test('allows saving newer review edits during repair, blocks competing paid work, and cancels',async()=>{
    const h=harness(async()=>new Promise(()=>{})),app=new SetPointsController(h.api,'alice'),story=draft();
    await app.handle('start-scene-repair',{draft:story,sceneIds:['harbor'],connectionId:'model'});
    await expect(app.handle('start-import',{options})).rejects.toThrow('scene repair');await expect(app.handle('test-connection',{connectionId:'model'})).rejects.toThrow('scene repair');
    const edited={...story,premise:'Keep this newer review edit.'};await app.handle('save-draft',{draft:edited});
    await app.handle('cancel-scene-repair',{});await app.waitForRepair();expect((await app.snapshot(null)).draft).toEqual(edited);expect((await app.snapshot(null)).repairs?.resumeAvailable).toBe(true);
    expect(h.calls).toHaveLength(1);expect(h.calls[0].signal.aborted).toBe(true);
  });
  test('keeps a valid legacy draft when optional saved repair data is damaged',async()=>{
    const h=harness();h.stored.set('alice:workspace.json',{draft:draft(),saved:null,job:null,repairInput:{draft:{},sceneIds:['harbor'],connectionId:'model'}});
    const app=new SetPointsController(h.api,'alice'),view=await app.snapshot(null);expect(view.draft).toEqual(draft());expect(view.repairs?.job?.status).toBe('failed');
    expect([...h.stored.keys()].some(key=>key.startsWith('alice:recovery/scene-repair-'))).toBe(true);expect(h.calls).toHaveLength(0);
  });
  test('modern import binds a supporting narrator separately from the player in every generated scene',async()=>{
    const ledger={coveredChunks:['chunk:1'],premise:'A traveler seeks a letter.',cast:['Mara','Iona'].map(name=>({name,aliases:[],personality:'Curious.',voice:'Direct.',relationships:'Harbor acquaintances.',knowledgeAtIntroduction:'A letter is missing.',developments:'No later changes.',sourceRefs:['chunk:1']})),setting:[],events:[{title:'Arrival',summary:'The harbor awaits.',participants:['Mara','Iona'],changes:'A conversation is possible.',sourceRefs:['chunk:1']}],warnings:[]};
    const h=harness(async input=>{if(input.messages[1].content.startsWith('SOURCE CHUNK'))return {content:JSON.stringify(ledger),finish_reason:'stop'};
      const body=JSON.parse(input.messages[1].content),result=stagedReply(input);if(body.task==='set-points-scenes-v1')for(const scene of result.scenes)scene.roles={playerCharacterId:'cast-1',narration:'character',viewpointCharacterId:'cast-2'};return {content:JSON.stringify(result),finish_reason:'stop'};});
    const app=new SetPointsController(h.api,'alice');await app.handle('start-import',{options:{...options,narrationMode:'character',narratorCharacter:'Iona',sourceViewpoint:'Iona in the source'}});await app.waitForImport();
    const view=await app.snapshot(null);expect(view.job?.status).toBe('complete');expect(view.draft?.roles).toEqual({narration:'character',playerCharacterId:'cast-1',viewpointCharacterId:'cast-2',sourceViewpoint:'Iona in the source'});
    for(const input of h.calls.slice(1))expect(input.messages[0].content).toContain('human plays Mara');expect(h.calls).toHaveLength(4);
  });
});
describe('import jobs and draft storage',()=>{
  test('failed model response retains prior draft and diagnostics omit story prose',async()=>{
    const h=harness(),app=new SetPointsController(h.api,'alice');await app.handle('save-draft',{draft:draft()});
    await app.handle('start-import',{options});await app.waitForImport();const view=await app.snapshot(null);
    expect(view.job?.status).toBe('failed');expect(view.draft?.id).toBe('test-draft');
    expect(h.calls).toHaveLength(2);
    expect(h.calls.every(call=>call.userId==='alice'&&call.connection_id==='model'&&call.model==='test'&&call.provider==='test')).toBe(true);
    expect(JSON.stringify(await app.handle('diagnostics',{}))).not.toContain('Mara');
  });
  test.each([
    ['openai', 'selected-model-v2'],
    ['anthropic', 'selected-model-2026'],
    ['openrouter', 'vendor/selected-model'],
  ])('passes the selected %s model through the raw host contract and completes adaptation',async(provider,model)=>{
    const ledger={coveredChunks:['chunk:1'],premise:'A traveler seeks a lighthouse.',cast:[],setting:[],events:[{title:'Arrival',summary:'The traveler reaches the harbor.',participants:[],changes:'A journey begins.',sourceRefs:['chunk:1']}],warnings:[]};
    const h=harness(async(input)=>{
      // Mirror Lumiverse worker-host: connection_id does not supply input.model.
      const upstream={provider:input.provider||'',model:input.model||''};
      if(upstream.model!==model||upstream.provider!==provider) throw new Error('API error: 400 - model is required');
      return {content:JSON.stringify(input.messages[1].content.startsWith('SOURCE CHUNK')?ledger:stagedReply(input)),finish_reason:'stop'};
    });
    Object.assign(h.api.connections,{get:async()=>({id:'model',name:'Private connection',provider,model,api_url:'https://private.example',has_api_key:true})});
    const app=new SetPointsController(h.api,'alice');
    await app.handle('start-import',{options});await app.waitForImport();
    const view=await app.snapshot(null);
    expect(view.job?.status).toBe('complete');expect(view.draft?.scenes).toHaveLength(2);expect(h.calls).toHaveLength(3);
    for(const call of h.calls){
      expect(call).toMatchObject({type:'raw',connection_id:'model',provider,model,userId:'alice'});
      expect(call).not.toHaveProperty('api_url');expect(call).not.toHaveProperty('api_key');
      expect(call.signal).toBeInstanceOf(AbortSignal);
    }
  });
  test.each(['model','provider'])('rejects a connection with an empty %s before starting a job',async(field)=>{
    const h=harness(),app=new SetPointsController(h.api,'alice');
    Object.assign(h.api.connections,{get:async()=>({id:'model',model:'test',provider:'test',[field]:'   '})});
    await expect(app.handle('start-import',{options})).rejects.toThrow(`no ${field}`);
    expect(h.calls).toHaveLength(0);expect((await app.snapshot(null)).job).toBeNull();
  });
  test.each([
    ['OpenAI API error: 404 - model does not exist','MODEL_UNAVAILABLE',404],
    ['OpenAI API error: 400 - unsupported parameter temperature','INVALID_REQUEST',400],
    ['HTTP 401: Unauthorized','AUTHENTICATION',401],
    ['API error: 429 - rate limit','RATE_LIMIT',429],
    ['API error: 400 - context length exceeded','CONTEXT_LIMIT',400],
    ['HTTP 503: upstream unavailable','PROVIDER_UNAVAILABLE',503],
    ['OpenAI generation failed (400): Bad request','INVALID_REQUEST',400],
    ['Anthropic generation failed (403): Forbidden','REQUEST_DENIED',403],
    ['OpenRouter generate failed (403): Provider returned error','REQUEST_DENIED',403],
    ['OpenRouter generate failed (403): API key lacks permission','REQUEST_DENIED',403],
    ['OpenRouter generate failed (403): Input was flagged','DECLINED',403],
    ['OpenRouter generate failed (403): Content policy violation','DECLINED',403],
    ['Google generation failed (503): Service unavailable','PROVIDER_UNAVAILABLE',503],
    ['The operation timed out','TIMEOUT',undefined],
    ['fetch failed','CONNECTION_FAILED',undefined],
    ['connection refused','CONNECTION_FAILED',undefined],
    ['Unexpected upstream failure','REQUEST_FAILED',undefined],
  ] as const)('categorizes %s without retaining provider payloads',async(message,code,status)=>{
    const privateText='SECRET_STORY_PROSE_7261';
    const h=harness(async()=>{throw new Error(`${message}; ${privateText}; sk-secret-credential; https://private.example/story`);});
    const app=new SetPointsController(h.api,'alice');await app.handle('save-draft',{draft:draft()});
    await app.handle('start-import',{options});await app.waitForImport();
    const view=await app.snapshot(null),diagnostics=JSON.stringify(await app.handle('diagnostics',{}));
    expect(view.job?.status).toBe('failed');expect(view.draft?.id).toBe('test-draft');expect(view.job?.error).toContain(code);
    expect(diagnostics).toContain(code);if(status)expect(diagnostics).toContain(`HTTP ${status}`);
    for(const output of [view.job?.error??'',diagnostics,JSON.stringify(h.stored.get('alice:workspace.json'))]){
      expect(output).not.toContain(privateText);expect(output).not.toContain('sk-secret-credential');expect(output).not.toContain('private.example');
    }
    expect(h.calls).toHaveLength(1);
  });
  test('handles a structured provider failure without serializing its body',async()=>{
    const h=harness(async()=>{throw {status:503,message:'Upstream failed',body:{prompt:'PRIVATE_PROMPT'}};});
    const app=new SetPointsController(h.api,'alice');await app.handle('start-import',{options});await app.waitForImport();
    const view=await app.snapshot(null);expect(view.job?.error).toContain('PROVIDER_UNAVAILABLE; HTTP 503');
    expect(JSON.stringify(await app.handle('diagnostics',{}))).not.toContain('PRIVATE_PROMPT');
  });
  test('settles a deadline as timeout even when the host never responds to cancellation',async()=>{
    const deadline=new AbortController();
    const timeout=spyOn(AbortSignal,'timeout').mockReturnValue(deadline.signal);
    try{
      const h=harness(async()=>new Promise(()=>{}));
      const app=new SetPointsController(h.api,'alice');await app.handle('start-import',{options});
      for(let i=0;i<20&&!h.calls.length;i++)await Bun.sleep(1);
      expect(h.calls).toHaveLength(1);deadline.abort(new DOMException('Deadline reached','TimeoutError'));await app.waitForImport();
      const view=await app.snapshot(null);expect(view.job?.status).toBe('failed');expect(view.job?.error).toContain('TIMEOUT');
    }finally{timeout.mockRestore();}
  });
  test.each([
    [{content:'',finish_reason:'stop',stop_details:{type:'finish_reason',category:'PROHIBITED_CONTENT'}},'DECLINED'],
    [{content:'',finish_reason:'stop',stop_details:{type:'blocked_prompt',category:'unknown'}},'DECLINED'],
    [{content:'',finish_reason:'stop',stop_details:{type:'refusal'}},'DECLINED'],
    [{content:'',finish_reason:'max_output_tokens'},'OUTPUT_LIMIT'],
    [{content:'',finish_reason:'stop',stop_details:{type:'finish_reason',category:'MAX_TOKENS'}},'OUTPUT_LIMIT'],
    [{content:'',finish_reason:'error'},'RESPONSE_FAILED'],
    [{content:'',finish_reason:'stop',stop_details:{type:'incomplete'}},'RESPONSE_FAILED'],
    [{content:'',finish_reason:'stop',reasoning:'Private reasoning text'},'REASONING_ONLY'],
    [{content:'',finish_reason:'stop',reasoning_details:[{text:'Private reasoning text'}]},'REASONING_ONLY'],
    [{content:'',finish_reason:'stop'},'REASONING_ONLY'],
  ] as const)('classifies response metadata %# without exposing private fields or retrying',async(response,code)=>{
    const h=harness(async()=>({...response,stop_details:{...('stop_details' in response?response.stop_details:{}),explanation:'SECRET_STOP_EXPLANATION'},usage:{completion_tokens:16,provider_raw:{completion_tokens_details:{reasoning_tokens:12},prompt:'SECRET_RAW_USAGE'}}}));
    const app=new SetPointsController(h.api,'alice');await app.handle('save-draft',{draft:draft()});
    await app.handle('start-import',{options});await app.waitForImport();const view=await app.snapshot(null);
    expect(view.job?.error).toContain(code);expect(view.draft?.id).toBe('test-draft');expect(h.calls).toHaveLength(1);
    const diagnostic=JSON.stringify(await app.handle('diagnostics',{}));
    expect(diagnostic).toContain('textCharacters=0');expect(diagnostic).toContain('outputTokens=16');expect(diagnostic).toContain('reasoningTokens=12');
    for(const value of [view.job?.error??'',diagnostic])for(const secret of ['Private reasoning text','SECRET_STOP_EXPLANATION','SECRET_RAW_USAGE'])expect(value).not.toContain(secret);
  });
  test('only includes allowlisted stop codes and numeric usage in response diagnostics',async()=>{
    const h=harness(async()=>({content:'',finish_reason:'PRIVATE_FINISH',stop_details:{category:'PRIVATE_CATEGORY'},usage:{completion_tokens:'PRIVATE_TOKEN',provider_raw:{completion_tokens_details:{reasoning_tokens:-3}}}}));
    const app=new SetPointsController(h.api,'alice');await app.handle('start-import',{options});await app.waitForImport();
    const diagnostic=JSON.stringify(await app.handle('diagnostics',{}));
    expect(diagnostic).toContain('finish=unrecognized');expect(diagnostic).toContain('native=unrecognized');expect(diagnostic).toContain('outputTokens=unknown');expect(diagnostic).toContain('reasoningTokens=unknown');expect(diagnostic).not.toContain('PRIVATE_');
  });
  test('neutral connection check uses selected model but never sends or changes the story',async()=>{
    const h=harness(async()=>({content:'OK',finish_reason:'stop'})),app=new SetPointsController(h.api,'alice');
    await app.handle('save-draft',{draft:draft()});const before=structuredClone(h.stored.get('alice:workspace.json'));
    const result=await app.handle('test-connection',{connectionId:'model',text:'PRIVATE_SOURCE',sourceUrl:'https://private.example/story'}) as {message:string};
    expect(result.message).toContain('accepted');expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({type:'raw',connection_id:'model',provider:'test',model:'test',userId:'alice',parameters:{max_tokens:256,temperature:0.3}});
    expect(JSON.stringify(h.calls[0].messages)).not.toContain('PRIVATE_SOURCE');expect(JSON.stringify(h.calls[0].messages)).not.toContain('Mara');
    expect(h.stored.get('alice:workspace.json')).toEqual(before);expect((await app.snapshot(null)).job).toBeNull();
  });
  test.each(['length','stop'])('a blank neutral check (%s) is not reported as success',async(finish_reason)=>{
    const h=harness(async()=>({content:'',finish_reason})),app=new SetPointsController(h.api,'alice');
    await expect(app.handle('test-connection',{connectionId:'model'})).rejects.toThrow(finish_reason==='length'?'OUTPUT_LIMIT':'EMPTY_RESPONSE');
    expect((await app.snapshot(null)).job).toBeNull();
  });
  test('neutral check enforces permissions and connection validity',async()=>{
    const h=harness(),app=new SetPointsController(h.api,'alice');
    await expect(app.handle('test-connection',{connectionId:'missing'})).rejects.toThrow('no longer available');
    Object.assign(h.api.permissions,{has:()=>false});await expect(app.handle('test-connection',{connectionId:'model'})).rejects.toThrow('Grant generation');expect(h.calls).toHaveLength(0);
  });
  test('connection checks block parallel checks and imports, cancel on disposal, and release their lock',async()=>{
    const h=harness(async()=>new Promise(()=>{})),app=new SetPointsController(h.api,'alice');
    const check=app.handle('test-connection',{connectionId:'model'});await Bun.sleep(0);
    await expect(app.handle('test-connection',{connectionId:'model'})).rejects.toThrow('already running');
    await expect(app.handle('start-import',{options})).rejects.toThrow('connection check');expect(h.calls).toHaveLength(1);
    app.dispose();await expect(check).rejects.toThrow('CANCELLED');expect(h.calls[0].signal.aborted).toBe(true);
    await expect(app.handle('test-connection',{connectionId:'missing'})).rejects.toThrow('no longer available');
  });
  test('an active import blocks a neutral connection check',async()=>{
    const h=harness(async()=>new Promise(()=>{})),app=new SetPointsController(h.api,'alice');await app.handle('start-import',{options});
    await expect(app.handle('test-connection',{connectionId:'model'})).rejects.toThrow('adaptation to finish');app.dispose();await app.waitForImport();
  });
  test('resumes after restart without buying the completed source reading again',async()=>{
    const ledger={coveredChunks:['chunk:1'],premise:'A traveler seeks a lighthouse.',cast:[],setting:[],events:[{title:'Arrival',summary:'A traveler reaches the harbor.',participants:[],changes:'A journey begins.',sourceRefs:['chunk:1']}],warnings:[]};
    let failing=true;
    const h=harness(async(input)=>{
      if(input.messages[1].content.startsWith('SOURCE CHUNK'))return {content:JSON.stringify(ledger),finish_reason:'stop'};
      if(failing)throw new Error('OpenRouter generate failed (503): unavailable');
      return {content:JSON.stringify(stagedReply(input)),finish_reason:'stop'};
    });
    const first=new SetPointsController(h.api,'alice');await first.handle('start-import',{options});await first.waitForImport();
    expect(h.calls).toHaveLength(2);expect((await first.snapshot(null)).resume?.available).toBe(true);
    failing=false;
    const resumed=new SetPointsController(h.api,'alice');await resumed.handle('resume-import',{});await resumed.waitForImport();
    expect((await resumed.snapshot(null)).job?.status).toBe('complete');expect(h.calls).toHaveLength(4);
    expect(h.calls.filter(call=>call.messages[1].content.startsWith('SOURCE CHUNK'))).toHaveLength(1);
    expect((await resumed.snapshot(null)).diagnostics.join(' ')).toContain('Reused a saved model response');
    expect(JSON.stringify(await resumed.handle('diagnostics',{}))).not.toContain('Mara');
  });
  test('keeps an oversized paid ledger across restart without making a shortening request',async()=>{
    const events=Array.from({length:14},(_,index)=>({title:`Event ${index+1}`,summary:'A traveler learns about the harbor. '.repeat(60),participants:[],changes:'A new lead.',sourceRefs:['chunk:1']}));
    const oversized={coveredChunks:['chunk:1'],premise:'A traveler seeks a lighthouse.',cast:[],setting:[],events,warnings:[]};
    expect(JSON.stringify(oversized).length).toBeGreaterThan(24000);
    let call=0;
    const h=harness(async(input)=>{
      call++;if(call===2)throw new Error('OpenRouter generate failed (503): unavailable');
      return {content:JSON.stringify(call===1?oversized:stagedReply(input)),finish_reason:'stop'};
    });
    const first=new SetPointsController(h.api,'alice');await first.handle('start-import',{options});await first.waitForImport();
    expect(h.calls).toHaveLength(2);expect((await first.snapshot(null)).job?.status).toBe('failed');
    const resumed=new SetPointsController(h.api,'alice');await resumed.handle('resume-import',{});await resumed.waitForImport();
    expect((await resumed.snapshot(null)).job?.status).toBe('complete');expect(h.calls).toHaveLength(4);
    expect(h.calls.filter(input=>input.messages[1].content.startsWith('SOURCE CHUNK'))).toHaveLength(1);
    expect(h.calls.every(input=>!input.messages[1].content.includes('compact-existing-ledger'))).toBe(true);
    expect(JSON.parse(h.calls[2].messages[1].content).ledger.events).toEqual(events.map(event=>({...event,summary:event.summary.trim()})));
  });
  test('upgrades the actual 0.1.3 shortening-failure checkpoint without repurchasing reading or shortening',async()=>{
    const fixture=await Bun.file(new URL('./fixtures/recovery-v013.json',import.meta.url)).json() as {files:Record<string,string>};
    const h=harness(async(input)=>({content:JSON.stringify(stagedReply(input)),finish_reason:'stop'}));
    for(const [path,value] of Object.entries(fixture.files))h.stored.set(`alice:${path}`,value);
    const app=new SetPointsController(h.api,'alice');
    const before=await app.snapshot(null);expect(before.job?.error).toContain('after one shortening attempt');expect(before.resume?.available).toBe(true);
    await app.handle('resume-import',{});await app.waitForImport();
    expect((await app.snapshot(null)).job?.status).toBe('complete');expect(h.calls).toHaveLength(2);
    const input=JSON.parse(h.calls[0].messages[1].content);
    expect(input.ledger.events).toHaveLength(14);expect(input.ledger.events[13].summary).toBe('A traveler learns about the harbor. '.repeat(60).trim());
    expect(h.calls[0].messages[1].content).not.toContain('compact-existing-ledger');
    const diagnostics=JSON.stringify(await app.handle('diagnostics',{}));expect(diagnostics).toContain('Reused a saved model response');expect(diagnostics).not.toContain('A traveler learns');
  });
  test('prior versions do not pretend a failed import can be recovered',async()=>{
    const h=harness();h.stored.set('alice:workspace.json',{draft:null,saved:null,job:{id:'old',status:'failed',completed:1,total:2,label:'Failed'}});
    const app=new SetPointsController(h.api,'alice');expect((await app.snapshot(null)).resume?.available).toBe(false);
    await expect(app.handle('resume-import',{})).rejects.toThrow('Earlier versions');expect(h.calls).toHaveLength(0);
  });
  test('upgrades the published 0.1.4 output-limit failure using old reading and new staged settings',async()=>{
    const fixture=await Bun.file(new URL('./fixtures/output-limit-v014.json',import.meta.url)).json() as {files:Record<string,string>};
    const h=harness(async input=>({content:JSON.stringify(stagedReply(input)),finish_reason:'stop'}));
    for(const [path,value] of Object.entries(fixture.files))h.stored.set(`alice:${path}`,value);
    const app=new SetPointsController(h.api,'alice');
    expect((await app.snapshot(null)).job?.error).toContain('OUTPUT_LIMIT');
    await app.handle('resume-import',{maxOutputTokens:32000,reasoningMode:'off'});await app.waitForImport();
    const view=await app.snapshot(null);
    expect(view.job?.status).toBe('complete');expect(h.calls).toHaveLength(2);
    expect(h.calls.map(call=>JSON.parse(call.messages[1].content).task)).toEqual(['set-points-plan-v1','set-points-scenes-v1']);
    for(const call of h.calls){expect(call.parameters.max_tokens).toBe(32000);expect(call.reasoning).toEqual({source:'off'});}
    expect(view.resume).toMatchObject({maxOutputTokens:32000,reasoningMode:'off'});
    expect(view.diagnostics.join(' ')).toContain('Reused a saved model response');
  });
  test('changed allowance retries a truncated reading step once and persists reasoning choice',async()=>{
    const ledger={coveredChunks:['chunk:1'],premise:'A traveler seeks a lighthouse.',cast:[],setting:[],events:[{title:'Arrival',summary:'A traveler reaches a harbor.',participants:[],changes:'A journey begins.',sourceRefs:['chunk:1']}],warnings:[]};
    let first=true;
    const h=harness(async input=>{if(first){first=false;return {content:'',finish_reason:'length'};}return {content:JSON.stringify(input.messages[1].content.startsWith('SOURCE CHUNK')?ledger:stagedReply(input)),finish_reason:'stop'};});
    const app=new SetPointsController(h.api,'alice');await app.handle('start-import',{options});await app.waitForImport();
    expect(h.calls).toHaveLength(1);expect((await app.snapshot(null)).job?.phase).toContain('Reading source section');
    const resumed=new SetPointsController(h.api,'alice');await resumed.handle('resume-import',{maxOutputTokens:64000,reasoningMode:'low'});await resumed.waitForImport();
    expect((await resumed.snapshot(null)).job?.status).toBe('complete');expect(h.calls).toHaveLength(4);
    expect(h.calls[0].parameters.max_tokens).toBe(16000);expect(h.calls[0]).not.toHaveProperty('reasoning');
    for(const call of h.calls.slice(1)){expect(call.parameters.max_tokens).toBe(64000);expect(call.reasoning).toEqual({source:'custom',apiReasoning:true,effort:'low'});}
  });
  test('new staged requests cannot bypass an uncertain final request saved by published 0.1.4',async()=>{
    const fixture=await Bun.file(new URL('./fixtures/uncertain-final-v014.json',import.meta.url)).json() as {files:Record<string,string>};
    const h=harness(async input=>({content:JSON.stringify(stagedReply(input)),finish_reason:'stop'}));
    for(const [path,value] of Object.entries(fixture.files))h.stored.set(`alice:${path}`,value);
    const app=new SetPointsController(h.api,'alice');
    await app.handle('resume-import',{maxOutputTokens:32000,reasoningMode:'off'});await app.waitForImport();
    expect(h.calls).toHaveLength(0);expect((await app.snapshot(null)).resume?.retryUncertain).toBe(true);
    await app.handle('resume-import',{maxOutputTokens:32000,reasoningMode:'off',retryUncertain:true});await app.waitForImport();
    expect((await app.snapshot(null)).job?.status).toBe('complete');expect(h.calls).toHaveLength(2);
  });
  test('changing settings after a scene truncation reuses completed reading and plan across restart',async()=>{
    const ledger={coveredChunks:['chunk:1'],premise:'A traveler seeks a lighthouse.',cast:[],setting:[],events:[{title:'Arrival',summary:'A traveler reaches a harbor.',participants:[],changes:'A journey begins.',sourceRefs:['chunk:1']}],warnings:[]};
    let failScene=true;
    const h=harness(async input=>{
      if(input.messages[1].content.startsWith('SOURCE CHUNK'))return {content:JSON.stringify(ledger),finish_reason:'stop'};
      if(JSON.parse(input.messages[1].content).task==='set-points-scenes-v1'&&failScene)return {content:'{"scenes":[',finish_reason:'length'};
      return {content:JSON.stringify(stagedReply(input)),finish_reason:'stop'};
    });
    const app=new SetPointsController(h.api,'alice');await app.handle('start-import',{options});await app.waitForImport();
    expect(h.calls).toHaveLength(3);expect((await app.snapshot(null)).job?.status).toBe('failed');
    failScene=false;const resumed=new SetPointsController(h.api,'alice');await resumed.handle('resume-import',{maxOutputTokens:32000,reasoningMode:'off'});await resumed.waitForImport();
    expect((await resumed.snapshot(null)).job?.status).toBe('complete');expect(h.calls).toHaveLength(4);
    expect(JSON.parse(h.calls[3].messages[1].content).task).toBe('set-points-scenes-v1');
  });
  test('changed response settings cannot bypass an uncertain paid reading attempt',async()=>{
    const h=harness(async()=>{throw new Error('fetch failed');}),app=new SetPointsController(h.api,'alice');
    await app.handle('start-import',{options});await app.waitForImport();expect(h.calls).toHaveLength(1);
    const resumed=new SetPointsController(h.api,'alice');await resumed.handle('resume-import',{maxOutputTokens:64000,reasoningMode:'off'});await resumed.waitForImport();
    expect(h.calls).toHaveLength(1);expect((await resumed.snapshot(null)).resume?.retryUncertain).toBe(true);
  });
  test.each([{maxOutputTokens:0},{maxOutputTokens:1000000},{maxOutputTokens:'32000'},{reasoningMode:'maximum'}])('rejects invalid import response controls before billing (%j)',async settings=>{
    const h=harness(),app=new SetPointsController(h.api,'alice');
    await expect(app.handle('start-import',{options:{...options,...settings}})).rejects.toThrow('Choose');expect(h.calls).toHaveLength(0);
  });
  test('a lost response requires the explicitly warned retry instead of silently paying again',async()=>{
    const ledger={coveredChunks:['chunk:1'],premise:'A traveler seeks a lighthouse.',cast:[],setting:[],events:[{title:'Arrival',summary:'A traveler reaches the harbor.',participants:[],changes:'A journey begins.',sourceRefs:['chunk:1']}],warnings:[]};
    let first=true;
    const h=harness(async(input)=>{if(first){first=false;throw new Error('fetch failed');}return {content:JSON.stringify(input.messages[1].content.startsWith('SOURCE CHUNK')?ledger:stagedReply(input)),finish_reason:'stop'};});
    const app=new SetPointsController(h.api,'alice');await app.handle('start-import',{options});await app.waitForImport();
    expect(h.calls).toHaveLength(1);expect((await app.snapshot(null)).resume).toMatchObject({available:true,retryUncertain:true});
    await app.handle('resume-import',{});await app.waitForImport();expect(h.calls).toHaveLength(1);
    await app.handle('resume-import',{retryUncertain:true});await app.waitForImport();
    expect(h.calls).toHaveLength(4);expect((await app.snapshot(null)).job?.status).toBe('complete');
  });
  test('resume stops before billing if the saved connection profile changed',async()=>{
    const h=harness(async()=>{throw new Error('HTTP 503: unavailable');}),app=new SetPointsController(h.api,'alice');
    await app.handle('start-import',{options});await app.waitForImport();expect(h.calls).toHaveLength(1);
    Object.assign(h.api.connections,{get:async()=>({id:'model',model:'new-model',provider:'test'})});
    await expect(app.handle('resume-import',{})).rejects.toThrow('settings have changed');expect(h.calls).toHaveLength(1);
  });
  test('recovers saved source and resume metadata from a complete pending workspace write',async()=>{
    const h=harness(async()=>{throw new Error('HTTP 503: unavailable');}),first=new SetPointsController(h.api,'alice');
    await first.handle('start-import',{options});await first.waitForImport();
    h.stored.set('alice:workspace.json.tmp',h.stored.get('alice:workspace.json'));h.stored.delete('alice:workspace.json');
    const resumed=new SetPointsController(h.api,'alice');expect((await resumed.snapshot(null)).resume?.available).toBe(true);
    expect(h.stored.has('alice:workspace.json')).toBe(true);expect(h.stored.has('alice:workspace.json.tmp')).toBe(false);expect(h.calls).toHaveLength(1);
  });
  test('corrupt saved workspace blocks new paid requests instead of silently clearing progress',async()=>{
    const h=harness();h.stored.set('alice:workspace.json','{broken');
    const app=new SetPointsController(h.api,'alice');await expect(app.handle('start-import',{options})).rejects.toThrow('could not be read safely');
    expect(h.calls).toHaveLength(0);expect(h.stored.get('alice:workspace.json')).toBe('{broken');
  });
  test('failed source persistence stops before dispatch and does not leave an active job',async()=>{
    const h=harness(),app=new SetPointsController(h.api,'alice');
    Object.assign(h.api.userStorage,{write:async()=>{throw new Error('Storage unavailable');}});
    await expect(app.handle('start-import',{options})).rejects.toThrow('No model request was sent');
    expect(h.calls).toHaveLength(0);expect((await app.snapshot(null)).job?.status).toBe('failed');
  });
  test('cancel settles a nonresponsive model without replacing the previous draft',async()=>{
    const h=harness(async()=>new Promise(()=>{})),app=new SetPointsController(h.api,'alice');await app.handle('save-draft',{draft:draft()});
    await app.handle('start-import',{options});await app.handle('cancel-import',{});await app.waitForImport();
    expect((await app.snapshot(null)).job?.status).toBe('cancelled');expect((await app.snapshot(null)).draft?.id).toBe('test-draft');
  });
  test('validates connection and input before sending any model request',async()=>{
    const h=harness(),app=new SetPointsController(h.api,'alice');
    await expect(app.handle('start-import',{options:{...options,connectionId:'missing'}})).rejects.toThrow('no longer available');
    await expect(app.handle('start-import',{options:{...options,text:'short'}})).rejects.toThrow('100');expect(h.calls).toHaveLength(0);
  });
  test('isolates persisted workspaces and blocks overlapping jobs',async()=>{
    const h=harness(async()=>new Promise(()=>{})),a=new SetPointsController(h.api,'alice'),b=new SetPointsController(h.api,'bob');
    await a.handle('save-draft',{draft:draft()});expect((await b.snapshot(null)).draft).toBeNull();
    await a.handle('start-import',{options});await expect(a.handle('start-import',{options})).rejects.toThrow('already running');
    await expect(a.handle('save-draft',{draft:draft()})).rejects.toThrow('finish');a.dispose();await a.waitForImport();
  });
  test('marks interrupted jobs failed after restart and preserves completed draft',async()=>{
    const h=harness();h.stored.set('alice:workspace.json',{draft:draft(),saved:null,job:{id:'job',status:'running',completed:1,total:4,label:'Reading'} satisfies ImportJob});
    const app=new SetPointsController(h.api,'alice');const view=await app.snapshot(null);expect(view.job?.status).toBe('failed');expect(view.job?.error).toContain('restarted');expect(view.draft?.title).toBe('The Lighthouse Letter');
  });
  test('invalid saved draft is backed up and does not block a new draft',async()=>{
    const h=harness();h.stored.set('alice:workspace.json',{draft:{version:999,title:'Old draft'},saved:null,job:null});
    const app=new SetPointsController(h.api,'alice');expect((await app.snapshot(null)).draft).toBeNull();
    expect([...h.stored.keys()].some(key=>key.includes('recovery/'))).toBe(true);
    await app.handle('save-draft',{draft:draft()});expect((await app.snapshot(null)).draft?.id).toBe('test-draft');
  });
  test('generation listeners are registered after grant and removed on revocation',()=>{
    const h=harness(), grants=new Set<string>(), events=new Map<string,Function>();let changed:(detail:any)=>void=()=>{};
    Object.assign(h.api,{on:(name:string,handler:Function)=>{events.set(name,handler);return()=>events.delete(name);},onFrontendMessage:()=>()=>{},sendToFrontend:()=>{},registerInterceptor:()=>()=>{},registerMessageContentProcessor:()=>{},log:{warn:()=>{}}});
    Object.assign(h.api.permissions,{has:(name:string)=>grants.has(name),onChanged:(fn:typeof changed)=>{changed=fn;return()=>{};}});
    const dispose=setupBackend(h.api);expect(events.has('GENERATION_ENDED')).toBe(false);
    grants.add('generation');changed({permission:'generation',granted:true});expect(events.has('GENERATION_ENDED')).toBe(true);
    grants.delete('generation');changed({permission:'generation',granted:false});expect(events.has('GENERATION_ENDED')).toBe(false);dispose();expect(events.size).toBe(0);
  });
  test('page loading returns navigation without fetching another page or logging story data',async()=>{
    const h=harness(), urls:string[]=[];
    Object.assign(h.api.permissions,{has:()=>true});
    Object.assign(h.api,{cors:async(url:string)=>{urls.push(url);return {status:200,headers:{'content-type':'text/html'},body:`<html><head><title>A private source title</title><link rel="next" href="?page=2"></head><body><article>${Array.from({length:5},()=>`<p>${DEMO_STORY}</p>`).join('')}</article></body></html>`};}});
    const app=new SetPointsController(h.api,'alice');
    const page=await app.handle('fetch-url',{url:'https://example.com/story?page=1'}) as WebStoryPage;
    expect(urls).toEqual(['https://example.com/story?page=1']);
    expect(page.nextPages.map(link=>link.url)).toEqual(['https://example.com/story?page=2']);
    expect(page.text).toContain('Mara');
    const messages=JSON.stringify((await app.snapshot(null)).diagnostics);
    expect(messages).not.toContain('Mara');expect(messages).not.toContain('private source');expect(messages).not.toContain('example.com');
  });
  test('page loading requires permission and rejects non-public sources before fetching',async()=>{
    const h=harness();let calls=0;Object.assign(h.api,{cors:async()=>{calls++;return {};}});
    const app=new SetPointsController(h.api,'alice');
    await expect(app.handle('fetch-url',{url:'https://example.com/story'})).rejects.toThrow('cors_proxy');
    Object.assign(h.api.permissions,{has:()=>true});
    await expect(app.handle('fetch-url',{url:'http://127.0.0.1/story'})).rejects.toThrow('public');
    expect(calls).toBe(0);
  });
});
