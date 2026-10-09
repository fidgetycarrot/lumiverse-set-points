import { describe, expect, test } from 'bun:test';
import type { SpindleAPI, LlmMessageDTO, MessageContentProcessorCtxDTO } from 'lumiverse-spindle-types';
import { SceneRuntime } from '../src/runtime';
import { EXTENSION_ID, type StoryScene } from '../src/types';

const STATE = `${EXTENSION_ID}_state_v1`;
const scenes: StoryScene[] = [
  {id:'harbor',title:'Harbor',greeting:'Iona waits at the harbor.',direction:'Introduce the harbor.',assumptions:[],sourceRefs:[]},
  {id:'letter',title:'The letter',greeting:'A sealed letter rests on the desk. What do you do?',direction:'Reach the chart room.',assumptions:['The player has chosen to enter the chart room.'],sourceRefs:[]},
  {id:'cove',title:'The cove',greeting:'Elias waits beside a stranded boat.',direction:'Meet Elias at the cove.',assumptions:[],sourceRefs:[]},
];
type Message = Awaited<ReturnType<SpindleAPI['chat']['getMessages']>>[number];
function harness() {
  const variables = new Map<string,string>();
  const chats = new Map<string,Message[]>([['a',[]],['b',[]]]);
  const grants = new Set(['characters','chats','chat_mutation','generation','interceptor']);
  let serial = 0;
  let failSaveAfterAppend = false;
  const character = {id:'narrator',name:'Test story',extensions:{[EXTENSION_ID]:{version:1,draftId:'draft',title:'Test story',scenes:structuredClone(scenes)}}};
  function add(chatId:string, role:Message['role'], content:string, extra:Record<string,unknown> = {}, metadata:Record<string,unknown> = {}) {
    const all = chats.get(chatId)!;
    const m = {id:`m${++serial}`,chat_id:chatId,index_in_chat:serial,is_user:role==='user',role,name:role,content,send_date:Date.now(),swipe_id:0,swipes:[content],swipe_dates:[],extra,metadata,parent_message_id:null,branch_id:null,created_at:Date.now()} satisfies Message;
    all.push(m); return m;
  }
  const api = {
    permissions:{has:(permission:string)=>grants.has(permission)},
    chats:{get:async(id:string,userId?:string)=>chats.has(id) && userId !== 'intruder' ? {id,character_id:'narrator',metadata:{}} : null,getActive:async()=>({id:'a',character_id:'narrator',metadata:{}})},
    characters:{get:async()=>structuredClone(character)},
    variables:{chat:{get:async(chatId:string,key:string)=>variables.get(`${chatId}:${key}`)||'',set:async(chatId:string,key:string,value:string)=>{ if(failSaveAfterAppend && chats.get(chatId)!.some(m=>m.metadata?.[EXTENSION_ID])) {failSaveAfterAppend=false;throw new Error('Simulated connection interruption');} variables.set(`${chatId}:${key}`,value); }}},
    chat:{getMessages:async(chatId:string)=>structuredClone(chats.get(chatId)!),appendMessage:async(chatId:string,input:{role:Message['role'];content:string;metadata?:Record<string,unknown>}, options:unknown)=>{expect(options).toEqual({triggerGeneration:false});return{id:add(chatId,input.role,input.content,{},input.metadata).id};},updateMessage:async(chatId:string,id:string,patch:{content?:string;metadata?:Record<string,unknown>})=>{const found=chats.get(chatId)!.find(m=>m.id===id)!;if(patch.content!==undefined){found.content=patch.content;found.swipes[found.swipe_id]=patch.content;}if(patch.metadata)found.metadata=patch.metadata;},deleteMessage:async(chatId:string,id:string)=>{chats.set(chatId,chats.get(chatId)!.filter(m=>m.id!==id));}},
  } as unknown as SpindleAPI;
  const runtime = new SceneRuntime(api, 'user');
  const context = (generationId:string) => ({generationId,generationType:'normal' as const,isDryRun:false});
  const processorContext = (chatId:string,content:string,origin:MessageContentProcessorCtxDTO['origin']='create'):MessageContentProcessorCtxDTO => ({chatId,content,isUser:false,userId:'user',origin});
  async function prepare(chatId='a', generationId='g1') {
    add(chatId,'user','I enter the chart room.');
    const result = await runtime.intercept([],chatId,context(generationId));
    const messages = Array.isArray(result) ? result : result.messages;
    const content = messages.at(-1)?.content;
    if (typeof content !== 'string') throw new Error('Missing guidance');
    const signal = content.match(/<!--SET_POINTS:[a-f0-9]{32}-->/)![0];
    return {signal,content};
  }
  async function saveReply(signal:string,chatId='a',instance=runtime) {
    const input = processorContext(chatId,`Iona opens the door.\n${signal}`);
    const patched = await instance.processContent(input);
    return add(chatId,'assistant',patched?.content ?? input.content,patched?.extra);
  }
  const end = (id:string,generationId='g1',chatId='a')=>runtime.handleEvent('GENERATION_ENDED',{chatId,generationId,messageId:id,generationType:'normal'});
  return {api,runtime,variables,chats,grants,character,add,context,processorContext,prepare,saveReply,end,failNextCommit:()=>{failSaveAfterAppend=true;}};
}

