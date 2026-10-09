import type { SpindleFrontendContext } from 'lumiverse-spindle-types';
import { DEMO_STORY, VERSION, type AppSnapshot, type ImportJob, type ImportOptions, type ResponseMessage, type SavedStory, type SceneView, type StoryDraft, type WebStoryPage } from './types';
import { styles } from './styles';
import { collectStoryPages, type WebCollection, type WebCollectionProgress } from './web-import';

const MAX_SOURCE = 500_000;
const MAX_DRAFT = 192_000;
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><path d="M6 8v6a5 5 0 0 0 5 5h4M9 5h9"/></svg>';
type RpcContext = Pick<SpindleFrontendContext, 'sendToBackend'|'onBackendMessage'>;

/** Requests have a finite lifetime even if the backend stops or reloads. */
export function createRpc(ctx: RpcContext, onChanged: () => void, timeoutMs = 45_000) {
  let sequence = 0;
  const instance = Math.random().toString(36).slice(2);
  let disposed = false;
  const pending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  const off = ctx.onBackendMessage((payload) => {
    if (!payload || typeof payload !== 'object') return;
    const message = payload as Partial<ResponseMessage>;
    if ((message as {type?:string}).type === 'set-points:changed') { onChanged(); return; }
    if (message.type !== 'set-points:response' || typeof message.id !== 'string') return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error)); else request.resolve(message.result);
  });
  return {
    request<T>(action: string, input?: unknown, requestTimeoutMs = timeoutMs): Promise<T> {
      if (disposed) return Promise.reject(new Error('Set Points has closed. Reopen the extension and try again.'));
      const id = `sp-${instance}-${Date.now()}-${++sequence}`;
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('Lumiverse did not respond in time. Your edits are still here. Refresh the connection before trying again.'));
        }, requestTimeoutMs);
        pending.set(id, {resolve: value => resolve(value as T), reject, timer});
        try { ctx.sendToBackend({type:'set-points:request', id, action, input}); }
        catch(error) { clearTimeout(timer); pending.delete(id); reject(error instanceof Error ? error : new Error(String(error))); }
      });
    },
    destroy() {
      disposed = true; off();
      for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Set Points closed before the request finished.')); }
      pending.clear();
    },
  };
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag); result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}
function option(label:string,value:string) { const result=node('option','',label); result.value=value; return result; }
function paragraph(text: string, className = 'sp-muted sp-small') { return node('p', className, text); }
function group(...children: HTMLElement[]) { const result = node('div','sp-stack'); result.append(...children); return result; }
function row(...children: HTMLElement[]) { const result = node('div','sp-row'); result.append(...children); return result; }
function details(title: string) {
  const result = node('details','sp-details'); const summary = node('summary','', title); const body = group(); result.append(summary,body); return {root:result,body,summary};
}
function clone<T>(value:T):T { return JSON.parse(JSON.stringify(value)) as T; }
function errorText(error: unknown) { return error instanceof Error ? error.message : String(error); }

