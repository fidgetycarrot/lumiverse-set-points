import type { SpindleFrontendContext } from 'lumiverse-spindle-types';
import { DEMO_STORY, VERSION, type AppSnapshot, type ImportJob, type ImportOptions, type ReasoningMode, type ResponseMessage, type SavedStory, type SceneView, type StoryDraft, type WebStoryPage } from './types';
import { styles } from './styles';
import { appearanceMentions } from './appearance-review';
import { visualCaption, visualDraftSignature, visualTagPrompt, emptyVisualText, incompleteVisualText, type VisualPack } from './visuals';
import { collectStoryPages, type WebCollection, type WebCollectionProgress } from './web-import';

const MAX_SOURCE = 500_000;
const MAX_DRAFT = 192_000;
const MAX_BACKUP = MAX_DRAFT * 2;
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
  let pendingReplacement:StoryDraft|null=null;
  const approvedControls=new Map<string,()=>void>();
  let loadingPages = false;
  let adaptationStarting = false;
  let connectionChecking = false;
  let visualsStarting = false;
  let webAbort: AbortController|null = null;
  let stagedPages: WebCollection|null = null;
  let appliedSourceUrl: string|undefined;
  let resumeSettingsJobId: string|null = null;
  let resumeSettingsDirty = false;
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
  function selectField(label:string,choices:Array<[string,string]>,value:string,onChange?:()=>void){
    const wrap=node('div','sp-field'),caption=node('label','sp-label',label),input=node('select');input.id=`sp-${suffix}-field-${++fieldIndex}`;caption.htmlFor=input.id;
    for(const [key,text] of choices)input.append(option(text,key));input.value=value;
    if(onChange){input.addEventListener('change',onChange);input.addEventListener('input',onChange);}wrap.append(caption,input);return {wrap,input};
  }
  const responseAllowances:Array<[string,string]>=[['8000','8,000 tokens'],['16000','16,000 tokens · default'],['32000','32,000 tokens'],['64000','64,000 tokens']];
  const reasoningModes:Array<[string,string]>=[['inherit','Use connection settings'],['off','Off'],['low','Low']];
  const responseSettingsHint='A larger response allowance may cost more or be rejected by your provider. Reasoning overrides also depend on provider support.';
  function readResponseSettings(allowance:HTMLSelectElement,reasoning:HTMLSelectElement):{maxOutputTokens:number;reasoningMode:ReasoningMode}{
    const maxOutputTokens=Number(allowance.value),reasoningMode=reasoning.value;
    if(![8000,16000,32000,64000].includes(maxOutputTokens))throw new Error('Choose one of the available response allowances.');
    if(!['inherit','off','low'].includes(reasoningMode))throw new Error('Choose one of the available reasoning settings.');
    return {maxOutputTokens,reasoningMode:reasoningMode as ReasoningMode};
  }
  function intro(title:string,copy:string) { const value=node('div','sp-intro'); const text=node('div');text.append(node('h2','',title),paragraph(copy));value.append(text);return value; }
  const backupPanel=node('section','sp-card sp-stack');backupPanel.hidden=true;backupPanel.setAttribute('aria-label','JSON backup');
  const backupName=field('Backup filename','');backupName.input.readOnly=true;
  const backupText=field('JSON backup','',undefined,{area:true,rows:12});backupText.input.readOnly=true;
  const downloadUrls=new Map<string,ReturnType<typeof setTimeout>>();
  function requestBackupDownload(){
    const url=URL.createObjectURL(new Blob([backupText.input.value],{type:'application/json'}));
    const timer=setTimeout(()=>{URL.revokeObjectURL(url);downloadUrls.delete(url);},30_000);downloadUrls.set(url,timer);
    const anchor=node('a');anchor.href=url;anchor.download=backupName.input.value;app.append(anchor);
    try{anchor.click();notify('Download requested. If no file appears, copy the visible backup and save it using the filename shown.');}
    finally{anchor.remove();}
  }
  backupPanel.append(node('h3','','Your JSON backup'),paragraph('The complete backup is visible below even if your browser blocks downloading. Copy backup, paste it into a plain-text editor, and save it using the shown .json filename.','sp-hint'),backupName.wrap,backupText.wrap,row(button('Download JSON',()=>requestBackupDownload()),button('Copy backup',()=>copyVisualText(backupText.input.value,backupText.input,'Backup')),button('Close backup',()=>{backupPanel.hidden=true;})));
  app.insertBefore(backupPanel,panels.import);teardown.push(()=>{for(const [url,timer]of downloadUrls){clearTimeout(timer);URL.revokeObjectURL(url);}downloadUrls.clear();});
  function download(name:string,value:unknown) {
    backupName.input.value=name;backupText.input.value=JSON.stringify(value,null,2);backupPanel.hidden=false;backupText.input.focus();
    requestBackupDownload();
  }
  newDraftNotice.append(paragraph('A replacement draft is ready. Loading it replaces your unsaved review edits.','sp-small'),button('Load new draft',()=>{const replacement=pendingReplacement??snapshot?.draft;if(!replacement)return;draft=clone(replacement);pendingReplacement=null;draftDirty=false;draftRevision++;draftVersion=JSON.stringify(draft);newDraftNotice.hidden=true;renderReview();selectTab('review');notify('New adaptation loaded.');}));
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
    if(loadingPages||adaptationStarting||connectionChecking||visualsBusy()||snapshot?.job?.status==='running')throw new Error('Wait for the current operation to finish before replacing the story text.');
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
    if(loadingPages||adaptationStarting||connectionChecking||visualsBusy()||snapshot?.job?.status==='running')throw new Error('Wait for the current page loading, connection check, or adaptation to finish.');
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
    const busy=loadingPages||adaptationStarting||connectionChecking||visualsBusy()||snapshot?.job?.status==='running';
    checkConnectionButton.disabled=!!busy||!connection.value;connection.disabled=connectionChecking;
    resumeButton.disabled=!!busy||!snapshot?.resume?.available;
    outputAllowance.input.disabled=!!busy;reasoningChoice.input.disabled=!!busy;resumeAllowance.input.disabled=!!busy;resumeReasoning.input.disabled=!!busy;
    importButton.disabled=!!busy;fetchButton.disabled=!!busy;fetchLinkedButton.disabled=!!busy;useCollected.disabled=!!busy||!stagedPages?.pages.length;
    syncVisualControls();
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
    if(loadingPages||adaptationStarting||connectionChecking||visualsBusy()||snapshot?.job?.status==='running')throw new Error('Wait for the current page loading, connection check, or adaptation to finish.');
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
  const responseSettings=details('Model response settings');
  const outputAllowance=selectField('Response allowance',responseAllowances,'16000');
  const reasoningChoice=selectField('Reasoning mode',reasoningModes,'inherit');
  const responseGrid=node('div','sp-grid');responseGrid.append(outputAllowance.wrap,reasoningChoice.wrap);
  responseSettings.body.append(paragraph('Set how much room the model has to answer and whether to override its reasoning setting. Allowances are measured in tokens, which can be words or parts of words.','sp-hint'),responseGrid,paragraph(responseSettingsHint,'sp-hint'));panels.import.append(responseSettings.root);
  const progressBox=node('div','sp-progress');progressBox.hidden=true;const progressText=paragraph('','sp-small');const progress=node('progress');progress.max=1;progress.value=0;progress.setAttribute('aria-label','Story import progress');
  const cancel=button('Cancel import',async()=>{ await rpc.request('cancel-import');notify('Import cancelled. Your previous draft is still available.');await refresh(); });
  const resumeHint=paragraph('','sp-hint');resumeHint.hidden=true;
  const resumeSettings=node('div','sp-stack');resumeSettings.hidden=true;
  const resumeAllowance=selectField('Unfinished response allowance',responseAllowances,'16000',()=>{resumeSettingsDirty=true;});
  const resumeReasoning=selectField('Unfinished reasoning mode',reasoningModes,'inherit',()=>{resumeSettingsDirty=true;});
  const resumeGrid=node('div','sp-grid');resumeGrid.append(resumeAllowance.wrap,resumeReasoning.wrap);
  resumeSettings.append(node('div','sp-section-label','Settings for unfinished requests'),resumeGrid,paragraph(responseSettingsHint,'sp-hint'));
  const resumeButton=button('Resume saved import',async()=>{
    if(loadingPages||adaptationStarting||connectionChecking||visualsBusy()||snapshot?.job?.status==='running')throw new Error('Wait for page loading, the connection check, or the current adaptation to finish.');
    if(!snapshot?.resume?.available)throw new Error('There is no saved import available to resume.');
    const retryUncertain=snapshot.resume.retryUncertain;
    const responseOptions=readResponseSettings(resumeAllowance.input,resumeReasoning.input);
    adaptationStarting=true;syncImportControls();
    try{
      const job=await rpc.request<ImportJob>('resume-import',{...responseOptions,...(retryUncertain?{retryUncertain:true}:{})});
      if(snapshot)snapshot.job=job;resumeSettingsDirty=false;renderJob(job);notify('Resuming the saved story. Completed steps are reused; only unfinished requests use your selected response settings.');await refresh();
    }finally{adaptationStarting=false;if(!destroyed)syncImportControls();}
  },true);resumeButton.hidden=true;
  progressBox.append(progressText,progress,cancel,resumeHint,resumeSettings,resumeButton);panels.import.append(progressBox);
  const importButton=button('Create adaptation  →',async()=> {
    if(loadingPages||adaptationStarting||connectionChecking||visualsBusy()||snapshot?.job?.status==='running')throw new Error('Wait for page loading, the connection check, or the current adaptation to finish.');
    if(!source.input.value.trim()) throw new Error('Add story text before creating an adaptation.');
    if(!connection.value) throw new Error('Choose an adaptation connection. Add one in Lumiverse settings if the list is empty.');
    const sceneNumber=Number(sceneCount.input.value),chunkNumber=Number(chunk.input.value);
    if(!Number.isInteger(sceneNumber)||sceneNumber<2||sceneNumber>24) throw new Error('Choose between 2 and 24 scenes.');
    if(!Number.isInteger(chunkNumber)||chunkNumber<4000||chunkNumber>20000) throw new Error('Section size must be between 4,000 and 20,000 characters.');
    const options:ImportOptions={text:source.input.value,sourceTitle:title.input.value.trim(),sourceUrl:appliedSourceUrl,playerRole:role.input.value.trim(),startingPoint:start.input.value.trim(),sceneCount:sceneNumber,connectionId:connection.value,chunkSize:chunkNumber,...readResponseSettings(outputAllowance.input,reasoningChoice.input)};
    adaptationStarting=true;syncImportControls();
    try{const job=await rpc.request<ImportJob>('start-import',{options});if(snapshot)snapshot.job=job;renderJob(job);notify('Your story is being adapted. You can leave this panel open or return later.');await refresh();}
    finally{adaptationStarting=false;if(!destroyed)syncImportControls();}
  },true);importButton.classList.add('sp-wide');
  panels.import.append(importButton,paragraph('Creates a draft for you to review. Reading, planning, and each character, lore, or scene batch use your model’s normal charges. Completed steps are saved for reuse.','sp-footnote'));
  function updateSourceCount(){ count.textContent=`${source.input.value.length.toLocaleString()} characters`;syncVisualControls(); }
  function renderJob(job:ImportJob|null) {
    const running=job?.status==='running';const canResume=!!snapshot?.resume?.available&&!running;progressBox.hidden=!job&&!canResume;cancel.hidden=!running;resumeButton.hidden=!canResume;resumeHint.hidden=!canResume;resumeSettings.hidden=!canResume;
    if(canResume&&(!resumeSettingsDirty||resumeSettingsJobId!==(job?.id??null))){
      resumeSettingsJobId=job?.id??null;resumeSettingsDirty=false;
      const savedAllowance=snapshot?.resume?.maxOutputTokens??16000;resumeAllowance.input.value=[8000,16000,32000,64000].includes(savedAllowance)?String(savedAllowance):'16000';
      const savedReasoning=snapshot?.resume?.reasoningMode??'inherit';resumeReasoning.input.value=['inherit','off','low'].includes(savedReasoning)?savedReasoning:'inherit';
    }
    resumeButton.textContent=snapshot?.resume?.retryUncertain?'Retry unfinished request':'Resume saved import';
    resumeHint.textContent='Uses the saved story and import settings, not the edits in the current form. Completed steps are reused even when you change the response settings below; remaining requests use normal model charges.'+(snapshot?.resume?.retryUncertain?' Its previous outcome is unknown and it may already have been charged. Retrying can charge that request again.':'');
    syncImportControls();
    if(job) { progressText.textContent=job.status==='failed'&&job.phase?`Stopped during ${job.phase}. ${job.error||job.label}`:job.error||job.label;progress.max=Math.max(1,job.total);progress.value=Math.min(job.completed,progress.max); }
    const anyRunning=running||snapshot?.visuals?.job?.status==='running';
    if(anyRunning&&!polling) polling=setInterval(()=>{void refresh();},2500);
    if(!anyRunning&&polling) {clearInterval(polling);polling=undefined;}
    tab.setBadge(anyRunning?'…':null);
  }
  function updateConnections(next:AppSnapshot) {
    const signature=JSON.stringify(next.connections);if(connection.dataset.signature===signature)return;
    const current=connection.value;connection.replaceChildren();connection.dataset.signature=signature;
    if(!next.connections.length) connection.append(option('Add a model connection in Settings',''));
    for(const entry of next.connections) connection.append(option(`${entry.name}${entry.model?` · ${entry.model}`:''}`,entry.id));
    if(next.connections.some(item=>item.id===current))connection.value=current;
  }

  // This panel is mounted independently of the story editor, so background jobs cannot replace story edits.
  const visualPanel=details('Image descriptions · optional').root;
  const visualBody=visualPanel.querySelector<HTMLDivElement>('.sp-stack')!;
  const visualInfo=paragraph('Reads the original story again for appearance details. Uses normal text-model charges; it does not generate images.','sp-hint');
  const visualSourceNotice=paragraph('','sp-notice');
  const visualSource=field('Original story for these descriptions','',undefined,{area:true,rows:5,hint:'Paste the original story for this draft. Review it before creating descriptions. This stays separate from your Import form.'});visualSource.input.maxLength=MAX_SOURCE;
  const visualSources=new Map<string,string>();const visualSourceOverrides=new Set<string>();let visualSourceKey='';
  visualSource.input.addEventListener('input',()=>{visualSources.set(visualSourceKey,visualSource.input.value);syncVisualControls();});
  const copyImportSource=button('Use story text from Import',()=>{
    visualSource.input.value=source.input.value;visualSources.set(visualSourceKey,source.input.value);
    notify('Story text copied from Import for your review. Check that it belongs to this draft before creating descriptions.');syncVisualControls();
  });
  const visualWebsite=details('Read the original story from a website');
  const visualWebsiteUrl=field('Story website for descriptions','',undefined,{type:'url',placeholder:'https://…'});
  const visualWebsitePages=field('Other description page links','',undefined,{area:true,rows:2,hint:'Optional: other pages in reading order. Leave blank to follow the website’s next-page links.'});visualWebsitePages.input.maxLength=409600;
  const visualWebSources=new Map<string,{url:string;pages:string}>(),visualCollections=new Map<string,WebCollection>();
  for(const input of [visualWebsiteUrl.input,visualWebsitePages.input])input.addEventListener('input',()=>visualWebSources.set(visualSourceKey,{url:visualWebsiteUrl.input.value,pages:visualWebsitePages.input.value}));
  const visualWebsiteStatus=paragraph('','sp-hint');visualWebsiteStatus.setAttribute('role','status');
  const visualWebsiteUse=button('Use website text for descriptions',()=>{
    if(otherWorkBusy()||visualsBusy())throw new Error('Wait for the current operation to finish before choosing story text.');
    const collection=visualCollections.get(visualSourceKey);if(!collection?.pages.length)throw new Error('Read the story website first.');
    visualSource.input.value=collection.text;visualSources.set(visualSourceKey,collection.text);visualSourceOverrides.add(visualSourceKey);
    notify(`${collection.pages.length} pages selected for image descriptions. Review the story text and page count before creating descriptions.`);syncVisualControls();
  });visualWebsiteUse.hidden=true;
  const visualWebsiteCancel=button('Cancel website loading',()=>webAbort?.abort());visualWebsiteCancel.hidden=true;
  const visualWebsiteRead=button('Read linked story pages',async()=>{
    if(otherWorkBusy()||visualsBusy())throw new Error('Wait for the current operation to finish before reading story pages.');
    const signature=visualSourceKey,controller=new AbortController();webAbort=controller;loadingPages=true;
    visualCollections.delete(signature);visualWebsiteUse.hidden=true;visualWebsiteCancel.hidden=false;syncImportControls();
    const selectedUrl=visualWebsiteUrl.input.value,supplied=visualWebsitePages.input.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
    try{
      const result=await collectStoryPages({url:selectedUrl,linked:true,otherUrls:supplied.length?supplied:undefined,signal:controller.signal,onProgress:progress=>{
        if(!destroyed&&visualSourceKey===signature)visualWebsiteStatus.textContent=`${progress.pages.length} pages collected · ${progress.characters.toLocaleString()} characters${progress.loadingUrl?' · reading next page…':''}`;
      }},pageUrl=>rpc.request<WebStoryPage>('fetch-url',{url:pageUrl}));
      if(destroyed||webAbort!==controller)return;
      visualCollections.set(signature,result);
      if(visualSourceKey===signature){visualWebsiteStatus.textContent=`${result.pages.length} pages collected · ${result.text.length.toLocaleString()} characters. ${result.message}`;visualWebsiteUse.hidden=!result.pages.length;}
      notify(result.pages.length?'Website text is ready. Check the page count, then choose Use website text for descriptions.':result.message,result.pages.length||result.reason==='cancelled'?'info':'error');
    }finally{if(webAbort===controller){webAbort=null;loadingPages=false;if(!destroyed){visualWebsiteCancel.hidden=true;syncImportControls();}}}
  });
  visualWebsite.body.append(paragraph('Reads all linked pages using the same website importer as Import. This makes no model request and does not replace your completed draft.','sp-hint'),visualWebsiteUrl.wrap,visualWebsitePages.wrap,visualWebsiteRead,visualWebsiteCancel,visualWebsiteStatus,visualWebsiteUse);
  const visualSourceBox=group(visualWebsite.root,visualSource.wrap,copyImportSource);
  const replaceVisualSource=button('Use different story text',()=>{if(draft){visualSourceOverrides.add(visualDraftSignature(draft));renderVisuals();visualSource.input.focus();}});
  const visualConnection=selectField('Image description connection',[],'');
  const visualSettings=details('Description response settings');
  let visualSettingsDirty=false;let visualSettingsJobId:string|null|undefined;
  const visualAllowance=selectField('Description response allowance',responseAllowances,'16000',()=>{visualSettingsDirty=true;});
  const visualReasoning=selectField('Description reasoning mode',reasoningModes,'inherit',()=>{visualSettingsDirty=true;});
  const visualSettingsGrid=node('div','sp-grid');visualSettingsGrid.append(visualAllowance.wrap,visualReasoning.wrap);visualSettings.body.append(visualSettingsGrid,paragraph(responseSettingsHint,'sp-hint'));
  const visualProgress=node('div','sp-progress');visualProgress.hidden=true;
  const visualProgressText=paragraph('','sp-small');visualProgressText.setAttribute('role','status');visualProgressText.setAttribute('aria-live','polite');
  const visualProgressBar=node('progress');visualProgressBar.max=1;visualProgressBar.value=0;visualProgressBar.setAttribute('aria-label','Image description progress');
  const visualCancel=button('Cancel descriptions',async()=>{await rpc.request('cancel-visuals');notify('Description cancellation requested. Completed steps are retained.');await refresh();});
  const visualResumeHint=paragraph('','sp-hint');
  const visualResume=button('Resume saved descriptions',async()=>{
    if(otherWorkBusy()||visualsBusy())throw new Error('Wait for the current operation to finish before resuming descriptions.');
    if(!snapshot?.visuals?.resumeAvailable||!draft||snapshot.visuals.requestSignature!==visualDraftSignature(draft))throw new Error('The saved descriptions belong to a different version of the draft.');
    const retryUncertain=snapshot.visuals.retryUncertain;
    visualsStarting=true;syncImportControls();
    try{
      await rpc.request('resume-visuals',{...readResponseSettings(visualAllowance.input,visualReasoning.input),...(retryUncertain?{retryUncertain:true}:{})});
      visualSettingsDirty=false;notify('Resuming the saved description request. Current story edits and source fields are unchanged.');await refresh();
    }finally{visualsStarting=false;if(!destroyed)syncImportControls();}
  });
  visualProgress.append(visualProgressText,visualProgressBar,visualCancel,visualResumeHint,visualResume);
  const visualCreate=button('Create image descriptions',async()=>{
    if(otherWorkBusy()||visualsBusy())throw new Error('Wait for the current operation to finish before creating descriptions.');
    if(!draft)throw new Error('Create or open a story draft first.');
    const requested=clone(draft),signature=visualDraftSignature(requested),sourceBound=snapshot?.visuals?.sourceSignature===signature&&!visualSourceOverrides.has(signature);
    if(!visualConnection.input.value)throw new Error('Choose an image description connection.');
    const sourceText=visualSource.input.value;
    if(!sourceBound&&(sourceText.trim().length<100||sourceText.length>MAX_SOURCE))throw new Error('Supply between 100 and 500,000 characters of the original story for these descriptions.');
    visualsStarting=true;syncImportControls();
    try{
      await rpc.request('start-visuals',{draft:requested,connectionId:visualConnection.input.value,...readResponseSettings(visualAllowance.input,visualReasoning.input),...(!sourceBound?{sourceText}:{})});
      visualSourceOverrides.delete(signature);visualSettingsDirty=false;notify('Creating optional image descriptions. Your story draft remains editable.');await refresh();
    }finally{visualsStarting=false;if(!destroyed)syncImportControls();}
  },true);
  const visualResultNotice=paragraph('','sp-notice');visualResultNotice.hidden=true;visualResultNotice.dataset.visualResultNotice='';
  const visualResults=node('div','sp-stack');
  type VisualEditor={pack:VisualPack;dirty:boolean;serverVersion:string};
  const visualEditors=new Map<string,VisualEditor>();let visualEditorKey='';let visualEditorRef:VisualEditor|undefined;
  const loadVisualResult=button('Load new descriptions',()=>{
    const current=snapshot?.visuals;if(!draft||!current?.pack||current.resultSignature!==visualDraftSignature(draft))return;
    visualEditors.set(current.resultSignature,{pack:clone(current.pack),dirty:false,serverVersion:JSON.stringify(current.pack)});visualEditorRef=undefined;renderVisuals();notify('New descriptions loaded.');
  });loadVisualResult.hidden=true;
  visualBody.append(visualInfo,visualSourceNotice,replaceVisualSource,visualSourceBox,visualConnection.wrap,visualSettings.root,visualCreate,visualProgress,visualResultNotice,loadVisualResult,visualResults);
  function visualsBusy(){return visualsStarting||snapshot?.visuals?.job?.status==='running';}
  function otherWorkBusy(){return loadingPages||adaptationStarting||connectionChecking||snapshot?.job?.status==='running';}
  function syncVisualControls(){
    const busy=!!(otherWorkBusy()||visualsBusy());
    visualCreate.disabled=busy||!draft||!visualConnection.input.value;
    visualResume.disabled=busy||!snapshot?.visuals?.resumeAvailable||!draft||snapshot.visuals.requestSignature!==visualDraftSignature(draft);
    visualConnection.input.disabled=busy;visualAllowance.input.disabled=busy;visualReasoning.input.disabled=busy;
    visualSource.input.disabled=busy;replaceVisualSource.disabled=busy;copyImportSource.disabled=busy||!source.input.value.trim();
    visualWebsiteRead.disabled=busy;visualWebsiteUse.disabled=busy;visualWebsiteUrl.input.disabled=busy;visualWebsitePages.input.disabled=busy;
  }
  async function copyVisualText(value:string,field:HTMLInputElement|HTMLTextAreaElement,label:string){
    if(!value.trim())throw new Error(`There is no ${label.toLowerCase()} to copy yet.`);
    try{
      const clipboard=field.ownerDocument.defaultView?.navigator.clipboard;
      if(!clipboard?.writeText)throw new Error('Clipboard unavailable');
      await clipboard.writeText(value);notify(`${label} copied.`);
    }catch{
      field.focus();field.select();notify('Clipboard access is unavailable. The text is selected; copy it using your keyboard or context menu.');
    }
  }
  function renderVisualEditor(editor:VisualEditor,signature:string){
    visualResults.replaceChildren();const pack=editor.pack;
    const badge=node('span','sp-tag',editor.dirty?'Unsaved description edits':'Descriptions ready');visualResults.append(badge);
    const change=()=>{editor.dirty=true;badge.textContent='Unsaved description edits';for(const update of approvedControls.values())update();};
    for(const warning of pack.warnings)visualResults.append(paragraph(warning,'sp-notice'));
    const copyHint=paragraph('Copy appearance tags and outfit tags into the corresponding Lumi Studio fields. Use the combined Anima tags or caption for a prompt. Suggested details are excluded until you choose to include them. No images are generated or sent automatically.','sp-hint');visualResults.append(copyHint);
    for(const profile of pack.profiles){
      const name=draft?.cast.find(person=>person.id===profile.characterId)?.name??profile.characterId;
      const entry=details(name);let includeSuggestions=false;
      if(profile.reviewFacts?.length){
        entry.root.open=true;
        const review=details('Source facts to review'),facts=profile.reviewFacts,items=group(),count=paragraph('','sp-hint');let shown=0;
        const more=button('Show more source facts',()=>showFacts());
        function showFacts(){
          for(const fact of facts.slice(shown,shown+8))items.append(group(node('span','sp-label',fact.kind==='identity'?'Subject':fact.kind==='clothing'?'Starting outfit':'Appearance'),paragraph(fact.text,'sp-small'),paragraph(`Source: ${fact.sourceRefs.join(' · ')}`,'sp-hint')));
          shown=Math.min(facts.length,shown+8);count.textContent=`Showing ${shown} of ${facts.length} retained source facts.`;more.hidden=shown>=facts.length;
        }
        showFacts();review.root.open=true;
        review.body.append(paragraph('These extracted facts were not cited in the generated description. Some may already be expressed in different words. Compare them with the fields below and add any missing details you want. They stay in this backup but are not automatically included in copied prompts or approved appearances.','sp-hint'),count,items,more);entry.body.append(review.root);
      }
      const editable=(label:string,value:string,assign:(value:string)=>void,hint?:string)=>field(label,value,v=>{assign(v);change();updatePrompts();},{area:true,rows:3,hint});
      const appearance=editable(`${name}: appearance from the story`,profile.description,v=>profile.description=v,'Source facts only. Keep invented choices in Suggested details below.');
      const outfit=editable(`${name}: starting outfit from the story`,profile.startingOutfit,v=>profile.startingOutfit=v);
      const subject=editable(`${name}: caption subject`,profile.subject,v=>profile.subject=v);
      const count=selectField(`${name}: Anima subject tag`,[['','No count tag'],['1girl','1girl'],['1boy','1boy'],['1other','1other']],profile.countTag,()=>{profile.countTag=count.input.value as typeof profile.countTag;change();updatePrompts();});
      const tagField=(label:string,values:string[],assign:(value:string[])=>void,limit=32)=>editable(label,values.join(', '),v=>assign(v.split(',').map(tag=>tag.trim()).filter(Boolean)),`Up to ${limit} tags, separated by commas. Use short, lowercase descriptions.`);
      const appearanceTags=tagField(`${name}: appearance tags`,profile.appearanceTags,v=>profile.appearanceTags=v);
      const outfitTags=tagField(`${name}: outfit tags`,profile.outfitTags,v=>profile.outfitTags=v,12);
      const suggestions=details('Suggested details · not source facts');
      const suggested=editable(`${name}: suggested details`,profile.suggestedDetails,v=>profile.suggestedDetails=v);
      const suggestedTags=tagField(`${name}: suggested tags`,profile.suggestedTags,v=>profile.suggestedTags=v);suggestions.body.append(suggested.wrap,suggestedTags.wrap);
      const include=node('input');include.type='checkbox';include.setAttribute('aria-label',`${name}: include suggested details in copied prompts`);include.style.width='auto';
      const includeLabel=node('label','sp-small','Include suggested details in copied prompts');includeLabel.prepend(include);
      include.addEventListener('change',()=>{includeSuggestions=include.checked;updatePrompts();});
      const tags=field(`${name}: Anima tags to copy`,'',undefined,{area:true,rows:3});tags.input.readOnly=true;
      const caption=field(`${name}: caption to copy`,'',undefined,{area:true,rows:3});caption.input.readOnly=true;
      function updatePrompts(){tags.input.value=visualTagPrompt(profile,includeSuggestions);caption.input.value=visualCaption(profile,includeSuggestions);}
      updatePrompts();
      entry.body.append(appearance.wrap,button(`Copy ${name} appearance`,()=>{if(emptyVisualText(profile.description))throw new Error('Enter the reviewed appearance before copying it.');return copyVisualText(profile.description,appearance.input,'Appearance');}),outfit.wrap,button(`Copy ${name} outfit`,()=>{if(emptyVisualText(profile.startingOutfit))throw new Error('Enter the reviewed outfit before copying it.');return copyVisualText(profile.startingOutfit,outfit.input,'Outfit');}),subject.wrap,count.wrap,appearanceTags.wrap,button(`Copy ${name} appearance tags`,()=>copyVisualText(profile.appearanceTags.join(', '),appearanceTags.input,'Appearance tags')),outfitTags.wrap,button(`Copy ${name} outfit tags`,()=>copyVisualText(profile.outfitTags.join(', '),outfitTags.input,'Outfit tags')),suggestions.root);
      if(profile.unknowns.length){entry.body.append(node('span','sp-label','Not established in the source'));for(const unknown of profile.unknowns)entry.body.append(paragraph(unknown,'sp-notice'));}
      if(profile.sourceRefs.length)entry.body.append(paragraph(`Source: ${profile.sourceRefs.join(' · ')}`,'sp-hint'));
      entry.body.append(includeLabel,tags.wrap,button(`Copy ${name} Anima tags`,()=>copyVisualText(tags.input.value,tags.input,'Anima tags')),caption.wrap,button(`Copy ${name} caption`,()=>copyVisualText(caption.input.value,caption.input,'Caption')));visualResults.append(entry.root);
    }
    visualResults.append(button('Use these appearances in story',()=>{
      if(!draft||visualDraftSignature(draft)!==signature)throw new Error('These descriptions belong to an earlier version of the draft.');
      for(const profile of pack.profiles){
        if(!draft.cast.some(person=>person.id===profile.characterId))continue;
        const existing=draft.appearances?.find(item=>item.characterId===profile.characterId);
        const approve=(value:string,previous?:string)=>incompleteVisualText(value)?previous??'':emptyVisualText(value)?'':value;
        const approved={characterId:profile.characterId,description:approve(profile.description,existing?.description),startingOutfit:approve(profile.startingOutfit,existing?.startingOutfit)};
        const index=draft.appearances?.findIndex(item=>item.characterId===profile.characterId)??-1;
        if(index>=0)draft.appearances![index]=approved;else(draft.appearances??=[]).push(approved);
      }
      draftDirty=true;renderReview();notify('Source appearances copied into the approved story fields. Review them, then Save draft or Save to Lumiverse. Suggestions were not copied. Retained source facts stay separate; incomplete fields keep your earlier approved choice.');
    }),paragraph('Replaces the approved appearance and starting outfit fields with the source prose shown here. Unspecified details stay blank; incomplete fields keep your earlier approved choice. Retained source facts and suggested details are not copied. Review and edit the prose before approving it.','sp-hint'));
    visualResults.append(row(button('Save descriptions',async()=>{
      if(!draft||visualDraftSignature(draft)!==signature)throw new Error('These descriptions belong to an earlier version of the draft.');
      const requested=clone(pack),fingerprint=JSON.stringify(requested);
      await rpc.request('save-visuals',{draft:clone(draft),pack:requested});
      if(JSON.stringify(editor.pack)===fingerprint){editor.dirty=false;editor.serverVersion=fingerprint;badge.textContent='Descriptions saved';}
      notify('Image descriptions saved separately from your story draft.');await refresh();
    }),button('Export descriptions',()=>download(`${draft?.title.replace(/[^a-z0-9_-]+/gi,'-').slice(0,60)||'set-points'}-image-descriptions.json`,pack))));
  }
  function renderVisuals(){
    if(!draft)return;
    const signature=visualDraftSignature(draft),visuals=snapshot?.visuals;
    if(visualSourceKey!==signature){
      visualSourceKey=signature;visualSource.input.value=visualSources.get(signature)??'';
      const website=visualWebSources.get(signature);visualWebsiteUrl.input.value=website?.url??draft.source.url??'';visualWebsitePages.input.value=website?.pages??'';
      const collection=visualCollections.get(signature);visualWebsiteUse.hidden=!collection?.pages.length;visualWebsiteStatus.textContent=collection?`${collection.pages.length} pages collected. ${collection.message}`:'';
    }
    const sourceBound=visuals?.sourceSignature===signature&&!visualSourceOverrides.has(signature);visualSourceBox.hidden=sourceBound;replaceVisualSource.hidden=!sourceBound;
    visualSourceNotice.textContent=sourceBound?'The original source is saved for this draft; Resume uses it without pasting again.':'Choose the original story below: read its website, paste the text, or copy it from Import. Older drafts may need this once. Your completed adaptation is kept.';
    const connectionsSignature=JSON.stringify(snapshot?.connections??[]);
    if(visualConnection.input.dataset.signature!==connectionsSignature){
      const previous=visualConnection.input.value;visualConnection.input.replaceChildren();visualConnection.input.dataset.signature=connectionsSignature;
      for(const item of snapshot?.connections??[])visualConnection.input.append(option(`${item.name}${item.model?` · ${item.model}`:''}`,item.id));
      if(!visualConnection.input.options.length)visualConnection.input.append(option('Add a model connection in Settings',''));
      if((snapshot?.connections??[]).some(item=>item.id===previous))visualConnection.input.value=previous;
      else if(visuals?.connectionId&&(snapshot?.connections??[]).some(item=>item.id===visuals.connectionId))visualConnection.input.value=visuals.connectionId;
    }
    const job=visuals?.job,running=job?.status==='running',requestMatches=visuals?.requestSignature===signature,canResume=!!visuals?.resumeAvailable&&!running&&requestMatches;
    if(!visualSettingsDirty||visualSettingsJobId!==(job?.id??null)){
      visualSettingsJobId=job?.id??null;visualSettingsDirty=false;
      visualAllowance.input.value=String(visuals?.maxOutputTokens??16000);visualReasoning.input.value=visuals?.reasoningMode??'inherit';
    }
    visualProgress.hidden=!job&&!canResume;visualCancel.hidden=!running;visualResume.hidden=!canResume;visualResumeHint.hidden=!canResume;
    if(job){visualProgressText.textContent=(!requestMatches?'Descriptions for another version of the draft. ':'')+(job.status==='failed'&&job.phase?`Stopped during ${job.phase}. ${job.error||job.label}`:job.error||job.label);visualProgressBar.max=Math.max(1,job.total);visualProgressBar.value=Math.min(job.completed,visualProgressBar.max);}
    visualResume.textContent=visuals?.retryUncertain?'Retry unfinished description request':'Resume saved descriptions';
    visualResumeHint.textContent='Resumes the saved draft and source, independent of current edits. Completed steps are reused; remaining requests use normal model charges.'+(visuals?.retryUncertain?' Its previous outcome is unknown and it may already have been charged. Retrying can charge that request again.':'');
    const matching=!!visuals?.pack&&visuals.resultSignature===signature;
    let editor=visualEditors.get(signature);
    if(matching){
      const version=JSON.stringify(visuals.pack);
      if(!editor||(!editor.dirty&&editor.serverVersion!==version)){editor={pack:clone(visuals.pack!),dirty:false,serverVersion:version};visualEditors.set(signature,editor);}
    }
    const newer=!!(matching&&editor?.dirty&&editor.serverVersion!==JSON.stringify(visuals?.pack));
    loadVisualResult.hidden=!newer;visualResultNotice.hidden=!(newer||(!matching&&(visuals?.pack||visualEditors.size)));
    if(!matching)editor=undefined;
    visualResultNotice.textContent=newer?'New descriptions are ready. Loading them replaces your unsaved description edits.':'Descriptions for a different version of the draft are hidden. Your story edits and saved descriptions are preserved.';
    if(visualEditorKey!==signature||visualEditorRef!==editor){visualEditorKey=signature;visualEditorRef=editor;if(editor)renderVisualEditor(editor,signature);else visualResults.replaceChildren();}
    for(const update of approvedControls.values())update();syncVisualControls();
  }

  const draftFileInput=node('input');draftFileInput.type='file';draftFileInput.accept='.json,application/json';draftFileInput.hidden=true;draftFileInput.setAttribute('aria-label','Open saved Set Points draft');app.append(draftFileInput);
  const openDraftButton=button('Open draft',()=>draftFileInput.click());
  const pasteDraftPanel=node('section','sp-card sp-stack');pasteDraftPanel.hidden=true;pasteDraftPanel.setAttribute('aria-label','Restore draft backup');
  const pastedDraft=field('Paste draft JSON','',undefined,{area:true,rows:10,hint:'Paste a complete Set Points story-draft backup. Opening it replaces the current Review draft only after validation.'});
  const pasteDraftButton=button('Paste draft backup',()=>{pasteDraftPanel.hidden=false;pastedDraft.input.focus();});
  const openPastedDraft=button('Open pasted draft',async()=>{await restoreDraftText(pastedDraft.input.value);pasteDraftPanel.hidden=true;});
  pasteDraftPanel.append(node('h3','','Restore a draft backup'),pastedDraft.wrap,row(openPastedDraft,button('Close restore',()=>{pasteDraftPanel.hidden=true;})));app.insertBefore(pasteDraftPanel,panels.import);
  async function restoreDraftText(text:string){
    if(openingDraft)throw new Error('Wait for the current draft to finish opening.');
    openingDraft=true;
    try{
      if(text.length>MAX_BACKUP)throw new Error('This draft backup is too large. Open a backup with up to 384,000 characters; the validated story draft must fit within 192,000 characters.');
      let imported:unknown;try{imported=JSON.parse(text);}catch{throw new Error('This backup could not be read. Use a complete Set Points draft exported from Review.');}
      const before=JSON.stringify(draft),revision=draftRevision;
      notify('Checking the saved draft…');const restored=await rpc.request<StoryDraft>('save-draft',{draft:imported});if(destroyed)return;
      if(snapshot)snapshot.draft=clone(restored);
      if(JSON.stringify(draft)!==before||draftRevision!==revision){pendingReplacement=clone(restored);newDraftNotice.hidden=false;selectTab('review');notify('The backup was validated and saved. Your newer Review edits were kept. Choose Load new draft when ready to replace them.');return;}
      draft=clone(restored);pendingReplacement=null;draftDirty=false;draftRevision++;draftVersion=JSON.stringify(restored);
      newDraftNotice.hidden=true;renderReview();selectTab('review');notify('Draft opened and saved. Review it before saving the character card.');
    }finally{openingDraft=false;}
  }
  draftFileInput.addEventListener('change',()=>void run(openDraftButton,async()=>{
    const file=draftFileInput.files?.[0];if(!file)return;
    try{
      if(!/\.json$/i.test(file.name))throw new Error('Choose a Set Points draft saved as a .json file.');
      if(file.size>MAX_BACKUP*4)throw new Error('This draft file is too large. Open a backup with up to 384,000 characters.');
      await restoreDraftText(await file.text());
    }finally{draftFileInput.value='';}
  }));

  function renderReview() {
    const panel=panels.review;panel.replaceChildren();panelNonce++;approvedControls.clear();
    if(!draft) {
      const top=intro('Meet your adaptation','A little preparation makes room for a better story.');top.append(row(openDraftButton,pasteDraftButton));panel.append(top);
      const empty=node('div','sp-empty');empty.append(node('span','sp-tag','Your draft belongs here'),paragraph('Import a story to review its cast, lore, and scene openings.'),button('Bring in a story',()=>selectTab('import'),true));panel.append(empty);return;
    }
    const current=draft;const nonce=panelNonce;
    const top=intro('Make it yours','Edit the cast, the world, and the moments you want to reach.');const dirtyTag=node('span','sp-tag',draftDirty?'Unsaved edits':'Draft ready');top.append(group(dirtyTag,row(openDraftButton,pasteDraftButton)));panel.append(top);
    const markDirty=()=> { draftDirty=true;dirtyTag.textContent='Unsaved edits';renderVisuals(); };
    const reviewFields=new Map<string,HTMLElement>();
    const edit=(label:string,value:string,change:(value:string)=>void,area=false,hint?:string,key?:string)=>{const item=field(label,value,v=>{change(v);markDirty();},{area,hint});if(key)reviewFields.set(key,item.input);return item.wrap;};
    const summary=node('div','sp-card sp-stack');summary.append(edit('Title',current.title,v=>current.title=v,false,undefined,'title'),edit('Premise',current.premise,v=>current.premise=v,true,undefined,'premise'));
    const choices=node('div','sp-grid');choices.append(edit('Your role',current.playerRole,v=>current.playerRole=v,false,undefined,'playerRole'),edit('Starting point',current.startingPoint,v=>current.startingPoint=v,false,undefined,'startingPoint'));summary.append(choices);
    const counts=node('div','sp-counts');for(const [number,label] of [[current.cast.length,'characters'],[current.lore.length,'lore entries'],[current.scenes.length,'scenes']] as const){ const item=node('div');item.append(node('strong','',String(number)),node('span','',label));counts.append(item);}summary.append(counts);panel.append(summary);
    if(current.warnings.length) { const warnings=details(`${current.warnings.length} adaptation note${current.warnings.length===1?'':'s'}`);for(const warning of current.warnings)warnings.body.append(paragraph(warning,'sp-notice'));panel.append(warnings.root); }
    const narration=details('Narrator direction');narration.body.append(edit('Instructions',current.narratorInstructions,v=>current.narratorInstructions=v,true,'Describe the narrator’s scope and how it should leave your choices open.','narratorInstructions'));panel.append(narration.root);
    const cast=node('div','sp-review-group');cast.append(node('div','sp-section-label','The people'));
    const appearanceGuide=group(node('h3','','Appearance guide'),paragraph('Your approved appearance and starting outfit are the story’s reference, ahead of conflicting incidental descriptions. Blank fields let the narrator fill missing supporting-character details, using existing story facts first and keeping introduced looks consistent. You can start playing without describing everyone. These choices become lorebook guidance when saved to Lumiverse; editing them uses no model.','sp-small'),paragraph('Review existing lore and scene openings for conflicting details. Saved or forced scene openings are literal text and are not automatically rewritten. The narrator may still need corrections. Your own character’s unspecified appearance stays yours to choose.','sp-hint'));appearanceGuide.classList.add('sp-card');cast.append(appearanceGuide);
    for(const person of current.cast) {
      const entry=details(person.name);entry.body.append(edit('Name',person.name,v=>{person.name=v;entry.summary.textContent=v;},false,undefined,`cast:${person.id}:name`),edit('Also known as',person.aliases.join(', '),v=>person.aliases=v.split(',').map(x=>x.trim()).filter(Boolean),false,undefined,`cast:${person.id}:aliases`),edit('Personality',person.personality,v=>person.personality=v,true,undefined,`cast:${person.id}:personality`),edit('Voice & manner',person.voice,v=>person.voice=v,true,undefined,`cast:${person.id}:voice`),edit('Relationships at the start',person.relationships,v=>person.relationships=v,true,undefined,`cast:${person.id}:relationships`),edit('Knowledge at the start',person.knowledge,v=>person.knowledge=v,true,undefined,`cast:${person.id}:knowledge`));
      const approved=()=>current.appearances?.find(item=>item.characterId===person.id);
      const setApproved=(key:'description'|'startingOutfit',value:string)=>{
        let appearance=approved();if(!appearance){appearance={characterId:person.id,description:'',startingOutfit:''};(current.appearances??=[]).push(appearance);}appearance[key]=value;updateApproved();
      };
      const approvedCaption=field(`${person.name}: approved caption to copy`,'',undefined,{area:true,rows:2,hint:'Copies only the appearance and outfit you approved. Free text is not automatically converted to image tags.'});approvedCaption.input.readOnly=true;
      const approvedCopy=button(`Copy ${person.name} approved caption`,()=>copyVisualText(approvedCaption.input.value,approvedCaption.input,'Approved caption'));
      const appearanceMismatch=paragraph('Your approved look differs from the source-analysis descriptions. The source tag and caption buttons still contain that older look. Use the approved caption here, or deliberately update the source-analysis fields before copying their prompts.','sp-notice');appearanceMismatch.hidden=true;
      function updateApproved(){
        const choice=approved();approvedCaption.input.value=[choice?.description,choice?.startingOutfit].map(value=>value?.trim()??'').filter(Boolean).join(' ');approvedCopy.disabled=!approvedCaption.input.value;
        const signature=visualDraftSignature(current),profile=snapshot?.visuals?.resultSignature===signature?visualEditors.get(signature)?.pack.profiles.find(item=>item.characterId===person.id):undefined;
        const normalized=(value:string)=>emptyVisualText(value)?'':value.trim().replace(/\s+/g,' ');
        appearanceMismatch.hidden=!(choice&&profile&&(normalized(choice.description)!==normalized(profile.description)||normalized(choice.startingOutfit)!==normalized(profile.startingOutfit)));
      }
      approvedControls.set(person.id,updateApproved);updateApproved();
      entry.body.append(edit(`${person.name}: approved appearance`,approved()?.description??'',v=>setApproved('description',v),true,'Your chosen physical details stay fixed. For supporting characters, leave missing traits for the narrator to fill. This is independent of generated source facts.'),edit(`${person.name}: approved starting outfit`,approved()?.startingOutfit??'',v=>setApproved('startingOutfit',v),true,'Your chosen outfit at the start. For supporting characters, leave blank for the narrator. Edit conflicting lore or scene openings separately.'),appearanceMismatch,approvedCaption.wrap,approvedCopy);
      if(person.sourceRefs.length)entry.body.append(paragraph(`Source: ${person.sourceRefs.join(' · ')}`,'sp-hint'));cast.append(entry.root);
    }panel.append(cast);
    const mentions=details('Check for conflicting looks · optional');const mentionResults=group(),mentionStatus=paragraph('','sp-hint');mentionStatus.setAttribute('role','status');
    let foundMentions:ReturnType<typeof appearanceMentions>=[],shownMentions=0;
    const showMoreMentions=button('Show more excerpts',()=>showMentions());showMoreMentions.hidden=true;
    function showMentions(){
      const next=foundMentions.slice(shownMentions,shownMentions+8);
      for(const mention of next){
        const open=button('Open location',()=>{
          const target=reviewFields.get(mention.fieldKey);if(!target)return;
          for(let parent:HTMLElement|null=target;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')(parent as HTMLDetailsElement).open=true;
          target.scrollIntoView?.({block:'center',behavior:'smooth'});target.focus();
        });
        mentionResults.append(group(node('span','sp-label',mention.location),paragraph(mention.text,'sp-small'),open));
      }
      shownMentions+=next.length;showMoreMentions.hidden=shownMentions>=foundMentions.length;
      mentionStatus.textContent=foundMentions.length?`Showing ${shownMentions} of ${foundMentions.length} short excerpts. These are possible mentions, not confirmed conflicts.`:'No matching appearance words found. Other descriptions may still exist.';
    }
    const scanMentions=button('Scan appearance mentions',()=>{
      foundMentions=appearanceMentions(current);shownMentions=0;mentionResults.replaceChildren();showMentions();scanMentions.textContent='Refresh appearance mentions';
    });
    mentions.body.append(paragraph('Use this only if you want to check an existing look against your approved description. You do not need to read whole passages: compare the short snippets, then Open location to edit any conflicting detail. Ordinary glances and clothing changes may be fine.','sp-hint'),scanMentions,mentionStatus,mentionResults,showMoreMentions);panel.append(mentions.root,visualPanel);renderVisuals();
    const lore=node('div','sp-review-group');lore.append(node('div','sp-section-label','The world'));
    for(const item of current.lore) { const entry=details(item.name);entry.body.append(edit('Entry name',item.name,v=>{item.name=v;entry.summary.textContent=v;}),edit('Keywords',item.keys.join(', '),v=>item.keys=v.split(',').map(x=>x.trim()).filter(Boolean)),edit('Lore',item.content,v=>item.content=v,true,undefined,`lore:${item.id}:content`));lore.append(entry.root); }panel.append(lore);
    const scenes=node('div','sp-review-group');scenes.append(node('div','sp-section-label','The set points'),paragraph('Each scene opens a situation. Your next action stays yours.','sp-hint'));
    current.scenes.forEach((scene,index)=> {
      const entry=details(`${String(index+1).padStart(2,'0')}  ${scene.title}${index===0?' · Opening':''}`);
      entry.body.append(edit('Scene title',scene.title,v=>{scene.title=v;entry.summary.textContent=`${String(index+1).padStart(2,'0')}  ${v}`;},false,undefined,`scene:${scene.id}:title`),edit('Scene opening',scene.greeting,v=>scene.greeting=v,true,undefined,`scene:${scene.id}:greeting`),edit('Private direction',scene.direction,v=>scene.direction=v,true,'Guides the model toward this scene during play.',`scene:${scene.id}:direction`));
      if(scene.assumptions.length) {entry.body.append(node('span','sp-label','Assumptions to review'));scene.assumptions.forEach((assumption,i)=>{const note=paragraph(assumption,'sp-notice');note.tabIndex=-1;reviewFields.set(`scene:${scene.id}:assumption:${i}`,note);entry.body.append(note);});}
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
        newDraftNotice.hidden=!(pendingReplacement||(draftDirty&&draft&&next.draft&&draft.id!==next.draft.id));
        const nextVersion=JSON.stringify(next.draft);
        if(!openingDraft&&!draftDirty&&readRevision===draftRevision&&nextVersion!==draftVersion){draft=next.draft?clone(next.draft):null;draftVersion=nextVersion;renderReview();}
        renderVisuals();renderPlay(next.play);
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
