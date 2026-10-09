import { describe, expect, test } from 'bun:test';
import type { SpindleAPI } from 'lumiverse-spindle-types';
import { SetPointsController, setupBackend } from '../src/backend';
import { draft } from './fixtures';
import { DEMO_STORY, type ImportOptions, type ImportJob, type WebStoryPage } from '../src/types';

const options:ImportOptions={text:DEMO_STORY,sourceTitle:'The Lighthouse Letter',playerRole:'Mara',startingPoint:'The harbor',sceneCount:4,chunkSize:12000,connectionId:'model'};
function harness(generate: (input:any)=>Promise<unknown> = async()=>({content:'not json',finish_reason:'stop'})) {
  const stored=new Map<string,unknown>();const calls:any[]=[];
  const api={
    permissions:{has:(name:string)=>name==='generation',getGranted:async()=>['generation']},
    userStorage:{getJson:async(path:string,opts:any)=>structuredClone(stored.get(`${opts.userId}:${path}`)??opts.fallback),setJson:async(path:string,value:unknown,opts:any)=>{stored.set(`${opts.userId}:${path}`,structuredClone(value));}},
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
    expect(h.calls.every(call=>call.userId==='alice'&&call.connection_id==='model')).toBe(true);
    expect(JSON.stringify(await app.handle('diagnostics',{}))).not.toContain('Mara');
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