describe('scene progression', () => {
  test('published role guidance remains active with Follow the story off without preparing a handoff',async()=>{
    const h=harness();Object.assign(h.character.extensions[EXTENSION_ID],{roleDirection:'Keep the player identity fixed. Use an external narrator.'});
    await h.runtime.view('a');const before=h.variables.get(`a:${STATE}`),result=await h.runtime.intercept([],'a',h.context('roles-off'));
    expect(result).toEqual([{role:'system',content:'Keep the player identity fixed. Use an external narrator.'}]);expect(h.variables.get(`a:${STATE}`)).toBe(before);
    expect(JSON.stringify(result)).not.toContain('<!--SET_POINTS:');expect(h.chats.get('a')).toHaveLength(0);
    expect(await h.runtime.intercept([],'a',{generationType:'normal',dryRun:true})).toEqual([]);
  });
  test('includes the role guard in story guidance and pauses when that contract changes',async()=>{
    const h=harness();Object.assign(h.character.extensions[EXTENSION_ID],{roleDirection:'The human controls Mara; Iona is a supporting character.'});await h.runtime.setEnabled('a',true);
    const {content}=await h.prepare();expect(content).toContain('The human controls Mara');
    Object.assign(h.character.extensions[EXTENSION_ID],{roleDirection:'The human plays a new visitor.'});expect((await h.runtime.view('a')).enabled).toBe(false);expect((await h.runtime.view('a')).notice).toContain('changed');
  });
  test('rejects unsafe role metadata before injecting it',async()=>{
    const h=harness();Object.assign(h.character.extensions[EXTENSION_ID],{roleDirection:'{{setvar::player::changed}}'});expect(await h.runtime.intercept([],'a',h.context('roles-bad'))).toEqual([]);expect((await h.runtime.view('a')).notice).toContain('invalid role direction');
  });
  test('starts disabled and isolates each chat; force inserts the selected scene',async()=>{
    const h = harness();
    expect((await h.runtime.view('a')).enabled).toBe(false);
    expect(await h.runtime.intercept([],'a',h.context('g0'))).toEqual([]);
    await h.runtime.setEnabled('a',true);
    expect((await h.runtime.view('b')).enabled).toBe(false);
    await h.runtime.selectNext('a',2);
    await h.runtime.force('a');
    expect(h.chats.get('a')!.at(-1)!.content).toBe(scenes[2].greeting);
    expect((await h.runtime.view('a')).current).toBe(2);
    expect((await h.runtime.view('b')).current).toBe(0);
  });
  test('a saved normal handoff advances exactly once and strips the private signal',async()=>{
    const h = harness();await h.runtime.setEnabled('a',true);
    const {signal,content}=await h.prepare();
    expect(content).toContain("The player alone chooses");
    const reply=await h.saveReply(signal);
    expect(reply.content).not.toContain('SET_POINTS');
    await h.end(reply.id);await h.end(reply.id);
    expect(h.chats.get('a')).toHaveLength(3);
    expect(h.chats.get('a')!.at(-1)!.content).toBe(scenes[1].greeting);
    expect((await h.runtime.view('a')).current).toBe(1);
  });
  test('event text, stale history, and a different message cannot authorize a handoff',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);
    const {signal}=await h.prepare();
    const reply=h.add('a','assistant','A reply with no control token.');
    await h.runtime.handleEvent('GENERATION_ENDED',{chatId:'a',generationId:'g1',messageId:reply.id,content:signal});
    expect((await h.runtime.view('a')).current).toBe(0);
    expect(h.chats.get('a')).toHaveLength(2);
  });
  test('normal host generation bypasses processors: saved exact nonce is stripped and advances once',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);
    const {signal}=await h.prepare();const reply=h.add('a','assistant',`Iona opens the door.\n${signal}`);
    await h.end(reply.id);await h.end(reply.id);
    expect(h.chats.get('a')).toHaveLength(3);
    expect(h.chats.get('a')![1].content).toBe('Iona opens the door.');
    expect(h.chats.get('a')![1].swipes[0]).toBe('Iona opens the door.');
    expect((await h.runtime.view('a')).current).toBe(1);
    await h.runtime.undo('a');await h.end(reply.id);
    expect((await h.runtime.view('a')).current).toBe(0);expect(h.chats.get('a')).toHaveLength(2);
  });
  test('v1.2.0 context without generationId uses the prior STARTED identity',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);const user=h.add('a','user','I enter the chart room.');
    await h.runtime.handleEvent('GENERATION_STARTED',{chatId:'a',generationId:'legacy',generationType:'normal'});
    const result=await h.runtime.intercept([{role:'user',content:user.content,sourceMessageId:user.id}],'a',{generationType:'normal',dryRun:false});
    const messages=Array.isArray(result)?result:result.messages;
    const signal=String(messages.at(-1)!.content).match(/<!--SET_POINTS:[a-f0-9]{32}-->/)![0];
    const reply=h.add('a','assistant',`The door opens.\n${signal}`);await h.end(reply.id,'legacy');
    expect((await h.runtime.view('a')).current).toBe(1);expect((await h.runtime.view('a')).busy).toBe(false);
  });
  test('v1.2.0 dryRun previews never change pending state, even during another generation',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);
    const before=h.variables.get(`a:${STATE}`);
    expect(await h.runtime.intercept([],'a',{generationType:'normal',dryRun:true})).toEqual([]);
    expect(h.variables.get(`a:${STATE}`)).toBe(before);
    await h.runtime.handleEvent('GENERATION_STARTED',{chatId:'a',generationId:'actual',generationType:'normal'});
    const result=await h.runtime.intercept([],'a',{generationType:'normal',dryRun:false});
    const after=h.variables.get(`a:${STATE}`);
    expect(await h.runtime.intercept([],'a',{generationType:'normal',dryRun:true})).toEqual([]);
    expect(h.variables.get(`a:${STATE}`)).toBe(after);
    const messages=Array.isArray(result)?result:result.messages;
    const signal=String(messages.at(-1)!.content).match(/<!--SET_POINTS:[a-f0-9]{32}-->/)![0];
    const reply=h.add('a','assistant',signal);await h.end(reply.id,'actual');
    expect((await h.runtime.view('a')).current).toBe(1);
  });
  test('legacy context without a trusted active lifecycle fails without writing state',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);const before=h.variables.get(`a:${STATE}`);
    expect(await h.runtime.intercept([],'a',{generationType:'normal',dryRun:false})).toEqual([]);
    expect(h.variables.get(`a:${STATE}`)).toBe(before);expect((await h.runtime.view('a')).busy).toBe(false);
    await h.runtime.handleEvent('GENERATION_STARTED',{chatId:'a',generationId:'gone',generationType:'normal'});
    await h.runtime.handleEvent('GENERATION_STOPPED',{chatId:'a',generationId:'gone'});
    expect(await h.runtime.intercept([],'a',{generationType:'normal',dryRun:false})).toEqual([]);
  });
  test('legacy staged row created after STARTED is excluded using assembled source IDs',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);const user=h.add('a','user','I enter the chart room.');
    await h.runtime.handleEvent('GENERATION_STARTED',{chatId:'a',generationId:'legacy',generationType:'normal'});
    const staged=h.add('a','assistant','');
    const result=await h.runtime.intercept([{role:'user',content:user.content,sourceMessageId:user.id}],'a',{generationType:'normal',dryRun:false});
    const messages=Array.isArray(result)?result:result.messages;
    const signal=String(messages.at(-1)!.content).match(/<!--SET_POINTS:[a-f0-9]{32}-->/)![0];
    staged.content=`The door opens.\n${signal}`;staged.swipes[0]=staged.content;
    await h.end(staged.id,'legacy');expect((await h.runtime.view('a')).current).toBe(1);
  });
  test('legacy STARTED targetMessageId excludes an already staged assistant row',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);h.add('a','user','I enter the chart room.');const staged=h.add('a','assistant','');
    await h.runtime.handleEvent('GENERATION_STARTED',{chatId:'a',generationId:'legacy',generationType:'normal',targetMessageId:staged.id});
    const result=await h.runtime.intercept([],'a',{generationType:'normal',dryRun:false});
    const messages=Array.isArray(result)?result:result.messages;
    const signal=String(messages.at(-1)!.content).match(/<!--SET_POINTS:[a-f0-9]{32}-->/)![0];
    staged.content=`The door opens.\n${signal}`;staged.swipes[0]=staged.content;
    await h.end(staged.id,'legacy');expect((await h.runtime.view('a')).current).toBe(1);
  });
  test('normal generations with a precreated excluded assistant row can hand off',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);h.add('a','user','I enter the chart room.');
    const staged=h.add('a','assistant','');
    const result=await h.runtime.intercept([],'a',{...h.context('g1'),excludeMessageId:staged.id});
    const messages=Array.isArray(result)?result:result.messages;
    const signal=String(messages.at(-1)!.content).match(/<!--SET_POINTS:[a-f0-9]{32}-->/)![0];
    staged.content=`The door opens.\n${signal}`;staged.swipes[0]=staged.content;
    await h.end(staged.id);expect((await h.runtime.view('a')).current).toBe(1);
  });
  test('raw tokens from old generations and edited proven replies cannot advance',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);
    const {signal}=await h.prepare();await h.runtime.handleEvent('GENERATION_STOPPED',{chatId:'a',generationId:'g1'});
    await h.runtime.setEnabled('a',true);
    await h.prepare('a','g2');const reply=h.add('a','assistant',`Old token ${signal}`);await h.end(reply.id,'g2');
    expect((await h.runtime.view('a')).current).toBe(0);
    const third=await h.prepare('a','g3');const saved=await h.saveReply(third.signal);saved.content='User edited this generated reply.';
    await h.end(saved.id,'g3');expect((await h.runtime.view('a')).current).toBe(0);
  });
  test('rendering, editing, swipes, and stopped generations cannot advance',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);
    const {signal}=await h.prepare();
    for (const origin of ['render','update','swipe_add','swipe_update'] as const) {
      const patch=await h.runtime.processContent(h.processorContext('a',signal,origin));
      expect(patch?.content).toBe('');expect(patch?.extra).toBeUndefined();
    }
    await h.runtime.handleEvent('GENERATION_STOPPED',{chatId:'a',generationId:'g1'});
    const reply=await h.saveReply(signal);
    await h.end(reply.id);
    expect((await h.runtime.view('a')).current).toBe(0);
    expect(h.chats.get('a')).toHaveLength(2);
  });
  test('regeneration and dry runs never inject guidance',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);
    for (const type of ['regenerate','swipe','continue','impersonate','quiet'] as const) {
      expect(await h.runtime.intercept([],'a',{generationId:'g',generationType:type,isDryRun:false})).toEqual([]);
    }
    expect(await h.runtime.intercept([],'a',{...h.context('dry'),isDryRun:true})).toEqual([]);
    expect((await h.runtime.view('a')).busy).toBe(false);
  });
  test('force and scene changes are blocked during generation',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);await h.prepare();
    await expect(h.runtime.force('a')).rejects.toThrow('Wait for the current reply');
    await expect(h.runtime.setEnabled('a',false)).rejects.toThrow('Wait for the current reply');
    await expect(h.runtime.selectNext('a',2)).rejects.toThrow('Wait for the current reply');
    await h.runtime.handleEvent('GENERATION_STOPPED',{chatId:'a',generationId:'g1'});
    await h.runtime.force('a');expect((await h.runtime.view('a')).current).toBe(1);
  });
  test('undo removes only its last insertion and does not reactivate a consumed handoff',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);
    const {signal}=await h.prepare();const reply=await h.saveReply(signal);await h.end(reply.id);
    expect((await h.runtime.view('a')).canUndo).toBe(true);
    await h.runtime.undo('a');await h.end(reply.id);
    expect((await h.runtime.view('a')).current).toBe(0);
    expect((await h.runtime.view('a')).next).toBe(1);
    expect(h.chats.get('a')).toHaveLength(2);
    await h.runtime.force('a');h.add('a','user','I open it.');
    expect((await h.runtime.view('a')).canUndo).toBe(false);
    await expect(h.runtime.undo('a')).rejects.toThrow('before another user or assistant message');
  });
  test('restart recovers an append committed before state save without adding a duplicate',async()=>{
    const h=harness();await h.runtime.view('a');h.failNextCommit();
    await expect(h.runtime.force('a')).rejects.toThrow('Simulated connection');
    expect(h.chats.get('a')).toHaveLength(1);
    const restarted=new SceneRuntime(h.api,'user');
    const view=await restarted.view('a');
    expect(view.current).toBe(1);expect(view.canUndo).toBe(true);
    expect(h.chats.get('a')).toHaveLength(1);
    await restarted.undo('a');expect(h.chats.get('a')).toHaveLength(0);
  });
  test('a new runtime can consume an already saved proven reply when the end event arrives',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);
    const {signal}=await h.prepare();const reply=await h.saveReply(signal);
    const restarted=new SceneRuntime(h.api,'user');
    await restarted.handleEvent('GENERATION_ENDED',{chatId:'a',generationId:'g1',messageId:reply.id});
    expect((await restarted.view('a')).current).toBe(1);
  });
  test('card edits pause progress and discard old authorization',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);
    const {signal}=await h.prepare();const reply=await h.saveReply(signal);
    h.character.extensions[EXTENSION_ID].scenes[1].greeting='The chart room is empty.';
    await h.end(reply.id);
    const view=await h.runtime.view('a');expect(view.enabled).toBe(false);expect(view.current).toBe(0);
    expect(view.notice).toContain('card changed');expect(h.chats.get('a')).toHaveLength(2);
  });
  test('editing the source turn while the model replies prevents a stale handoff',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);
    const {signal}=await h.prepare();h.chats.get('a')![0].content='I remain outside.';
    const reply=h.add('a','assistant',`The door opens.\n${signal}`);await h.end(reply.id);
    expect((await h.runtime.view('a')).current).toBe(0);expect(h.chats.get('a')).toHaveLength(2);
  });
  test('later conversation prevents an automatic insertion',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);
    const {signal}=await h.prepare();const reply=await h.saveReply(signal);
    h.add('a','user','I walk away instead.');await h.end(reply.id);
    expect((await h.runtime.view('a')).current).toBe(0);expect(h.chats.get('a')).toHaveLength(3);
  });
  test('permissions and user identity fail closed',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);
    const {signal}=await h.prepare();
    expect(await h.runtime.processContent({...h.processorContext('a',signal),userId:'someone-else'})).toBeUndefined();
    h.grants.delete('chat_mutation');
    await h.runtime.handleEvent('PERMISSION_CHANGED',{permission:'chat_mutation',granted:false});
    await expect(h.runtime.force('a')).rejects.toThrow('permissions');
    const wrongUser=new SceneRuntime(h.api,'intruder');
    h.grants.add('chat_mutation');expect((await wrongUser.view('a')).scenes).toEqual([]);
  });
  test('forked copied variables do not carry automatic authorization to a new chat',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);await h.prepare();
    h.variables.set(`b:${STATE}`,h.variables.get(`a:${STATE}`)!);
    const view=await h.runtime.view('b');expect(view.enabled).toBe(false);expect(view.busy).toBe(false);
  });
  test('clearing the next scene preserves current context without authorizing a handoff',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);await h.runtime.selectNext('a',null);
    const result=await h.runtime.intercept([],'a',h.context('g1'));
    const messages=Array.isArray(result)?result:result.messages;
    expect(String(messages.at(-1)?.content)).toContain('Set Points current scene: Harbor');
    expect(String(messages.at(-1)?.content)).not.toContain('SET_POINTS:');
    expect((await h.runtime.view('a')).next).toBeNull();
    await expect(h.runtime.force('a')).rejects.toThrow('There is no next scene');
  });
  test('undo will not delete a user-edited inserted scene',async()=>{
    const h=harness();await h.runtime.force('a');
    h.chats.get('a')!.at(-1)!.content='My edited scene';
    expect((await h.runtime.view('a')).canUndo).toBe(false);
    await expect(h.runtime.undo('a')).rejects.toThrow('no Set Points insertion');
  });
  test('manually removing an inserted scene pauses automatic progression',async()=>{
    const h=harness();await h.runtime.setEnabled('a',true);await h.runtime.force('a');
    h.chats.set('a',[]);const view=await h.runtime.view('a');
    expect(view.enabled).toBe(false);expect(view.canUndo).toBe(false);expect(view.notice).toContain('changed or removed');
  });
  test('scene indices are validated',async()=>{
    const h=harness();
    for(const index of [-1,0.5,99,NaN]) await expect(h.runtime.selectNext('a',index)).rejects.toThrow('Choose a scene');
  });
});
