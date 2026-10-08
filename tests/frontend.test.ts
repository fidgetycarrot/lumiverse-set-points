import { afterEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import type { SpindleFrontendContext } from 'lumiverse-spindle-types';
import { createRpc, setup } from '../src/frontend';
import { validateDraft } from '../src/importer';
import type { AppSnapshot, StoryDraft } from '../src/types';

const cleanups:Array<()=>void>=[];
afterEach(()=>{for(const fn of cleanups.splice(0))fn();});
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
const fixture=():StoryDraft=>({version:1,id:'draft-a',title:'The Letter',premise:'A missing sailor and a letter.',playerRole:'Mara',startingPoint:'The harbor',narratorInstructions:'Leave the player’s actions open.',cast:[{id:'captain',name:'Iona',aliases:[],personality:'Blunt but loyal',voice:'Direct',relationships:'Wary of Mara',knowledge:'There is a letter.',sourceRefs:['chunk:1']}],lore:[{id:'harbor',name:'Harbor',keys:['harbor'],content:'A coastal village.'}],scenes:[{id:'opening',title:'The harbor',greeting:'Iona waits at the dock.',direction:'Introduce Iona.',assumptions:[],sourceRefs:['chunk:1']},{id:'letter',title:'The letter',greeting:'An envelope lies on the table.',direction:'Guide toward the chart room.',assumptions:['The chart room has been reached.'],sourceRefs:['chunk:1']}],warnings:[],source:{title:'The Letter',characters:100,chunks:1},createdAt:1});
function harness(hasDraft=true) {
  const window=new Window({url:'https://lumiverse.example/'});
  Object.assign(globalThis,{document:window.document,HTMLInputElement:window.HTMLInputElement,HTMLTextAreaElement:window.HTMLTextAreaElement});
  const root=window.document.createElement('div');window.document.body.append(root);
  const state:AppSnapshot={version:'0.1.0',permissions:[],connections:[{id:'model',name:'Writing model',provider:'test',model:'test'}],job:null,draft:hasDraft?fixture():null,saved:null,play:{chatId:'chat',characterId:'card',title:'The Letter',enabled:true,current:0,next:1,scenes:fixture().scenes,canUndo:false,busy:false,notice:''},diagnostics:[]};
  let receive:(message:unknown)=>void=()=>{};let failure:string|null=null;let active=false;const requests:Array<{action:string;input:any}>=[];
  const ctx={ui:{registerDrawerTab:()=>({root,tabId:'set-points',setBadge:()=>{},onActivate:()=>()=>{},activate:()=>{active=true;},destroy:()=>{}}),registerInputBarAction:()=>({onClick:()=>()=>{},destroy:()=>{}})},dom:{addStyle:(css:string)=>{const style=window.document.createElement('style');style.textContent=css;window.document.head.append(style);return()=>style.remove();}},events:{on:()=>()=>{}},getActiveChat:()=>({chatId:'chat',characterId:'card'}),ready:()=>{},onBackendMessage:(callback:(message:unknown)=>void)=>{receive=callback;return()=>{receive=()=>{};};},sendToBackend:(message:any)=>{requests.push(message);queueMicrotask(()=>{
    if(failure&&message.action!=='snapshot'){receive({type:'set-points:response',id:message.id,error:failure});return;}
    let result:unknown;
    if(message.action==='snapshot')result=structuredClone(state);
    else if(message.action==='save-draft'){try{state.draft=validateDraft(message.input.draft);result=state.draft;}catch(error){receive({type:'set-points:response',id:message.id,error:error instanceof Error?error.message:String(error)});return;}}
    else if(message.action==='start-import'){state.job={id:'job-a',status:'running',completed:0,total:3,label:'Reading section one'};result=state.job;}
    else if(message.action==='cancel-import'){state.job={id:'job-a',status:'cancelled',completed:0,total:3,label:'Cancelled'};}
    else if(message.action==='play-force'){state.play.current=1;state.play.next=null;state.play.canUndo=true;result=state.play;}
    receive({type:'set-points:response',id:message.id,result:structuredClone(result)});
  });}} as unknown as SpindleFrontendContext;
  const dispose=setup(ctx);cleanups.push(dispose);
  const button=(text:string)=>Array.from(root.querySelectorAll('button')).find(item=>item.textContent?.includes(text)) as unknown as HTMLButtonElement;
  const field=(label:string)=>{const caption=Array.from(root.querySelectorAll('label')).find(item=>item.textContent===label)!;return root.querySelector(`#${caption.htmlFor}`) as unknown as HTMLInputElement;};
  const input=(label:string,value:string)=>{const el=field(label);el.value=value;el.dispatchEvent(new window.Event('input',{bubbles:true}) as unknown as Event);return el;};
  const openDraft=(text:string)=>{const input=root.querySelector('input[accept=".json,application/json"]')!;Object.defineProperty(input,'files',{configurable:true,value:[new window.File([text],'saved-draft.json',{type:'application/json'})]});input.dispatchEvent(new window.Event('change',{bubbles:true}));};
  return {root,state,requests,button,field,input,openDraft,fail:(message:string)=>{failure=message;},changed:()=>receive({type:'set-points:changed'}),window,active:()=>active,dispose};
}

describe('request handling',()=>{
  test('surfaces backend errors and finite timeouts',async()=>{
    let receive:(message:unknown)=>void=()=>{};let sent:any;
    const rpc=createRpc({onBackendMessage:handler=>{receive=handler;return()=>{};},sendToBackend:message=>{sent=message;}},()=>{},12);
    const request=rpc.request('save-draft');receive({type:'set-points:response',id:sent.id,error:'Draft contains no scenes'});
    await expect(request).rejects.toThrow('Draft contains no scenes');
    await expect(rpc.request('snapshot')).rejects.toThrow('did not respond in time');rpc.destroy();
  });
  test('teardown rejects pending work and unsubscribes once',async()=>{
    let unsubscribed=0;const rpc=createRpc({onBackendMessage:()=>()=>{unsubscribed++;},sendToBackend:()=>{}},()=>{});
    const request=rpc.request('snapshot');rpc.destroy();await expect(request).rejects.toThrow('closed');expect(unsubscribed).toBe(1);
  });
});

describe('Set Points workspace',()=>{
  test('preserves source and unsaved review fields across snapshots and tabs',async()=>{
    const app=harness();await tick();app.input('Story text','My unfinished source text');app.button('Review').click();
    app.input('Premise','My revised premise');app.state.draft!.premise='Backend update';app.changed();await tick();
    expect(app.field('Premise').value).toBe('My revised premise');
    app.button('Import').click();expect(app.field('Story text').value).toBe('My unfinished source text');
    app.button('Review').click();app.button('Save draft').click();await tick();
    expect(app.requests.find(item=>item.action==='save-draft')?.input.draft.premise).toBe('My revised premise');
    expect(app.root.textContent).toContain('Draft saved.');
  });
  test('retains existing review edits when a replacement import completes until deliberately loaded',async()=>{
    const app=harness();await tick();app.button('Review').click();app.input('Premise','Keep my unsaved premise');
    app.button('Import').click();app.button('Try a sample').click();app.button('Create adaptation').click();await tick();
    app.state.draft={...fixture(),id:'replacement',premise:'A different adventure.'};app.state.job={id:'job-a',status:'complete',completed:3,total:3,label:'Complete'};app.changed();await tick();
    expect(app.field('Premise').value).toBe('Keep my unsaved premise');expect(app.root.textContent).toContain('Your unsaved review edits have been kept.');
    app.button('Load new draft').click();expect(app.field('Premise').value).toBe('A different adventure.');
  });
  test('opens and validates an exported draft from the empty Review screen',async()=>{
    const app=harness(false);await tick();app.button('Review').click();expect(app.button('Open draft')).toBeDefined();
    const restored={...fixture(),title:'Restored story'};app.openDraft(JSON.stringify(restored));await tick();
    expect(app.field('Title').value).toBe('Restored story');expect(app.requests.find(item=>item.action==='save-draft')?.input.draft).toEqual(restored);
    expect(app.root.textContent).toContain('Draft opened and saved.');
  });
  test('invalid draft files keep unsaved review edits and permit another open attempt',async()=>{
    const app=harness();await tick();app.button('Review').click();app.input('Premise','Keep these edits');
    app.openDraft(JSON.stringify({...fixture(),scenes:[]}));await tick();
    expect(app.field('Premise').value).toBe('Keep these edits');expect(app.root.querySelector('[role="status"]')?.getAttribute('data-kind')).toBe('error');expect(app.button('Open draft').disabled).toBe(false);
    app.openDraft(JSON.stringify({...fixture(),title:'Working replacement'}));await tick();expect(app.field('Title').value).toBe('Working replacement');
  });
  test('unreadable and oversized draft files are rejected before sending to the backend',async()=>{
    const app=harness();await tick();app.button('Review').click();app.input('Premise','Keep these edits');
    app.openDraft('not a saved draft');await tick();expect(app.field('Premise').value).toBe('Keep these edits');expect(app.root.textContent).toContain('This file could not be read.');
    app.openDraft(' '.repeat(192_001));await tick();expect(app.root.textContent).toContain('too large');expect(app.requests.some(item=>item.action==='save-draft')).toBe(false);
  });
  test('renders story strings as text and uses active chat for snapshots',async()=>{
    const app=harness();app.state.draft!.cast[0].name='<img src=x onerror=alert(1)>';await tick();app.changed();await tick();
    expect(app.root.querySelector('img')).toBeNull();expect(app.root.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(app.requests[0].input).toEqual({chatId:'chat',characterId:'card'});
  });
  test('keeps create disabled throughout an asynchronous import and exposes cancellation',async()=>{
    const app=harness(false);await tick();app.button('Try a sample').click();app.button('Create adaptation').click();await tick();
    expect(app.button('Create adaptation').disabled).toBe(true);expect(app.root.textContent).toContain('Reading section one');
    app.button('Cancel import').click();await tick();expect(app.button('Create adaptation').disabled).toBe(false);
  });
  test('shows action errors without losing draft edits or leaving buttons disabled',async()=>{
    const app=harness();await tick();app.button('Review').click();app.input('Premise','Keep this edit');app.fail('Connection refused this request');app.button('Save draft').click();await tick();
    expect(app.root.querySelector('[role="status"]')?.textContent).toBe('Connection refused this request');expect(app.field('Premise').value).toBe('Keep this edit');expect(app.button('Save draft').disabled).toBe(false);
  });
  test('Force reflects returned scene state and end of story disables another insertion',async()=>{
    const app=harness();await tick();app.button('Play').click();await tick();app.button('Force next scene').click();await tick();
    expect(app.requests.find(item=>item.action==='play-force')?.input).toEqual({chatId:'chat'});
    expect(app.button('Force next scene').disabled).toBe(true);expect(app.button('Undo last scene').disabled).toBe(false);
  });
});
