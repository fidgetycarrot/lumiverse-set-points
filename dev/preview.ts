import { setup } from '../src/frontend';
import { VERSION, type AppSnapshot, type WebStoryPage } from '../src/types';
import { demoDraft } from './fixture';
import type { SpindleFrontendContext } from 'lumiverse-spindle-types';

const state:AppSnapshot={version:VERSION,permissions:[],connections:[{id:'preview-model',name:'My writing model',provider:'OpenAI compatible',model:'configured model'}],job:null,draft:null,saved:null,play:{chatId:'preview-chat',characterId:'preview-card',title:'The Lighthouse Letter',enabled:true,current:0,next:1,scenes:[],canUndo:false,busy:false,notice:''},diagnostics:[]};
let receiver:(payload:unknown)=>void=()=>{};let activate:()=>void=()=>{};let undoIndex=0;
const changes=()=>receiver({type:'set-points:changed'});
function load(){state.draft=structuredClone(demoDraft);state.play.scenes=structuredClone(demoDraft.scenes);changes();}
const root=document.getElementById('root')!;
const previewPageUrl=(index:number)=>`https://preview.example/lighthouse?page=${index}`;
function fetchPreviewPage(raw:string):WebStoryPage {
  const url=new URL(raw);const index=Number(url.searchParams.get('page'));
  if(url.origin!=='https://preview.example'||url.pathname!=='/lighthouse'||!Number.isInteger(index)||index<1||index>3)throw new Error('This local preview only loads its three mock pages. Choose Try linked-page preview to fill their address.');
  return {title:`The Lighthouse Letter · page ${index}`,url:previewPageUrl(index),text:demoDraft.scenes[index-1].greeting,nextPages:index<3?[{title:'Next page',url:previewPageUrl(index+1)}]:[]};
}

const ctx={ui:{registerDrawerTab:()=>({root,tabId:'preview',setBadge:()=>{},activate:()=>activate(),setTitle:()=>{},setShortName:()=>{},destroy:()=>{},onActivate:(callback:()=>void)=>{activate=callback;return()=>{};}}),registerInputBarAction:()=>({onClick:()=>()=>{},destroy:()=>{},setLabel:()=>{},setSubtitle:()=>{},setEnabled:()=>{}})},dom:{addStyle:(css:string)=>{const style=document.createElement('style');style.textContent=css;document.head.append(style);return()=>style.remove();}},events:{on:()=>()=>{}},getActiveChat:()=>({chatId:'preview-chat',characterId:'preview-card'}),ready:()=>{},onBackendMessage:(handler:(payload:unknown)=>void)=>{receiver=handler;return()=>{};},sendToBackend:(request:any)=>{setTimeout(()=>{let result:unknown;try{switch(request.action){case'snapshot':result=structuredClone(state);break;case'fetch-url':result=fetchPreviewPage(request.input.url);break;case'test-connection':result={message:'Preview: the provider accepted the neutral test request.'};break;case'resume-import':case'start-import':state.resume={available:false,retryUncertain:false};state.job={id:'preview-job',status:'running',completed:0,total:2,label:'Reading characters and setting…'};result=structuredClone(state.job);setTimeout(()=>{if(state.job?.status!=='running')return;load();state.job={id:'preview-job',status:'complete',completed:2,total:2,label:'Your adaptation is ready.'};changes();},1800);break;case'cancel-import':if(state.job){state.job.status='cancelled';state.resume={available:true,retryUncertain:false};}break;case'save-draft':state.draft=structuredClone(request.input.draft);result=state.draft;break;case'create-card':state.saved={characterId:'preview-character-id',worldBookId:'preview-worldbook-id',draftId:request.input.draft.id,title:request.input.draft.title};state.play.scenes=structuredClone(request.input.draft.scenes);result=state.saved;break;case'play-enable':state.play.enabled=request.input.enabled;result=state.play;break;case'play-next':state.play.next=request.input.index;result=state.play;break;case'play-force':if(state.play.next===null)throw new Error('There is no next scene.');undoIndex=state.play.current;state.play.current=state.play.next;state.play.next=state.play.current+1<state.play.scenes.length?state.play.current+1:null;state.play.canUndo=true;state.play.notice='Preview: the selected scene was inserted.';result=state.play;break;case'play-undo':state.play.next=state.play.current;state.play.current=undoIndex;state.play.canUndo=false;state.play.notice='Preview: the last insertion was undone.';result=state.play;break;case'diagnostics':result={version:VERSION,preview:true,storyTextIncluded:false};break;default:throw new Error('Unknown preview action');}receiver({type:'set-points:response',id:request.id,result:structuredClone(result)});}catch(error){receiver({type:'set-points:response',id:request.id,error:String(error)});}},request.action==='fetch-url'?650:100);}} as unknown as SpindleFrontendContext;
setup(ctx);
document.getElementById('demo')!.onclick=()=>{load();setTimeout(()=>root.querySelector<HTMLButtonElement>('[role="tab"][aria-controls$="-review"]')?.click(),150);};
document.getElementById('theme')!.onclick=()=>document.body.classList.toggle('light');

const linkedPreview=document.createElement('button');linkedPreview.textContent='Try linked-page preview';document.getElementById('demo')!.after(linkedPreview);
linkedPreview.onclick=()=>{
  root.querySelector<HTMLButtonElement>('[role="tab"][aria-controls$="-import"]')?.click();
  const label=Array.from(root.querySelectorAll('label')).find(item=>item.textContent==='Story link');
  const input=label?root.querySelector<HTMLInputElement>(`#${label.htmlFor}`):null;
  if(input){input.value=previewPageUrl(1);input.closest('details')!.open=true;input.focus();input.scrollIntoView({block:'center',behavior:'smooth'});}
};