export function setup(ctx: SpindleFrontendContext) {
  let destroyed = false;
  let selected: 'import'|'review'|'play' = 'import';
  let snapshot: AppSnapshot|null = null;
  let draft: StoryDraft|null = null;
  let draftDirty = false;
  let draftVersion = '';
  let draftRevision = 0;
  let openingDraft = false;
  let loadingPages = false;
  let adaptationStarting = false;
  let connectionChecking = false;
  let webAbort: AbortController|null = null;
  let stagedPages: WebCollection|null = null;
  let appliedSourceUrl: string|undefined;
  let refreshInFlight: Promise<void>|null = null;
  let refreshAgain = false;
  let polling: ReturnType<typeof setInterval>|undefined;
  let panelNonce = 0;
  const teardown: Array<() => void> = [];
  const tab = ctx.ui.registerDrawerTab({id:'set-points',title:'Set Points',shortName:'Set Points',description:'Adapt a story. Choose your role. Set the next scene.',keywords:['story','import','narrator','scenes'],iconSvg:ICON});
  const app = node('div','sp-app'); tab.root.append(app);
  teardown.push(ctx.dom.addStyle(styles));
  const header = node('header','sp-header'); const mark = node('div','sp-mark'); mark.setAttribute('aria-hidden','true'); mark.append(node('span'));
  const heading = node('div'); heading.append(paragraph('A story. Your choices.','sp-eyebrow'),node('h1','','Set Points'),paragraph('Turn a story into somewhere you can go.','sp-subtitle')); header.append(mark,heading);
  const tabs = node('div','sp-tabs'); tabs.setAttribute('role','tablist'); tabs.setAttribute('aria-label','Story workspace');
  const newDraftNotice = node('div','sp-status sp-stack'); newDraftNotice.hidden=true;
  const status = node('div','sp-status'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  const panels = {import:node('section','sp-panel'),review:node('section','sp-panel'),play:node('section','sp-panel')};
  const nav = new Map<string,HTMLButtonElement>();
  const suffix = Math.random().toString(36).slice(2,8);
  for (const [index,key] of (['import','review','play'] as const).entries()) {
    const button = node('button','sp-tab'); button.type='button'; button.id=`sp-${suffix}-tab-${key}`;
    button.append(node('small','',`0${index+1}`),document.createTextNode(key === 'import' ? 'Import' : key === 'review' ? 'Review' : 'Play'));
    button.setAttribute('role','tab'); button.setAttribute('aria-controls',`sp-${suffix}-panel-${key}`);
    button.addEventListener('click',()=>selectTab(key));
    button.addEventListener('keydown',event=> {
      const order = ['import','review','play'] as const;
      let next = index;
      if(event.key==='ArrowRight') next=(index+1)%3; else if(event.key==='ArrowLeft') next=(index+2)%3; else if(event.key==='Home') next=0; else if(event.key==='End') next=2; else return;
      event.preventDefault(); selectTab(order[next]); nav.get(order[next])?.focus();
    });
    tabs.append(button); nav.set(key,button);
    panels[key].id=`sp-${suffix}-panel-${key}`; panels[key].setAttribute('role','tabpanel'); panels[key].setAttribute('aria-labelledby',button.id);
  }
  const footer = node('footer','sp-footer'); footer.append(node('span','',`SET POINTS / ${VERSION}`));
  app.append(header,tabs,status,newDraftNotice,panels.import,panels.review,panels.play,footer);
  const rpc = createRpc(ctx,()=>{ void refresh(); });
  function notify(message:string,kind:'info'|'error'='info') { if(destroyed) return; status.textContent=message; status.dataset.kind=kind; }
  function button(label:string, action:()=>void|Promise<void>, primary=false) {
    const result=node('button',`sp-button${primary?' sp-primary':''}`,label); result.type='button';
    result.addEventListener('click',()=>{ void run(result,action); }); return result;
  }
  async function run(control: HTMLButtonElement|null, action:()=>void|Promise<void>) {
    if(control) control.disabled=true;
    try { await action(); }
    catch(error) { notify(errorText(error),'error'); }
    finally { if(control && !destroyed) { control.disabled=false; syncImportControls(); } }
  }
  function selectTab(key:typeof selected) {
    selected=key;
    for(const name of ['import','review','play'] as const) {
      panels[name].hidden=name!==key; const item=nav.get(name)!; item.setAttribute('aria-selected',String(name===key)); item.tabIndex=name===key?0:-1;
    }
    if(key==='play') void refresh();
  }
  let fieldIndex=0;
  function field(label:string,value:string,change?:(value:string)=>void,opts:{area?:boolean;hint?:string;placeholder?:string;type?:string;min?:number;max?:number;rows?:number}={}) {
    const wrap=node('div','sp-field'); const id=`sp-${suffix}-field-${++fieldIndex}`; const caption=node('label','sp-label',label); caption.htmlFor=id;
    const input=opts.area?node('textarea'):node('input'); input.id=id; input.value=value;
    if(input instanceof HTMLInputElement) { input.type=opts.type??'text'; if(opts.min!==undefined) input.min=String(opts.min); if(opts.max!==undefined) input.max=String(opts.max); }
    if(input instanceof HTMLTextAreaElement && opts.rows) input.rows=opts.rows;
    if(opts.placeholder) input.placeholder=opts.placeholder;
    if(change) input.addEventListener('input',()=>change(input.value));
    wrap.append(caption,input);
    if(opts.hint) { const help=paragraph(opts.hint,'sp-hint'); help.id=`${id}-hint`; input.setAttribute('aria-describedby',help.id); wrap.append(help); }
    return {wrap,input};
  }
  function intro(title:string,copy:string) { const value=node('div','sp-intro'); const text=node('div');text.append(node('h2','',title),paragraph(copy));value.append(text);return value; }
  function download(name:string,value:unknown) {
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
    const anchor=node('a'); anchor.href=url;anchor.download=name;app.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  newDraftNotice.append(paragraph('A new adaptation is ready. Loading it replaces your unsaved review edits.','sp-small'),button('Load new draft',()=>{if(!snapshot?.draft)return;draft=clone(snapshot.draft);draftDirty=false;draftRevision++;draftVersion=JSON.stringify(draft);newDraftNotice.hidden=true;renderReview();selectTab('review');notify('New adaptation loaded.');}));
  footer.append(button('Download diagnostics',async()=>download('set-points-diagnostics.json',await rpc.request('diagnostics'))));

  // The import form stays mounted across snapshots and drawer/tab changes.
  panels.import.append(intro('Begin with a story','Bring the cast and the premise. Leave room for yourself.'));
  const sourceCard=node('div','sp-card sp-stack');
  const source=field('Story text','',()=>updateSourceCount(),{area:true,placeholder:'Paste a complete story or a chapter here…'}); source.input.classList.add('sp-source'); source.input.maxLength=MAX_SOURCE;
  const count=paragraph('0 characters','sp-hint');
  const fileInput=node('input'); fileInput.type='file';fileInput.accept='.txt,.md,text/plain,text/markdown';fileInput.hidden=true;
  fileInput.addEventListener('change',()=>void run(null,async()=> {
    const file=fileInput.files?.[0]; if(!file) return;
    if(!/\.(txt|md)$/i.test(file.name)) throw new Error('Choose a .txt or .md file. You can paste text from other formats.');
    if(file.size>MAX_SOURCE*4) throw new Error('This file is too large. Import up to 500,000 characters at a time.');
    const text=await file.text();
    if(text.length>MAX_SOURCE) throw new Error('This story is over 500,000 characters. Try a smaller section.');
    appliedSourceUrl=undefined;source.input.value=text;title.input.value=file.name.replace(/\.(txt|md)$/i,'');url.input.value='';updateSourceCount();fileInput.value='';
    notify('Text loaded. Review it below before adapting.');
  }));
  const sourceTools=row(button('Open text file',()=>fileInput.click()),button('Try a sample',()=>{
    appliedSourceUrl=undefined;source.input.value=DEMO_STORY;title.input.value='The Lighthouse Letter';role.input.value='Mara, the cartographer';start.input.value='Mara arrives at Greyhaven harbor';url.input.value='';sceneCount.input.value='4';updateSourceCount();notify('Sample loaded. Choose an adaptation connection to try it.');
  })); sourceTools.classList.add('sp-spread');
  const sourceBottom=row(count,paragraph('Up to 500,000 characters','sp-hint'));sourceBottom.classList.add('sp-spread');
  const title=field('Story title','',undefined,{placeholder:'Give your adaptation a title'});
  // Assigning directly below keeps the title independent from asynchronous refreshes.
  const url=field('Story link','',undefined,{type:'url',placeholder:'https://…'});
  const linkSection=details('Import from a link');
  const otherUrls=field('Other page links','',undefined,{area:true,rows:3,placeholder:'One page link per line, in reading order',hint:'Optional. Replaces automatic next-page discovery. Reading again starts at the first link: include every page after it in order, even pages already collected. All links must stay on the same website.'});
  otherUrls.input.maxLength=409600;
  const collectionBox=node('div','sp-collection sp-stack');collectionBox.hidden=true;
  const collectionCount=paragraph('','sp-label');collectionCount.setAttribute('role','status');collectionCount.setAttribute('aria-live','polite');
  const collectionMessage=paragraph('','sp-hint');const collectedList=node('ol','sp-page-list');
  const collectedPreview=details('Preview collected text');const collectedText=paragraph('','sp-preview');collectedPreview.body.append(collectedText);
  const cancelLoading=button('Cancel loading',()=>{webAbort?.abort();});cancelLoading.hidden=true;
  const useCollected=button('Use collected text',()=>{
    if(loadingPages||adaptationStarting||connectionChecking||snapshot?.job?.status==='running')throw new Error('Wait for the current operation to finish before replacing the story text.');
    if(!stagedPages?.pages.length)throw new Error('No pages have been collected yet.');
    appliedSourceUrl=stagedPages.pages[0].url;source.input.value=stagedPages.text;title.input.value=stagedPages.pages[0].title;url.input.value=stagedPages.pages[0].url;updateSourceCount();
    notify('Collected pages copied into story text. Check the text and completeness before creating an adaptation.');
  },true);useCollected.hidden=true;
  const applyHint=paragraph('Using the collection replaces the story text and title above. Check that all intended pages are present before adapting.','sp-hint');applyHint.hidden=true;
  collectionBox.append(collectionCount,collectionMessage,collectedList,cancelLoading,collectedPreview.root,useCollected,applyHint);
  const fetchButton=button('Read page',()=>readPages(false));
  const fetchLinkedButton=button('Read linked pages',()=>readPages(true));
  function showCollection(progress:WebCollectionProgress,result?:WebCollection){
    collectionBox.hidden=false;
    collectionCount.textContent=`${progress.pages.length} page${progress.pages.length===1?'':'s'} collected · ${progress.characters.toLocaleString()} characters`;
    collectionMessage.textContent=(result?`${result.message}${result.stoppedAt?` Stopped at: ${result.stoppedAt}`:''}`:'')||(progress.loadingUrl?`Reading page ${progress.pages.length+1}: ${progress.loadingUrl}`:'Preparing the next page…');
    collectedList.replaceChildren();
    for(const page of progress.pages){
      const item=node('li');const label=node('span','sp-small',page.title);const link=node('a','sp-hint',page.url);link.href=page.url;link.target='_blank';link.rel='noopener noreferrer';item.append(label,link);collectedList.append(item);
    }
    cancelLoading.hidden=!loadingPages;collectedPreview.root.hidden=!result?.pages.length;useCollected.hidden=!result?.pages.length;applyHint.hidden=!result?.pages.length;
    if(result)collectedText.textContent=result.text;
    syncImportControls();
  }
  async function readPages(linked:boolean){
    if(loadingPages||adaptationStarting||connectionChecking||snapshot?.job?.status==='running')throw new Error('Wait for the current page loading, connection check, or adaptation to finish.');
    const controller=new AbortController();webAbort=controller;loadingPages=true;stagedPages=null;
    showCollection({pages:[],characters:0,loadingUrl:url.input.value.trim()});
    try{
      const supplied=otherUrls.input.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
      const result=await collectStoryPages({url:url.input.value,linked,otherUrls:linked&&supplied.length?supplied:undefined,signal:controller.signal,onProgress:progress=>{if(!destroyed&&webAbort===controller)showCollection(progress);}},(pageUrl)=>rpc.request<WebStoryPage>('fetch-url',{url:pageUrl}));
      if(destroyed||webAbort!==controller)return;
      stagedPages=result;loadingPages=false;showCollection({pages:result.pages,characters:result.text.length,loadingUrl:null},result);
      notify(result.pages.length?`${result.pages.length} page${result.pages.length===1?'':'s'} ready for review. Use collected text when you are ready to replace the source.`:result.message,result.pages.length||result.reason==='cancelled'?'info':'error');
    }finally{
      if(webAbort===controller){webAbort=null;loadingPages=false;if(!destroyed){cancelLoading.hidden=true;syncImportControls();}}
    }
  }
  function syncImportControls(){
    const busy=loadingPages||adaptationStarting||connectionChecking||snapshot?.job?.status==='running';
    checkConnectionButton.disabled=!!busy||!connection.value;connection.disabled=connectionChecking;
    resumeButton.disabled=!!busy||!snapshot?.resume?.available;
    importButton.disabled=!!busy;fetchButton.disabled=!!busy;fetchLinkedButton.disabled=!!busy;useCollected.disabled=!!busy||!stagedPages?.pages.length;
  }
  linkSection.body.append(paragraph('Read one page, or follow its next-page links. Page loading uses no model. Some sites block access; paste text when needed.','sp-hint'),url.wrap,otherUrls.wrap,row(fetchButton,fetchLinkedButton),paragraph('Up to 100 pages and 500,000 characters. Collected text stays separate until you choose to use it.','sp-hint'),collectionBox);
  sourceCard.append(sourceTools,fileInput,title.wrap,source.wrap,sourceBottom,linkSection.root);panels.import.append(sourceCard);
  const options=node('div','sp-card sp-stack'); options.append(node('h3','','Make a place for yourself'));
  const role=field('Who will you play?','',undefined,{placeholder:'An existing character, or someone new',hint:'The narrator leaves this character’s dialogue and choices to you.'});
  const start=field('Where does it begin?','',undefined,{placeholder:'The beginning, a chapter, or a specific moment'});
  const sceneCount=field('Planned scenes','6',undefined,{type:'number',min:2,max:24,hint:'2–24 major moments, including the opening.'});
  const connectionWrap=node('div','sp-field');const connectionLabel=node('label','sp-label','Adaptation connection');const connection=node('select');connection.id=`sp-${suffix}-connection`;connectionLabel.htmlFor=connection.id;
  connection.append(option('Loading connections…',''));connectionWrap.append(connectionLabel,connection,paragraph('Uses a model connection already configured in Lumiverse.','sp-hint'));
  const connectionStatus=node('div','sp-status');connectionStatus.setAttribute('role','status');connectionStatus.setAttribute('aria-live','polite');
  const checkConnectionButton=button('Check connection',async()=>{
    if(loadingPages||adaptationStarting||connectionChecking||snapshot?.job?.status==='running')throw new Error('Wait for the current page loading, connection check, or adaptation to finish.');
    const connectionId=connection.value;
    if(!connectionId)throw new Error('Choose an adaptation connection before checking it.');
    connectionChecking=true;connectionStatus.dataset.kind='info';connectionStatus.textContent='Checking the selected connection…';syncImportControls();
    try{
      const result=await rpc.request<{message:string}>('test-connection',{connectionId});
      if(destroyed)return;
      connectionStatus.textContent=`${result.message} A successful check does not guarantee that a full story adaptation will be accepted.`;
    }catch(error){
      if(!destroyed){connectionStatus.dataset.kind='error';connectionStatus.textContent=errorText(error);}
    }finally{connectionChecking=false;if(!destroyed)syncImportControls();}
  });checkConnectionButton.disabled=true;
  connection.addEventListener('change',()=>{connectionStatus.textContent='';syncImportControls();});
  connectionWrap.append(checkConnectionButton,paragraph('Sends a small test request without your story. Normal model charges apply.','sp-hint'),connectionStatus);
  const optionGrid=node('div','sp-grid');optionGrid.append(sceneCount.wrap,connectionWrap);options.append(role.wrap,start.wrap,optionGrid);panels.import.append(options);
  const advanced=details('Long-story settings');const chunk=field('Characters per section','12000',undefined,{type:'number',min:4000,max:20000,hint:'Long stories are read in sections, then reconciled into one adaptation. Use a smaller section for models with less context.'});advanced.body.append(chunk.wrap);panels.import.append(advanced.root);
  const progressBox=node('div','sp-progress');progressBox.hidden=true;const progressText=paragraph('','sp-small');const progress=node('progress');progress.max=1;progress.value=0;progress.setAttribute('aria-label','Story import progress');
  const cancel=button('Cancel import',async()=>{ await rpc.request('cancel-import');notify('Import cancelled. Your previous draft is still available.');await refresh(); });
  const resumeHint=paragraph('','sp-hint');resumeHint.hidden=true;
  const resumeButton=button('Resume saved import',async()=>{
    if(loadingPages||adaptationStarting||connectionChecking||snapshot?.job?.status==='running')throw new Error('Wait for page loading, the connection check, or the current adaptation to finish.');
    if(!snapshot?.resume?.available)throw new Error('There is no saved import available to resume.');
    const retryUncertain=snapshot.resume.retryUncertain;
    adaptationStarting=true;syncImportControls();
    try{
      const job=await rpc.request<ImportJob>('resume-import',retryUncertain?{retryUncertain:true}:{});
      if(snapshot)snapshot.job=job;renderJob(job);notify('Resuming the story and settings saved for your last attempt. Completed matching steps are reused.');await refresh();
    }finally{adaptationStarting=false;if(!destroyed)syncImportControls();}
  },true);resumeButton.hidden=true;
  progressBox.append(progressText,progress,cancel,resumeHint,resumeButton);panels.import.append(progressBox);
  const importButton=button('Create adaptation  →',async()=> {
    if(loadingPages||adaptationStarting||connectionChecking||snapshot?.job?.status==='running')throw new Error('Wait for page loading, the connection check, or the current adaptation to finish.');
    if(!source.input.value.trim()) throw new Error('Add story text before creating an adaptation.');
    if(!connection.value) throw new Error('Choose an adaptation connection. Add one in Lumiverse settings if the list is empty.');
    const sceneNumber=Number(sceneCount.input.value),chunkNumber=Number(chunk.input.value);
    if(!Number.isInteger(sceneNumber)||sceneNumber<2||sceneNumber>24) throw new Error('Choose between 2 and 24 scenes.');
    if(!Number.isInteger(chunkNumber)||chunkNumber<4000||chunkNumber>20000) throw new Error('Section size must be between 4,000 and 20,000 characters.');
    const options:ImportOptions={text:source.input.value,sourceTitle:title.input.value.trim(),sourceUrl:appliedSourceUrl,playerRole:role.input.value.trim(),startingPoint:start.input.value.trim(),sceneCount:sceneNumber,connectionId:connection.value,chunkSize:chunkNumber};
    adaptationStarting=true;syncImportControls();
    try{const job=await rpc.request<ImportJob>('start-import',{options});if(snapshot)snapshot.job=job;renderJob(job);notify('Your story is being adapted. You can leave this panel open or return later.');await refresh();}
    finally{adaptationStarting=false;if(!destroyed)syncImportControls();}
  },true);importButton.classList.add('sp-wide');
  panels.import.append(importButton,paragraph('Creates a draft for you to review. Each section and the final adaptation use your connected model and its normal charges.','sp-footnote'));
  function updateSourceCount(){ count.textContent=`${source.input.value.length.toLocaleString()} characters`; }
  function renderJob(job:ImportJob|null) {
    const running=job?.status==='running';const canResume=!!snapshot?.resume?.available&&!running;progressBox.hidden=!job&&!canResume;cancel.hidden=!running;resumeButton.hidden=!canResume;resumeHint.hidden=!canResume;
    resumeButton.textContent=snapshot?.resume?.retryUncertain?'Retry unfinished request':'Resume saved import';
    resumeHint.textContent='Uses the story and settings saved for your last attempt. Completed steps are reused; remaining requests use normal model charges.'+(snapshot?.resume?.retryUncertain?' Its previous outcome is unknown and it may already have been charged. Retrying can charge that request again.':'');
    syncImportControls();
    if(job) { progressText.textContent=job.error||job.label;progress.max=Math.max(1,job.total);progress.value=Math.min(job.completed,progress.max); }
    if(running&&!polling) polling=setInterval(()=>{void refresh();},2500);
    if(!running&&polling) {clearInterval(polling);polling=undefined;}
    tab.setBadge(running?'…':null);
  }
  function updateConnections(next:AppSnapshot) {
    const signature=JSON.stringify(next.connections);if(connection.dataset.signature===signature)return;
    const current=connection.value;connection.replaceChildren();connection.dataset.signature=signature;
    if(!next.connections.length) connection.append(option('Add a model connection in Settings',''));
    for(const entry of next.connections) connection.append(option(`${entry.name}${entry.model?` · ${entry.model}`:''}`,entry.id));
    if(next.connections.some(item=>item.id===current))connection.value=current;
  }

  const draftFileInput=node('input');draftFileInput.type='file';draftFileInput.accept='.json,application/json';draftFileInput.hidden=true;draftFileInput.setAttribute('aria-label','Open saved Set Points draft');app.append(draftFileInput);
  const openDraftButton=button('Open draft',()=>draftFileInput.click());
  draftFileInput.addEventListener('change',()=>void run(openDraftButton,async()=>{
    const file=draftFileInput.files?.[0];if(!file)return;
    openingDraft=true;
    try {
      if(!/\.json$/i.test(file.name))throw new Error('Choose a Set Points draft saved as a .json file.');
      if(file.size>MAX_DRAFT*4)throw new Error('This draft file is too large. Open a draft with up to 192,000 characters.');
      const text=await file.text();
      if(text.length>MAX_DRAFT)throw new Error('This draft file is too large. Open a draft with up to 192,000 characters.');
      let imported:unknown;
      try{imported=JSON.parse(text);}catch{throw new Error('This file could not be read. Choose a Set Points draft exported from Review.');}
      notify('Checking the saved draft…');
      const restored=await rpc.request<StoryDraft>('save-draft',{draft:imported});
      if(destroyed)return;
      draft=clone(restored);draftDirty=false;draftRevision++;draftVersion=JSON.stringify(restored);if(snapshot)snapshot.draft=clone(restored);
      newDraftNotice.hidden=true;renderReview();selectTab('review');notify('Draft opened and saved. Review it before saving the character card.');
    }finally{openingDraft=false;draftFileInput.value='';}
  }));

  function renderReview() {
    const panel=panels.review;panel.replaceChildren();panelNonce++;
    if(!draft) {
      const top=intro('Meet your adaptation','A little preparation makes room for a better story.');top.append(openDraftButton);panel.append(top);
      const empty=node('div','sp-empty');empty.append(node('span','sp-tag','Your draft belongs here'),paragraph('Import a story to review its cast, lore, and scene openings.'),button('Bring in a story',()=>selectTab('import'),true));panel.append(empty);return;
    }
    const current=draft;const nonce=panelNonce;
    const top=intro('Make it yours','Edit the cast, the world, and the moments you want to reach.');const dirtyTag=node('span','sp-tag',draftDirty?'Unsaved edits':'Draft ready');top.append(group(dirtyTag,openDraftButton));panel.append(top);
    const markDirty=()=> { draftDirty=true;dirtyTag.textContent='Unsaved edits'; };
    const edit=(label:string,value:string,change:(value:string)=>void,area=false,hint?:string)=>field(label,value,v=>{change(v);markDirty();},{area,hint}).wrap;
    const summary=node('div','sp-card sp-stack');summary.append(edit('Title',current.title,v=>current.title=v),edit('Premise',current.premise,v=>current.premise=v,true));
    const choices=node('div','sp-grid');choices.append(edit('Your role',current.playerRole,v=>current.playerRole=v),edit('Starting point',current.startingPoint,v=>current.startingPoint=v));summary.append(choices);
    const counts=node('div','sp-counts');for(const [number,label] of [[current.cast.length,'characters'],[current.lore.length,'lore entries'],[current.scenes.length,'scenes']] as const){ const item=node('div');item.append(node('strong','',String(number)),node('span','',label));counts.append(item);}summary.append(counts);panel.append(summary);
    if(current.warnings.length) { const warnings=details(`${current.warnings.length} adaptation note${current.warnings.length===1?'':'s'}`);for(const warning of current.warnings)warnings.body.append(paragraph(warning,'sp-notice'));panel.append(warnings.root); }
    const narration=details('Narrator direction');narration.body.append(edit('Instructions',current.narratorInstructions,v=>current.narratorInstructions=v,true,'Describe the narrator’s scope and how it should leave your choices open.'));panel.append(narration.root);
    const cast=node('div','sp-review-group');cast.append(node('div','sp-section-label','The people'));
    for(const person of current.cast) {
      const entry=details(person.name);entry.body.append(edit('Name',person.name,v=>{person.name=v;entry.summary.textContent=v;}),edit('Also known as',person.aliases.join(', '),v=>person.aliases=v.split(',').map(x=>x.trim()).filter(Boolean)),edit('Personality',person.personality,v=>person.personality=v,true),edit('Voice & manner',person.voice,v=>person.voice=v,true),edit('Relationships at the start',person.relationships,v=>person.relationships=v,true),edit('Knowledge at the start',person.knowledge,v=>person.knowledge=v,true));
      if(person.sourceRefs.length)entry.body.append(paragraph(`Source: ${person.sourceRefs.join(' · ')}`,'sp-hint'));cast.append(entry.root);
    }panel.append(cast);
    const lore=node('div','sp-review-group');lore.append(node('div','sp-section-label','The world'));
    for(const item of current.lore) { const entry=details(item.name);entry.body.append(edit('Entry name',item.name,v=>{item.name=v;entry.summary.textContent=v;}),edit('Keywords',item.keys.join(', '),v=>item.keys=v.split(',').map(x=>x.trim()).filter(Boolean)),edit('Lore',item.content,v=>item.content=v,true));lore.append(entry.root); }panel.append(lore);
    const scenes=node('div','sp-review-group');scenes.append(node('div','sp-section-label','The set points'),paragraph('Each scene opens a situation. Your next action stays yours.','sp-hint'));
    current.scenes.forEach((scene,index)=> {
      const entry=details(`${String(index+1).padStart(2,'0')}  ${scene.title}${index===0?' · Opening':''}`);
      entry.body.append(edit('Scene title',scene.title,v=>{scene.title=v;entry.summary.textContent=`${String(index+1).padStart(2,'0')}  ${v}`;}),edit('Scene opening',scene.greeting,v=>scene.greeting=v,true),edit('Private direction',scene.direction,v=>scene.direction=v,true,'Guides the model toward this scene during play.'));
      if(scene.assumptions.length) {entry.body.append(node('span','sp-label','Assumptions to review'));for(const assumption of scene.assumptions)entry.body.append(paragraph(assumption,'sp-notice'));}
      if(scene.sourceRefs.length)entry.body.append(paragraph(`Source: ${scene.sourceRefs.join(' · ')}`,'sp-hint'));scenes.append(entry.root);
    });panel.append(scenes);
    const actions=row(button('Save draft',async()=>{
      const requested=clone(current),fingerprint=JSON.stringify(requested);const saved=await rpc.request<StoryDraft>('save-draft',{draft:requested});
      if(nonce===panelNonce&&JSON.stringify(current)===fingerprint){draft=saved;draftDirty=false;draftRevision++;draftVersion=JSON.stringify(saved);renderReview();}notify('Draft saved.');
    }),button('Export draft',()=>download(`${current.title.replace(/[^a-z0-9_-]+/gi,'-').slice(0,60)||'set-points'}-draft.json`,current)));
    const create=button('Save to Lumiverse  →',async()=>{
      const request=clone(current);notify('Saving the narrator and world book to Lumiverse…');const result=await rpc.request<SavedStory>('create-card',{draft:request},120_000);
      if(snapshot)snapshot.saved=result;
      if(nonce===panelNonce&&JSON.stringify(current)===JSON.stringify(request)){draftDirty=false;draftRevision++;draftVersion=JSON.stringify(current);}
      notify(`“${result.title}” is saved. Open it from Characters and start a chat, then return to Play.`);renderReview();
    },true);create.classList.add('sp-wide');panel.append(actions,create,paragraph('Saves a narrator character card with its world book and ordered scenes. Start a chat with that card to use the scene controls.','sp-footnote'));
    if(snapshot?.saved?.draftId===current.id) {
      const saved=node('div','sp-saved sp-stack');saved.append(node('h3','',`Saved: ${snapshot.saved.title}`),paragraph('Open Characters in Lumiverse, select this story, and start a new chat.','sp-small'),paragraph(`Character: ${snapshot.saved.characterId}`,'sp-inline-code'),paragraph(`World book: ${snapshot.saved.worldBookId}`,'sp-inline-code'));panel.append(saved);
    }
  }

  function renderPlay(play:SceneView|null) {
    const panel=panels.play;panel.replaceChildren();panel.append(intro('The story is in your hands','Follow the thread. Linger in a moment. Or turn the page.'));
    if(!play?.chatId||!play.scenes.length) {
      const empty=node('div','sp-empty');empty.append(node('span','sp-tag','Ready when you are'),paragraph(play?.notice||'Open a chat with a Set Points story card to see its scenes here.'),button('Review your story',()=>selectTab('review')));panel.append(empty);return;
    }
    const chatId=play.chatId;
    async function mutate(action:string,input:Record<string,unknown>={}) {
      const next=await rpc.request<SceneView>(action,{chatId,...input});if(snapshot)snapshot.play=next;renderPlay(next);
    }
    const follow=node('div','sp-card sp-switch');const copy=group(node('h3','','Follow the story'),paragraph('Guide the narrator toward the next scene. Turn off to explore freely.','sp-hint'));
    const toggle=node('input');toggle.type='checkbox';toggle.checked=play.enabled;toggle.setAttribute('aria-label','Follow the story');toggle.setAttribute('role','switch');toggle.disabled=play.busy;
    toggle.addEventListener('change',()=>void run(null,async()=>{toggle.disabled=true;try{await mutate('play-enable',{enabled:toggle.checked});}catch(error){toggle.checked=play.enabled;throw error;}finally{toggle.disabled=false;}}));follow.append(copy,toggle);panel.append(follow);
    const current=play.scenes[play.current];const currentBox=node('div','sp-card');const track=node('div','sp-play-track');for(let i=0;i<play.scenes.length;i++){const dash=node('span');dash.dataset.done=String(i<=play.current);track.append(dash);}
    currentBox.append(node('span','sp-tag',`Current scene · ${Math.max(0,play.current)+1} / ${play.scenes.length}`),node('h3','sp-stage-title',current?.title||play.title),track,paragraph(play.title,'sp-hint'));panel.append(currentBox);
    const upcoming=node('div','sp-card sp-stack');upcoming.append(node('div','sp-section-label','Set the next scene'));
    const pick=node('select');pick.setAttribute('aria-label','Next scene');pick.append(option('End of story / no next scene',''));
    play.scenes.forEach((scene,index)=>pick.append(option(`${String(index+1).padStart(2,'0')} · ${scene.title}`,String(index))));pick.value=play.next===null?'':String(play.next);pick.disabled=play.busy;
    pick.addEventListener('change',()=>void run(null,async()=>{pick.disabled=true;try{await mutate('play-next',{index:pick.value===''?null:Number(pick.value)});}finally{pick.disabled=false;}}));
    upcoming.append(pick);
    if(play.next!==null&&play.scenes[play.next]){
      const next=play.scenes[play.next];const preview=details('Preview the next scene · contains spoilers');preview.body.append(paragraph(next.greeting,'sp-preview'));
      if(next.assumptions.length)preview.body.append(paragraph(`Assumptions: ${next.assumptions.join(' ')}`,'sp-notice'));upcoming.append(preview.root);
    }else upcoming.append(paragraph('You’ve reached the end of the planned scenes. Keep exploring or choose another moment.','sp-hint'));
    panel.append(upcoming);
    const force=button('Force next scene  →',()=>mutate('play-force'),true);force.disabled=play.busy||play.next===null;force.classList.add('sp-wide');
    const undo=button('Undo last scene insertion',()=>mutate('play-undo'));undo.disabled=play.busy||!play.canUndo;
    panel.append(force,paragraph('Force inserts the selected scene now, even with story following paused. It does not generate a bridge or choose your character’s response.','sp-footnote'),undo);
    if(play.notice)panel.append(paragraph(play.notice,'sp-notice'));
  }
  async function refresh() {
    if(destroyed)return;
    if(refreshInFlight){refreshAgain=true;return refreshInFlight;}
    refreshInFlight=(async()=>{
      try {
        const readRevision=draftRevision;const next=await rpc.request<AppSnapshot>('snapshot',ctx.getActiveChat());if(destroyed)return;
        const completed=snapshot?.job?.status==='running'&&next.job?.status==='complete';
        snapshot=next;updateConnections(next);renderJob(next.job);
        newDraftNotice.hidden=!(draftDirty&&draft&&next.draft&&draft.id!==next.draft.id);
        const nextVersion=JSON.stringify(next.draft);
        if(!openingDraft&&!draftDirty&&readRevision===draftRevision&&nextVersion!==draftVersion){draft=next.draft?clone(next.draft):null;draftVersion=nextVersion;renderReview();}
        renderPlay(next.play);
        if(completed){notify(newDraftNotice.hidden?'Your adaptation is ready. Review the cast and scene assumptions before saving.':'Your new adaptation is ready. Your unsaved review edits have been kept.');selectTab('review');}
      }catch(error){notify(errorText(error),'error');}
      finally{refreshInFlight=null;if(refreshAgain&&!destroyed){refreshAgain=false;void refresh();}}
    })();return refreshInFlight;
  }
  teardown.push(tab.onActivate(()=>{void refresh();}));
  teardown.push(ctx.events.on('CHAT_CHANGED',()=>{void refresh();}));
  const openAction=ctx.ui.registerInputBarAction({id:'set-points-open',label:'Set Points',subtitle:'Review and direct your story',iconSvg:ICON});
  teardown.push(openAction.onClick(()=>{tab.activate();selectTab('play');}),()=>openAction.destroy());
  const forceAction=ctx.ui.registerInputBarAction({id:'set-points-force',label:'Force next scene',subtitle:'Set Points · insert the next planned scene',iconSvg:ICON});
  teardown.push(forceAction.onClick(()=>void run(null,async()=>{
    const active=ctx.getActiveChat();if(!active.chatId){tab.activate();selectTab('play');notify('Open a story chat first.');return;}
    const play=await rpc.request<SceneView>('play-force',{chatId:active.chatId});if(snapshot)snapshot.play=play;renderPlay(play);
  })),()=>forceAction.destroy());
  renderReview();renderPlay(null);selectTab('import');ctx.ready();void refresh();
  return ()=>{if(destroyed)return;destroyed=true;webAbort?.abort();if(polling)clearInterval(polling);rpc.destroy();for(const cleanup of teardown.reverse())cleanup();app.remove();tab.destroy();};
}
