import { afterEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import type { SpindleFrontendContext } from 'lumiverse-spindle-types';
import { createRpc, setup } from '../src/frontend';
import { validateDraft } from '../src/importer';
import type { AppSnapshot, StoryDraft, WebStoryPage } from '../src/types';

const cleanups:Array<()=>void>=[];
afterEach(()=>{for(const fn of cleanups.splice(0))fn();});
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
const fixture=():StoryDraft=>({version:1,id:'draft-a',title:'The Letter',premise:'A missing sailor and a letter.',playerRole:'Mara',startingPoint:'The harbor',narratorInstructions:'Leave the player’s actions open.',cast:[{id:'captain',name:'Iona',aliases:[],personality:'Blunt but loyal',voice:'Direct',relationships:'Wary of Mara',knowledge:'There is a letter.',sourceRefs:['chunk:1']}],lore:[{id:'harbor',name:'Harbor',keys:['harbor'],content:'A coastal village.'}],scenes:[{id:'opening',title:'The harbor',greeting:'Iona waits at the dock.',direction:'Introduce Iona.',assumptions:[],sourceRefs:['chunk:1']},{id:'letter',title:'The letter',greeting:'An envelope lies on the table.',direction:'Guide toward the chart room.',assumptions:['The chart room has been reached.'],sourceRefs:['chunk:1']}],warnings:[],source:{title:'The Letter',characters:100,chunks:1},createdAt:1});
function harness(hasDraft=true) {
  const window=new Window({url:'https://lumiverse.example/'});
  Object.assign(globalThis,{document:window.document,HTMLInputElement:window.HTMLInputElement,HTMLTextAreaElement:window.HTMLTextAreaElement});
  const root=window.document.createElement('div');window.document.body.append(root);
  const state:AppSnapshot={version:'0.1.0',permissions:[],connections:[{id:'model',name:'Writing model',provider:'test',model:'test'}],job:null,draft:hasDraft?fixture():null,saved:null,play:{chatId:'chat',characterId:'card',title:'The Letter',enabled:true,current:0,next:1,scenes:fixture().scenes,canUndo:false,busy:false,notice:''},diagnostics:[]};
  let receive:(message:unknown)=>void=()=>{};let webFetch:((url:string)=>Promise<WebStoryPage>)|null=null;let connectionTest:((id:string)=>Promise<{message:string}>)=async()=>({message:'The provider accepted the neutral test request.'});let failure:string|null=null;let active=false;const requests:Array<{action:string;input:any}>=[];
  const ctx={ui:{registerDrawerTab:()=>({root,tabId:'set-points',setBadge:()=>{},onActivate:()=>()=>{},activate:()=>{active=true;},destroy:()=>{}}),registerInputBarAction:()=>({onClick:()=>()=>{},destroy:()=>{}})},dom:{addStyle:(css:string)=>{const style=window.document.createElement('style');style.textContent=css;window.document.head.append(style);return()=>style.remove();}},events:{on:()=>()=>{}},getActiveChat:()=>({chatId:'chat',characterId:'card'}),ready:()=>{},onBackendMessage:(callback:(message:unknown)=>void)=>{receive=callback;return()=>{receive=()=>{};};},sendToBackend:(message:any)=>{requests.push(message);queueMicrotask(()=>{
    if(failure&&message.action!=='snapshot'){receive({type:'set-points:response',id:message.id,error:failure});return;}
    if(message.action==='test-connection'){Promise.resolve().then(()=>connectionTest(message.input.connectionId)).then(result=>receive({type:'set-points:response',id:message.id,result}),error=>receive({type:'set-points:response',id:message.id,error:error instanceof Error?error.message:String(error)}));return;}
    if(message.action==='fetch-url'){Promise.resolve().then(()=>{if(!webFetch)throw new Error('No readable page');return webFetch(message.input.url);}).then(result=>receive({type:'set-points:response',id:message.id,result}),error=>receive({type:'set-points:response',id:message.id,error:error instanceof Error?error.message:String(error)}));return;}
    let result:unknown;
    if(message.action==='snapshot')result=structuredClone(state);
    else if(message.action==='save-draft'){try{state.draft=validateDraft(message.input.draft);result=state.draft;}catch(error){receive({type:'set-points:response',id:message.id,error:error instanceof Error?error.message:String(error)});return;}}
    else if(message.action==='start-import'||message.action==='resume-import'){state.resume={available:false,retryUncertain:false};state.job={id:'job-a',status:'running',completed:0,total:3,label:'Reading section one'};result=state.job;}
    else if(message.action==='cancel-import'){state.job={id:'job-a',status:'cancelled',completed:0,total:3,label:'Cancelled'};state.resume={available:true,retryUncertain:false};}
    else if(message.action==='play-force'){state.play.current=1;state.play.next=null;state.play.canUndo=true;result=state.play;}
    receive({type:'set-points:response',id:message.id,result:structuredClone(result)});
  });}} as unknown as SpindleFrontendContext;
  const dispose=setup(ctx);cleanups.push(dispose);
  const button=(text:string)=>Array.from(root.querySelectorAll('button')).find(item=>item.textContent?.includes(text)) as unknown as HTMLButtonElement;
  const field=(label:string)=>{const caption=Array.from(root.querySelectorAll('label')).find(item=>item.textContent===label)!;return root.querySelector(`#${caption.htmlFor}`) as unknown as HTMLInputElement;};
  const input=(label:string,value:string)=>{const el=field(label);el.value=value;el.dispatchEvent(new window.Event('input',{bubbles:true}) as unknown as Event);return el;};
  const openDraft=(text:string)=>{const input=root.querySelector('input[accept=".json,application/json"]')!;Object.defineProperty(input,'files',{configurable:true,value:[new window.File([text],'saved-draft.json',{type:'application/json'})]});input.dispatchEvent(new window.Event('change',{bubbles:true}));};
  return {root,state,requests,button,field,input,openDraft,setConnectionTest:(checker:(id:string)=>Promise<{message:string}>)=>{connectionTest=checker;},setPages:(fetcher:(url:string)=>Promise<WebStoryPage>)=>{webFetch=fetcher;},fail:(message:string)=>{failure=message;},changed:()=>receive({type:'set-points:changed'}),window,active:()=>active,dispose};
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


const webUrl=(index:number)=>`https://stories.example/neutral/${index}`;
const webPage=(index:number,next:number|null=null):WebStoryPage=>({title:`Neutral story · part ${index}`,text:`The unique story passage for part ${index}. A traveler reaches another unfamiliar shore.`,url:webUrl(index),nextPages:next===null?[]:[{title:'Next page',url:webUrl(next)}]});

describe('web collection workspace',()=>{
  test('stages linked pages and preserves source edits until explicit Use collected text',async()=>{
    const app=harness();await tick();app.input('Story text','My original source');app.input('Story title','My original title');app.input('Story link',webUrl(1));
    app.setPages(async url=>{const index=Number(url.split('/').at(-1));return webPage(index,index<3?index+1:null);});
    app.button('Read linked pages').click();app.input('Story text','An edit made during loading');app.input('Story title','A title edited during loading');await tick();
    expect(app.field('Story text').value).toBe('An edit made during loading');expect(app.field('Story title').value).toBe('A title edited during loading');
    expect(app.root.textContent).toContain('3 pages collected');expect(app.root.textContent).toContain('No next-page link found; check completeness.');
    expect(app.requests.filter(item=>item.action==='fetch-url').map(item=>item.input.url)).toEqual([webUrl(1),webUrl(2),webUrl(3)]);
    expect(app.requests.some(item=>item.action==='start-import')).toBe(false);
    app.button('Use collected text').click();expect(app.field('Story title').value).toBe('Neutral story · part 1');expect(app.field('Story text').value).toContain('--- Page 3:');
  });
  test('single-page import is staged too and ignores discovered continuation links',async()=>{
    const app=harness();await tick();app.input('Story text','Keep this source');app.input('Story link',webUrl(1));app.setPages(async()=>webPage(1,2));
    app.button('Read page').click();await tick();expect(app.field('Story text').value).toBe('Keep this source');expect(app.requests.filter(item=>item.action==='fetch-url')).toHaveLength(1);expect(app.root.textContent).toContain('One page loaded.');
    app.button('Use collected text').click();expect(app.field('Story text').value).toContain('story passage for part 1');
  });
  test('unapplied page links cannot change the source attribution of existing text',async()=>{
    const app=harness();await tick();app.button('Try a sample').click();app.input('Story link',webUrl(1));app.setPages(async()=>webPage(1));
    app.button('Read page').click();await tick();app.button('Create adaptation').click();await tick();
    expect(app.requests.find(item=>item.action==='start-import')?.input.options.sourceUrl).toBeUndefined();
    app.button('Cancel import').click();await tick();app.button('Use collected text').click();app.input('Story link',webUrl(2));
    app.button('Create adaptation').click();await tick();expect(app.requests.filter(item=>item.action==='start-import').at(-1)?.input.options.sourceUrl).toBe(webUrl(1));
  });
  test('cancel retains a staged prefix, prevents overlap, and ignores a late page response',async()=>{
    const app=harness();await tick();app.input('Story text','Keep my source');app.input('Story link',webUrl(1));
    let late!:(page:WebStoryPage)=>void;app.setPages(async url=>url===webUrl(1)?webPage(1,2):new Promise(resolve=>{late=resolve;}));
    app.button('Read linked pages').click();await tick();expect(app.button('Read page').disabled).toBe(true);expect(app.button('Read linked pages').disabled).toBe(true);expect(app.button('Create adaptation').disabled).toBe(true);
    app.button('Create adaptation').click();app.button('Read page').click();expect(app.requests.some(item=>item.action==='start-import')).toBe(false);
    app.button('Cancel loading').click();await tick();expect(app.button('Read page').disabled).toBe(false);expect(app.button('Create adaptation').disabled).toBe(false);expect(app.field('Story text').value).toBe('Keep my source');expect(app.root.textContent).toContain('1 page collected');
    late(webPage(2));await tick();expect(app.root.textContent).not.toContain('2 pages collected');app.button('Use collected text').click();expect(app.field('Story text').value).not.toContain('part 2');
  });
  test('initial failure preserves text and has no apply action; later failure keeps partial pages',async()=>{
    const app=harness();await tick();app.input('Story text','Keep me');app.input('Story title','Keep title');app.input('Story link',webUrl(1));app.setPages(async()=>{throw new Error('Site refused the page');});
    app.button('Read linked pages').click();await tick();expect(app.button('Use collected text').hidden).toBe(true);expect(app.field('Story text').value).toBe('Keep me');expect(app.field('Story title').value).toBe('Keep title');expect(app.root.textContent).toContain('Site refused the page');
    app.setPages(async url=>{if(url===webUrl(1))return webPage(1,2);throw new Error('Next page unavailable');});app.button('Read linked pages').click();await tick();
    expect(app.root.textContent).toContain('1 page collected');expect(app.root.textContent).toContain('Next page unavailable');expect(app.button('Use collected text').hidden).toBe(false);expect(app.field('Story text').value).toBe('Keep me');
  });
  test('manual page links are sent in order and adaptation disables page loading',async()=>{
    const app=harness();await tick();app.input('Story link',webUrl(1));app.input('Other page links',`${webUrl(3)}\n${webUrl(2)}`);app.setPages(async url=>webPage(Number(url.split('/').at(-1)),9));
    app.button('Read linked pages').click();await tick();expect(app.requests.filter(item=>item.action==='fetch-url').map(item=>item.input.url)).toEqual([webUrl(1),webUrl(3),webUrl(2)]);
    app.button('Use collected text').click();app.button('Create adaptation').click();expect(app.button('Read page').disabled).toBe(true);await tick();expect(app.button('Read linked pages').disabled).toBe(true);
    app.button('Cancel import').click();await tick();expect(app.button('Read linked pages').disabled).toBe(false);
  });
  test('teardown cancels pending collection and late replies cannot overwrite source',async()=>{
    const app=harness();await tick();app.input('Story text','Survives closing');app.input('Story link',webUrl(1));let late!:(page:WebStoryPage)=>void;app.setPages(async()=>new Promise(resolve=>{late=resolve;}));
    app.button('Read linked pages').click();await tick();const source=app.field('Story text');app.dispose();late(webPage(1));await tick();expect(source.value).toBe('Survives closing');expect(app.root.querySelector('.sp-app')).toBeNull();
  });
});


describe('neutral connection check',()=>{
  test('sends only the selected connection ID and preserves story, review edits, and staged pages',async()=>{
    const app=harness();await tick();app.state.connections.push({id:'second-model',name:'Second model',provider:'test',model:'second'});app.changed();await tick();
    app.input('Story text','A private story passage');app.input('Story title','My private title');app.button('Review').click();app.input('Premise','My unsaved review edit');app.button('Import').click();
    app.input('Story link',webUrl(1));app.setPages(async()=>webPage(1));app.button('Read page').click();await tick();
    app.input('Adaptation connection','second-model');app.button('Check connection').click();await tick();
    const request=app.requests.find(item=>item.action==='test-connection');expect(request?.input).toEqual({connectionId:'second-model'});expect(JSON.stringify(request)).not.toContain('private');
    expect(app.field('Story text').value).toBe('A private story passage');expect(app.field('Story title').value).toBe('My private title');expect(app.field('Premise').value).toBe('My unsaved review edit');expect(app.root.textContent).toContain('1 page collected');expect(app.button('Use collected text').hidden).toBe(false);
    const statuses=Array.from(app.root.querySelectorAll('[role="status"]')).map(item=>item.textContent).join(' ');expect(statuses).toContain('provider accepted');expect(statuses).toContain('does not guarantee');expect(app.root.textContent).toContain('Normal model charges apply.');
  });
  test('prevents overlapping checks and adaptation while a request is pending',async()=>{
    const app=harness();await tick();app.input('Story text','Keep this text');let accept!:(result:{message:string})=>void;app.setConnectionTest(async()=>new Promise(resolve=>{accept=resolve;}));
    app.button('Check connection').click();app.button('Check connection').click();await tick();expect(app.button('Check connection').disabled).toBe(true);expect(app.button('Create adaptation').disabled).toBe(true);expect(app.button('Read linked pages').disabled).toBe(true);
    app.button('Create adaptation').click();expect(app.requests.filter(item=>item.action==='test-connection')).toHaveLength(1);expect(app.requests.some(item=>item.action==='start-import')).toBe(false);
    accept({message:'The provider accepted the neutral test request.'});await tick();expect(app.button('Check connection').disabled).toBe(false);expect(app.button('Create adaptation').disabled).toBe(false);expect(app.field('Story text').value).toBe('Keep this text');
  });
  test('safe backend errors remain accessible and allow another check without losing edits',async()=>{
    const app=harness();await tick();app.input('Story text','Keep these edited words');app.setConnectionTest(async()=>{throw new Error('The provider denied this request (HTTP 403). Check account access and model permissions.');});
    app.button('Check connection').click();await tick();const error=app.root.querySelector('[role="status"][data-kind="error"]');expect(error?.textContent).toContain('HTTP 403');expect(error?.getAttribute('aria-live')).toBe('polite');expect(app.button('Check connection').disabled).toBe(false);expect(app.field('Story text').value).toBe('Keep these edited words');
    app.setConnectionTest(async()=>({message:'The provider accepted the neutral test request.'}));app.button('Check connection').click();await tick();expect(app.root.querySelector('[role="status"][data-kind="error"]')).toBeNull();
  });
  test('is unavailable with no connection or while an adaptation runs',async()=>{
    const app=harness();await tick();app.state.connections=[];app.changed();await tick();expect(app.button('Check connection').disabled).toBe(true);
    app.state.connections=[{id:'model',name:'Model',provider:'test',model:'test'}];app.changed();await tick();app.button('Try a sample').click();app.button('Create adaptation').click();expect(app.button('Check connection').disabled).toBe(true);await tick();expect(app.button('Check connection').disabled).toBe(true);
    app.button('Cancel import').click();await tick();expect(app.button('Check connection').disabled).toBe(false);
  });
});


describe('saved import resume',()=>{
  test('resumes after reopening with an empty form using saved backend options only',async()=>{
    const app=harness();app.state.job={id:'older-job',status:'failed',completed:2,total:4,label:'Saved progress retained.'};app.state.resume={available:true,retryUncertain:false};await tick();
    expect(app.button('Resume saved import').hidden).toBe(false);expect(app.field('Story text').value).toBe('');expect(app.root.textContent).toContain('Uses the saved story and import settings');
    app.button('Resume saved import').click();await tick();expect(app.requests.find(item=>item.action==='resume-import')?.input).toEqual({maxOutputTokens:16000,reasoningMode:'inherit'});expect(app.requests.some(item=>item.action==='start-import')).toBe(false);expect(app.field('Story text').value).toBe('');
    expect(app.button('Resume saved import').hidden).toBe(true);expect(app.button('Create adaptation').disabled).toBe(true);
  });
  test('preserves current form, review edits, and staged pages when resuming a different saved import',async()=>{
    const app=harness();await tick();app.input('Story text','Different source currently being edited');app.input('Story title','New source title');app.input('Who will you play?','A new role');app.button('Review').click();app.input('Premise','An unsaved premise edit');app.button('Import').click();
    app.input('Story link',webUrl(1));app.setPages(async()=>webPage(1));app.button('Read page').click();await tick();
    app.state.job={id:'saved-job',status:'cancelled',completed:1,total:3,label:'Cancelled'};app.state.resume={available:true,retryUncertain:false};app.changed();await tick();app.button('Resume saved import').click();await tick();
    expect(app.requests.find(item=>item.action==='resume-import')?.input).toEqual({maxOutputTokens:16000,reasoningMode:'inherit'});expect(app.field('Story text').value).toBe('Different source currently being edited');expect(app.field('Story title').value).toBe('New source title');expect(app.field('Who will you play?').value).toBe('A new role');expect(app.field('Premise').value).toBe('An unsaved premise edit');expect(app.root.textContent).toContain('1 page collected');
  });
  test('unknown request outcomes require the explicitly warned retry action',async()=>{
    const app=harness();app.state.job={id:'uncertain-job',status:'failed',completed:1,total:4,label:'The request outcome is unknown.'};app.state.resume={available:true,retryUncertain:true};await tick();
    const retry=app.button('Retry unfinished request');expect(retry.hidden).toBe(false);expect(app.root.textContent).toContain('Its previous outcome is unknown and it may already have been charged. Retrying can charge that request again.');
    retry.click();await tick();expect(app.requests.find(item=>item.action==='resume-import')?.input).toEqual({maxOutputTokens:16000,reasoningMode:'inherit',retryUncertain:true});
  });
  test('resume errors retain edits and leave retry available while busy checks disable it',async()=>{
    const app=harness();app.state.job={id:'saved-job',status:'failed',completed:1,total:4,label:'Failed'};app.state.resume={available:true,retryUncertain:false};await tick();app.input('Story text','Keep current edits');app.fail('Saved import could not resume.');app.button('Resume saved import').click();await tick();
    expect(app.field('Story text').value).toBe('Keep current edits');expect(app.root.querySelector('[role="status"]')?.textContent).toBe('Saved import could not resume.');expect(app.button('Resume saved import').disabled).toBe(false);
    app.fail('');let accept!:(result:{message:string})=>void;app.setConnectionTest(async()=>new Promise(resolve=>{accept=resolve;}));app.button('Check connection').click();await tick();expect(app.button('Resume saved import').disabled).toBe(true);app.button('Resume saved import').click();expect(app.requests.filter(item=>item.action==='resume-import')).toHaveLength(1);
    accept({message:'Accepted'});await tick();expect(app.button('Resume saved import').disabled).toBe(false);
  });
  test('older failed jobs without saved-import metadata do not offer recovery',async()=>{
    const app=harness();app.state.job={id:'legacy-job',status:'failed',completed:2,total:4,label:'Prior version failed'};await tick();expect(app.button('Resume saved import').hidden).toBe(true);expect(app.button('Resume saved import').disabled).toBe(true);
  });
});


describe('model response settings',()=>{
  test('new imports use explicit defaults unless the user changes the response settings',async()=>{
    const app=harness();await tick();app.button('Try a sample').click();expect(app.field('Response allowance').value).toBe('16000');expect(app.field('Reasoning mode').value).toBe('inherit');
    app.button('Create adaptation').click();await tick();let options=app.requests.find(item=>item.action==='start-import')?.input.options;expect(options.maxOutputTokens).toBe(16000);expect(options.reasoningMode).toBe('inherit');
    app.button('Cancel import').click();await tick();app.input('Response allowance','32000');app.input('Reasoning mode','off');expect(app.requests.filter(item=>item.action==='start-import')).toHaveLength(1);
    app.button('Create adaptation').click();await tick();options=app.requests.filter(item=>item.action==='start-import').at(-1)?.input.options;expect(options.maxOutputTokens).toBe(32000);expect(options.reasoningMode).toBe('off');
    expect(app.root.textContent).toContain('may cost more or be rejected by your provider');
  });
  test('resume uses saved response choices independently from the current import form',async()=>{
    const app=harness();app.state.job={id:'saved-settings',status:'failed',completed:3,total:5,label:'Failed',error:'Output limit reached',phase:'Building the narrator profile'};app.state.resume={available:true,retryUncertain:false,maxOutputTokens:32000,reasoningMode:'low'};await tick();
    expect(app.field('Unfinished response allowance').value).toBe('32000');expect(app.field('Unfinished reasoning mode').value).toBe('low');expect(app.root.textContent).toContain('Stopped during Building the narrator profile. Output limit reached');
    app.input('Story text','Different new source');app.input('Response allowance','8000');app.input('Reasoning mode','off');app.button('Resume saved import').click();await tick();
    expect(app.requests.find(item=>item.action==='resume-import')?.input).toEqual({maxOutputTokens:32000,reasoningMode:'low'});expect(app.field('Story text').value).toBe('Different new source');expect(app.field('Response allowance').value).toBe('8000');
  });
  test('unfinished settings survive background refresh and are sent only on deliberate resume',async()=>{
    const app=harness();app.state.job={id:'saved-settings',status:'failed',completed:2,total:4,label:'Failed'};app.state.resume={available:true,retryUncertain:false,maxOutputTokens:16000,reasoningMode:'inherit'};await tick();
    app.input('Unfinished response allowance','64000');app.input('Unfinished reasoning mode','off');app.changed();await tick();
    expect(app.field('Unfinished response allowance').value).toBe('64000');expect(app.field('Unfinished reasoning mode').value).toBe('off');expect(app.requests.some(item=>item.action==='resume-import')).toBe(false);expect(app.root.textContent).toContain('Completed steps are reused even when you change the response settings');
    app.button('Resume saved import').click();await tick();expect(app.requests.find(item=>item.action==='resume-import')?.input).toEqual({maxOutputTokens:64000,reasoningMode:'off'});
  });
  test('a different failed job loads its own saved settings and retains explicit uncertain retry consent',async()=>{
    const app=harness();app.state.job={id:'first-job',status:'failed',completed:1,total:4,label:'Failed'};app.state.resume={available:true,retryUncertain:false,maxOutputTokens:16000,reasoningMode:'inherit'};await tick();app.input('Unfinished response allowance','64000');
    app.state.job={id:'second-job',status:'failed',completed:2,total:5,label:'Failed'};app.state.resume={available:true,retryUncertain:true,maxOutputTokens:8000,reasoningMode:'low'};app.changed();await tick();expect(app.field('Unfinished response allowance').value).toBe('8000');expect(app.field('Unfinished reasoning mode').value).toBe('low');
    app.button('Retry unfinished request').click();await tick();expect(app.requests.find(item=>item.action==='resume-import')?.input).toEqual({maxOutputTokens:8000,reasoningMode:'low',retryUncertain:true});
  });
  test('busy operations disable response settings and resume errors preserve chosen overrides',async()=>{
    const app=harness();app.state.job={id:'saved-settings',status:'failed',completed:1,total:4,label:'Failed'};app.state.resume={available:true,retryUncertain:false};await tick();
    app.input('Unfinished response allowance','32000');app.input('Unfinished reasoning mode','low');app.fail('The provider rejected these settings.');app.button('Resume saved import').click();await tick();expect(app.field('Unfinished response allowance').value).toBe('32000');expect(app.field('Unfinished reasoning mode').value).toBe('low');expect(app.button('Resume saved import').disabled).toBe(false);
    app.fail('');let accept!:(value:{message:string})=>void;app.setConnectionTest(async()=>new Promise(resolve=>{accept=resolve;}));app.button('Check connection').click();await tick();expect(app.field('Response allowance').disabled).toBe(true);expect(app.field('Unfinished reasoning mode').disabled).toBe(true);
    accept({message:'Accepted'});await tick();expect(app.field('Response allowance').disabled).toBe(false);expect(app.field('Unfinished reasoning mode').disabled).toBe(false);
  });
});
