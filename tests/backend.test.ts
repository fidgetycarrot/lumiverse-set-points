import { describe, expect, spyOn, test } from 'bun:test';
import type { SpindleAPI } from 'lumiverse-spindle-types';
import { SetPointsController, setupBackend } from '../src/backend';
import { draft } from './fixtures';
import { DEMO_STORY, type ImportOptions, type ImportJob, type WebStoryPage } from '../src/types';

const options:ImportOptions={text:DEMO_STORY,sourceTitle:'The Lighthouse Letter',playerRole:'Mara',startingPoint:'The harbor',sceneCount:4,chunkSize:12000,connectionId:'model'};
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
      return {content:JSON.stringify(input.messages[1].content.startsWith('SOURCE CHUNK')?ledger:draft()),finish_reason:'stop'};
    });
    Object.assign(h.api.connections,{get:async()=>({id:'model',name:'Private connection',provider,model,api_url:'https://private.example',has_api_key:true})});
    const app=new SetPointsController(h.api,'alice');
    await app.handle('start-import',{options});await app.waitForImport();
    const view=await app.snapshot(null);
    expect(view.job?.status).toBe('complete');expect(view.draft?.scenes).toHaveLength(2);expect(h.calls).toHaveLength(2);
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
      return {content:JSON.stringify(draft()),finish_reason:'stop'};
    });
    const first=new SetPointsController(h.api,'alice');await first.handle('start-import',{options});await first.waitForImport();
    expect(h.calls).toHaveLength(2);expect((await first.snapshot(null)).resume?.available).toBe(true);
    failing=false;
    const resumed=new SetPointsController(h.api,'alice');await resumed.handle('resume-import',{});await resumed.waitForImport();
    expect((await resumed.snapshot(null)).job?.status).toBe('complete');expect(h.calls).toHaveLength(3);
    expect(h.calls.filter(call=>call.messages[1].content.startsWith('SOURCE CHUNK'))).toHaveLength(1);
    expect((await resumed.snapshot(null)).diagnostics.join(' ')).toContain('Reused a saved model response');
    expect(JSON.stringify(await resumed.handle('diagnostics',{}))).not.toContain('Mara');
  });
  test('keeps an oversized paid ledger across restart without making a shortening request',async()=>{
    const events=Array.from({length:14},(_,index)=>({title:`Event ${index+1}`,summary:'A traveler learns about the harbor. '.repeat(60),participants:[],changes:'A new lead.',sourceRefs:['chunk:1']}));
    const oversized={coveredChunks:['chunk:1'],premise:'A traveler seeks a lighthouse.',cast:[],setting:[],events,warnings:[]};
    expect(JSON.stringify(oversized).length).toBeGreaterThan(24000);
    let call=0;
    const h=harness(async()=>{
      call++;if(call===2)throw new Error('OpenRouter generate failed (503): unavailable');
      return {content:JSON.stringify(call===1?oversized:draft()),finish_reason:'stop'};
    });
    const first=new SetPointsController(h.api,'alice');await first.handle('start-import',{options});await first.waitForImport();
    expect(h.calls).toHaveLength(2);expect((await first.snapshot(null)).job?.status).toBe('failed');
    const resumed=new SetPointsController(h.api,'alice');await resumed.handle('resume-import',{});await resumed.waitForImport();
    expect((await resumed.snapshot(null)).job?.status).toBe('complete');expect(h.calls).toHaveLength(3);
    expect(h.calls.filter(input=>input.messages[1].content.startsWith('SOURCE CHUNK'))).toHaveLength(1);
    expect(h.calls.every(input=>!input.messages[1].content.includes('compact-existing-ledger'))).toBe(true);
    expect(JSON.parse(h.calls[2].messages[1].content).ledger.events).toEqual(events.map(event=>({...event,summary:event.summary.trim()})));
  });
  test('upgrades the actual 0.1.3 shortening-failure checkpoint without repurchasing reading or shortening',async()=>{
    const fixture=await Bun.file(new URL('./fixtures/recovery-v013.json',import.meta.url)).json() as {files:Record<string,string>};
    const h=harness(async()=>({content:JSON.stringify(draft()),finish_reason:'stop'}));
    for(const [path,value] of Object.entries(fixture.files))h.stored.set(`alice:${path}`,value);
    const app=new SetPointsController(h.api,'alice');
    const before=await app.snapshot(null);expect(before.job?.error).toContain('after one shortening attempt');expect(before.resume?.available).toBe(true);
    await app.handle('resume-import',{});await app.waitForImport();
    expect((await app.snapshot(null)).job?.status).toBe('complete');expect(h.calls).toHaveLength(1);
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
  test('a lost response requires the explicitly warned retry instead of silently paying again',async()=>{
    const ledger={coveredChunks:['chunk:1'],premise:'A traveler seeks a lighthouse.',cast:[],setting:[],events:[{title:'Arrival',summary:'A traveler reaches the harbor.',participants:[],changes:'A journey begins.',sourceRefs:['chunk:1']}],warnings:[]};
    let first=true;
    const h=harness(async(input)=>{if(first){first=false;throw new Error('fetch failed');}return {content:JSON.stringify(input.messages[1].content.startsWith('SOURCE CHUNK')?ledger:draft()),finish_reason:'stop'};});
    const app=new SetPointsController(h.api,'alice');await app.handle('start-import',{options});await app.waitForImport();
    expect(h.calls).toHaveLength(1);expect((await app.snapshot(null)).resume).toEqual({available:true,retryUncertain:true});
    await app.handle('resume-import',{});await app.waitForImport();expect(h.calls).toHaveLength(1);
    await app.handle('resume-import',{retryUncertain:true});await app.waitForImport();
    expect(h.calls).toHaveLength(3);expect((await app.snapshot(null)).job?.status).toBe('complete');
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
