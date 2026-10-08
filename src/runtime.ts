import type { SpindleAPI, LlmMessageDTO, InterceptorContextDTO, InterceptorResultDTO, MessageContentProcessorCtxDTO, MessageContentProcessorResultDTO, ChatDTO } from 'lumiverse-spindle-types';
import { EXTENSION_ID, type StoryScene, type SceneView } from './types';

const STATE_KEY = `${EXTENSION_ID}_state_v1`;
const HANDOFF_KEY = `${EXTENSION_ID}_handoff`;
const SIGNAL_RE = /<!--SET_POINTS:[a-f0-9]{32}-->/g;
const REQUIRED = ['characters', 'chats', 'chat_mutation', 'generation', 'interceptor'];
const PENDING_MS = 15 * 60 * 1000;
type Messages = Awaited<ReturnType<SpindleAPI['chat']['getMessages']>>;
// Released hosts use dryRun and omit generationId; newer SDKs expose isDryRun and a bound ID.
type GenerationContext = Partial<Pick<InterceptorContextDTO, 'generationId' | 'generationType' | 'isDryRun' | 'excludeMessageId'>> & { dryRun?: boolean };
interface ActiveGeneration { generationId: string; targetMessageId?: string; generationType?: string }
interface Position { current: string; next: string | null }
interface Pending { nonce: string; generationId: string; scene: string; baseline: string | null; baselineDigest: string | null; expires: number }
interface Insertion { operation: string; messageId: string; scene: string; previous: Position; source?: string }
interface Intent { operation: string; scene: string; previous: Position; source?: string; baseline: string | null }
interface State extends Position {
  version: 1; chatId: string; fingerprint: string; enabled: boolean;
  pending: Pending | null; insertion: Insertion | null; intent: Intent | null;
  undoing: Insertion | null; notice: string;
}
interface Loaded { chat: ChatDTO; title: string; scenes: StoryScene[]; state: State }
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const clean = (v: string) => v.replace(SIGNAL_RE, '').trimEnd();
const nonce = () => crypto.randomUUID().replaceAll('-', '');
const digest = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), n => n.toString(16).padStart(2,'0')).join('');
const lastConversation = (messages: Messages) => messages.filter(m => m.role === 'user' || m.role === 'assistant').sort((a,b) => a.index_in_chat - b.index_in_chat).at(-1);
const ownInsertion = (m: Messages[number]) => object(m.metadata?.[EXTENSION_ID]);
const baseView = (notice: string): SceneView => ({chatId:null,characterId:null,title:'',enabled:false,current:0,next:null,scenes:[],canUndo:false,busy:false,notice});

/** Scene state is owned by a chat. Control tokens authorize exactly one saved normal reply. */
export class SceneRuntime {
  private queues = new Map<string, Promise<unknown>>();
  private active = new Map<string, ActiveGeneration>();
  private cancelled = new Set<string>();
  constructor(private api: SpindleAPI, private userId?: string) {}

  private serial<T>(chatId: string, task: () => Promise<T>): Promise<T> {
    const prior = this.queues.get(chatId) ?? Promise.resolve();
    const next = prior.catch(() => {}).then(task);
    this.queues.set(chatId, next);
    void next.finally(() => { if (this.queues.get(chatId) === next) this.queues.delete(chatId); }).catch(() => {});
    return next;
  }
  private permitted(): boolean { return REQUIRED.every(p => this.api.permissions.has(p)); }
  private assertPermissions() { if (!this.permitted()) throw new Error('Set Points needs its requested play permissions. Restore them before continuing.'); }
  private async save(s: State) { await this.api.variables.chat.set(s.chatId, STATE_KEY, JSON.stringify(s)); }
  private busy(s: State) { return this.active.has(s.chatId) || (!!s.pending && s.pending.expires > Date.now()); }
  private assertIdle(s: State) { if (this.busy(s)) throw new Error('Wait for the current reply to finish or stop it before changing scenes.'); }
  private async load(chatId: string): Promise<Loaded> {
    this.assertPermissions();
    // A scoped entity lookup precedes every message/variable call, which have no userId parameter.
    const chat = await this.api.chats.get(chatId, this.userId);
    if (!chat) throw new Error('This chat is unavailable.');
    const meta = chat.metadata;
    if (!chat.character_id || meta.group === true || meta.is_group === true || !!meta.group_id || (Array.isArray(meta.character_ids) && meta.character_ids.length > 1)) throw new Error('Set Points currently supports chats with one narrator character.');
    const character = await this.api.characters.get(chat.character_id, this.userId);
    const source = object(character?.extensions?.[EXTENSION_ID]);
    if (source.version !== 1 || !Array.isArray(source.scenes) || source.scenes.length === 0) throw new Error('Open a chat with a narrator card created by Set Points.');
    const scenes = source.scenes as StoryScene[];
    const ids = new Set<string>();
    for (const scene of scenes) {
      if (!scene || typeof scene.id !== 'string' || !scene.id || ids.has(scene.id) || typeof scene.title !== 'string' || typeof scene.greeting !== 'string' || !scene.greeting.trim() || typeof scene.direction !== 'string' || !Array.isArray(scene.assumptions) || !scene.assumptions.every(x => typeof x === 'string')) throw new Error('This card has invalid scene data. Review and save the adaptation again.');
      ids.add(scene.id);
    }
    // A stable digest keeps story prose out of the persisted diagnostic state.
    const encoded = new TextEncoder().encode(JSON.stringify([chat.character_id, source.draftId, scenes]));
    const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoded)), n => n.toString(16).padStart(2,'0')).join('');
    let state: State | undefined;
    try { state = JSON.parse(await this.api.variables.chat.get(chatId, STATE_KEY) || 'null') as State | undefined; } catch {}
    const initial = (): State => ({version:1,chatId,fingerprint,enabled:false,current:scenes[0].id,next:scenes[1]?.id ?? null,pending:null,insertion:null,intent:null,undoing:null,notice:''});
    if (!state || state.version !== 1 || state.chatId !== chatId || typeof state.enabled !== 'boolean' || typeof state.current !== 'string') {
      state = initial();
      await this.save(state);
    } else if (state.fingerprint !== fingerprint || !ids.has(state.current) || (state.next !== null && !ids.has(state.next))) {
      const current = ids.has(state.current) ? state.current : scenes[0].id;
      state = {...initial(), current, next:scenes[scenes.findIndex(s => s.id === current) + 1]?.id ?? null,notice:'This card changed. Progression is paused; check the next scene before enabling it.'};
      await this.save(state);
    }
    if (state.pending && ((state.pending.expires <= Date.now() && !this.active.has(chatId)) || this.cancelled.has(state.pending.generationId))) {
      state.pending = null;
      state.enabled = false;
      state.notice = 'An unfinished reply expired. Check the conversation before enabling progression again.';
      await this.save(state);
    }
    return {chat,title:typeof source.title === 'string' ? source.title : character?.name ?? 'Set Points',scenes,state};
  }
  private async recover(data: Loaded, messages?: Messages): Promise<Messages> {
    const s = data.state;
    const all = messages ?? await this.api.chat.getMessages(s.chatId);
    if (s.undoing) {
      const original = all.find(m => m.id === s.undoing!.messageId);
      if (!original) {
        s.current = s.undoing.previous.current; s.next = s.undoing.previous.next;
        s.insertion = null; s.pending = null; s.undoing = null;
        s.notice = 'The last scene insertion was undone.';
        await this.save(s);
      }
    }
    if (s.intent) {
      const intent = s.intent;
      const saved = all.find(m => ownInsertion(m).operation === intent.operation && ownInsertion(m).chatId === s.chatId);
      if (saved) {
        this.finishInsertion(data, intent, saved.id);
        await this.save(s);
      } else {
        // Appending is not transactional with variables. An uncertain write is never replayed automatically.
        s.intent = null; s.pending = null; s.enabled = false;
        s.notice = 'A scene insertion was interrupted. Check the conversation, then use Force next scene if it is missing.';
        await this.save(s);
      }
    }
    if (s.insertion && !s.undoing) {
      const inserted = all.find(m => m.id === s.insertion!.messageId);
      const expected = data.scenes.find(x => x.id === s.insertion!.scene);
      if (!inserted || ownInsertion(inserted).operation !== s.insertion.operation || ownInsertion(inserted).chatId !== s.chatId || inserted.content !== clean(expected?.greeting ?? '') || inserted.swipe_id !== 0 || inserted.swipes.length > 1) {
        s.insertion = null; s.pending = null; s.enabled = false;
        s.notice = 'The last inserted scene was changed or removed. Progression is paused; check the next scene before enabling it.';
        await this.save(s);
      }
    }
    return all;
  }
  private finishInsertion(data: Loaded, intent: Intent, messageId: string) {
    const s = data.state;
    s.current = intent.scene;
    s.next = data.scenes[data.scenes.findIndex(x => x.id === intent.scene) + 1]?.id ?? null;
    s.insertion = {operation:intent.operation,messageId,scene:intent.scene,previous:intent.previous,source:intent.source};
    s.pending = null; s.intent = null; s.undoing = null; s.notice = '';
  }
  async view(chatId?: string): Promise<SceneView> {
    if (!this.permitted()) return baseView('Grant Set Points its requested permissions to use scene controls.');
    if (!chatId) chatId = (await this.api.chats.getActive(this.userId))?.id;
    if (!chatId) return baseView('Open a chat with a Set Points narrator to use scene controls.');
    return this.serial(chatId, async () => {
      try {
        const data = await this.load(chatId!);
        const messages = await this.recover(data);
        const s = data.state;
        const tail = lastConversation(messages);
        const inserted = s.insertion && messages.find(m => m.id === s.insertion!.messageId);
        const canUndo = !!inserted && tail?.id === inserted.id && ownInsertion(inserted).operation === s.insertion!.operation && inserted.content === clean(data.scenes.find(x => x.id === s.insertion!.scene)?.greeting ?? '') && !this.busy(s);
        return {chatId:s.chatId,characterId:data.chat.character_id,title:data.title,enabled:s.enabled,current:data.scenes.findIndex(x=>x.id===s.current),next:s.next ? data.scenes.findIndex(x=>x.id===s.next) : null,scenes:data.scenes,canUndo,busy:this.busy(s),notice:s.notice || 'Use one scene controller per chat. Disable Waypoints here before enabling Set Points. Automatic transitions apply to normal replies.'};
      } catch (error) { return {...baseView(error instanceof Error ? error.message : 'Scene controls are unavailable.'),chatId:chatId!}; }
    });
  }
  async setEnabled(chatId: string, enabled: boolean): Promise<void> {
    return this.serial(chatId, async () => {
      const data = await this.load(chatId); await this.recover(data); this.assertIdle(data.state);
      data.state.enabled = enabled; data.state.pending = null; data.state.notice = '';
      await this.save(data.state);
    });
  }
  async selectNext(chatId: string, index: number | null): Promise<void> {
    return this.serial(chatId, async () => {
      const data = await this.load(chatId); await this.recover(data); this.assertIdle(data.state);
      if (index !== null && (!Number.isInteger(index) || index < 0 || index >= data.scenes.length)) throw new Error('Choose a scene from this story.');
      data.state.next = index === null ? null : data.scenes[index].id; data.state.pending = null; data.state.notice = '';
      await this.save(data.state);
    });
  }
  private async insert(data: Loaded, source?: string): Promise<void> {
    const s = data.state;
    const scene = data.scenes.find(x => x.id === s.next);
    if (!scene) throw new Error('There is no next scene. Choose a scene first.');
    this.assertPermissions();
    const messages = await this.api.chat.getMessages(s.chatId);
    const baseline = lastConversation(messages)?.id ?? null;
    if (source && baseline !== source) throw new Error('The conversation changed before the handoff. Choose the next scene manually.');
    const intent: Intent = {operation:nonce(),scene:scene.id,previous:{current:s.current,next:s.next},source,baseline};
    s.intent = intent;
    // Record intent before the write so a restart can find a committed append by metadata.
    await this.save(s);
    const beforeWrite = await this.api.chat.getMessages(s.chatId);
    if ((lastConversation(beforeWrite)?.id ?? null) !== baseline || this.active.has(s.chatId)) {
      s.intent = null; s.pending = null;
      await this.save(s);
      throw new Error('The conversation is changing. Wait for the reply to finish before moving scenes.');
    }
    this.assertPermissions();
    const added = await this.api.chat.appendMessage(s.chatId, {role:'assistant',content:clean(scene.greeting),metadata:{[EXTENSION_ID]:{version:1,chatId:s.chatId,operation:intent.operation,scene:scene.id,source:source ?? null}}}, {triggerGeneration:false});
    this.finishInsertion(data, intent, added.id);
    await this.save(s);
  }
  async force(chatId: string): Promise<void> {
    return this.serial(chatId, async () => {
      const data = await this.load(chatId); await this.recover(data); this.assertIdle(data.state);
      await this.insert(data);
    });
  }
  async undo(chatId: string): Promise<void> {
    return this.serial(chatId, async () => {
      const data = await this.load(chatId);
      const messages = await this.recover(data); const s = data.state; this.assertIdle(s);
      if (!s.insertion) throw new Error('There is no Set Points insertion to undo.');
      const added = messages.find(m => m.id === s.insertion!.messageId);
      if (!added || ownInsertion(added).operation !== s.insertion.operation || ownInsertion(added).chatId !== chatId || added.content !== clean(data.scenes.find(x => x.id === s.insertion!.scene)?.greeting ?? '')) throw new Error('The last inserted scene was changed or removed; it cannot be undone safely.');
      if (lastConversation(messages)?.id !== added.id) throw new Error('Undo is available only before another user or assistant message follows the inserted scene.');
      s.undoing = s.insertion; await this.save(s);
      const latest = await this.api.chat.getMessages(chatId);
      const latestAdded = latest.find(m => m.id === added.id);
      if (lastConversation(latest)?.id !== added.id || this.active.has(chatId) || !latestAdded || latestAdded.content !== added.content || latestAdded.swipe_id !== added.swipe_id || JSON.stringify(latestAdded.swipes) !== JSON.stringify(added.swipes) || ownInsertion(latestAdded).operation !== s.insertion.operation || ownInsertion(latestAdded).chatId !== chatId) { s.undoing = null; await this.save(s); throw new Error('The conversation changed. Undo is no longer available.'); }
      this.assertPermissions();
      await this.api.chat.deleteMessage(chatId, added.id);
      s.current = s.insertion.previous.current; s.next = s.insertion.previous.next;
      // Never restore pending authorization: an undone handoff must not replay.
      s.pending = null; s.insertion = null; s.undoing = null; s.notice = 'The last scene insertion was undone.';
      await this.save(s);
    });
  }
  async intercept(messages: LlmMessageDTO[], chatId: string, context?: GenerationContext): Promise<LlmMessageDTO[] | InterceptorResultDTO> {
    if (!context || context.isDryRun || context.dryRun || context.generationType !== 'normal' || !this.permitted()) return messages;
    const lifecycle = this.active.get(chatId);
    const boundGenerationId = typeof context.generationId === 'string' && context.generationId ? context.generationId : undefined;
    const generationId = boundGenerationId ?? lifecycle?.generationId;
    // Never invent a generation identity when a released host omits it from context.
    if (!generationId || (lifecycle && lifecycle.generationId !== generationId) || (lifecycle?.generationType && lifecycle.generationType !== 'normal')) return messages;
    return this.serial(chatId, async () => {
      if (!boundGenerationId && this.active.get(chatId)?.generationId !== generationId) return messages;
      let data: Loaded;
      try { data = await this.load(chatId); } catch { return messages; }
      await this.recover(data);
      const s = data.state;
      if (!s.enabled || this.cancelled.has(generationId)) return messages;
      const current = data.scenes.find(x => x.id === s.current)!;
      const presentContext = `Set Points current scene: ${current.title}. Current scene reference: ${current.direction}\nThe existing conversation determines what actually happened and what each character has learned. Keep established character developments and revealed information consistent. Do not replay this scene's opening or assume the player performed its planned actions. The player alone chooses their character's dialogue, actions, thoughts, consent, and commitments.`;
      if (!s.next) return [...messages, {role:'system',content:presentContext}];
      if (s.pending && s.pending.generationId !== generationId && s.pending.expires > Date.now()) return messages;
      const scene = data.scenes.find(x => x.id === s.next)!;
      const all = await this.api.chat.getMessages(chatId);
      const token = nonce();
      let excluded = context.excludeMessageId ?? lifecycle?.targetMessageId;
      if (!excluded) {
        // Some hosts stage a blank assistant row after STARTED. It is omitted from
        // assembled history, so use source IDs to distinguish it from existing turns.
        const sourceIds = new Set(messages.map(m => m.sourceMessageId).filter((id): id is string => typeof id === 'string'));
        const tail = lastConversation(all);
        if (tail?.role === 'assistant' && !tail.content.trim() && sourceIds.size && !sourceIds.has(tail.id)) excluded = tail.id;
      }
      const baseline = lastConversation(all.filter(m => m.id !== excluded));
      if (!boundGenerationId && this.active.get(chatId)?.generationId !== generationId) return messages;
      s.pending = {nonce:token,generationId,scene:scene.id,baseline:baseline?.id ?? null,baselineDigest:baseline ? await digest(JSON.stringify([baseline.id,baseline.role,baseline.content,baseline.swipe_id])) : null,expires:Date.now()+PENDING_MS};
      await this.save(s);
      if (this.cancelled.has(generationId) || !this.permitted()) { s.pending = null; await this.save(s); return messages; }
      this.active.set(chatId, {...lifecycle,generationId});
      const signal = `<!--SET_POINTS:${token}-->`;
      const guidance = `${presentContext}\n\nSet Points private scene direction. The player alone chooses their character's dialogue, actions, thoughts, consent, and commitments. Do not invent a prior player decision to satisfy this plan.\n\nUpcoming scene: ${scene.title}\nDirection: ${scene.direction}\nAssumptions that must already fit the conversation: ${scene.assumptions.join('; ') || 'None specified.'}\nScene opening (held for a separate insertion):\n${clean(scene.greeting)}\n\nGuide the environment and non-player characters toward this situation only when it follows naturally from play. Do not quote, enact, or reveal this opening in your reply. Do not force the player to follow the plot. If assumptions conflict with the conversation, continue playing and do not signal. When the opening can follow immediately, end your reply just before it begins, then append exactly ${signal} on its own line. Otherwise omit the signal. Never explain or discuss this private direction. Only this exact signal can request the handoff for this reply.`;
      return [...messages, {role:'system',content:guidance}];
    });
  }
  async processContent(ctx: MessageContentProcessorCtxDTO): Promise<MessageContentProcessorResultDTO | void> {
    if (this.userId && ctx.userId !== this.userId) return;
    if (ctx.isUser || !ctx.content.match(SIGNAL_RE)) return;
    const patch: MessageContentProcessorResultDTO = {content:clean(ctx.content)};
    // Render, edits, swipes, stopped replies, and historical content can only have tokens removed.
    if (ctx.origin !== 'create' || !this.permitted()) return patch;
    return this.serial(ctx.chatId, async () => {
      let data: Loaded;
      try { data = await this.load(ctx.chatId); } catch { return patch; }
      const pending = data.state.pending;
      if (!data.state.enabled || !pending || pending.expires <= Date.now() || pending.scene !== data.state.next || this.cancelled.has(pending.generationId) || this.active.get(ctx.chatId)?.generationId !== pending.generationId || !ctx.content.includes(`<!--SET_POINTS:${pending.nonce}-->`)) return patch;
      if (!ctx.content.trimEnd().endsWith(`<!--SET_POINTS:${pending.nonce}-->`)) return patch;
      return {...patch,extra:{[HANDOFF_KEY]:{version:1,nonce:pending.nonce,generationId:pending.generationId,scene:pending.scene,fingerprint:data.state.fingerprint,contentDigest:await digest(patch.content!)}}};
    });
  }
  async handleEvent(name: string, payload: unknown): Promise<void> {
    const event = object(payload);
    if (name === 'PERMISSION_CHANGED') {
      if (event.granted === false && REQUIRED.includes(String(event.permission))) {
        for (const active of this.active.values()) this.cancelled.add(active.generationId);
        this.active.clear();
      }
      return;
    }
    const chatId = event.chatId;
    const generationId = event.generationId;
    if (typeof chatId !== 'string' || typeof generationId !== 'string') return;
    if (name === 'GENERATION_STARTED') { this.active.set(chatId,{generationId,...(typeof event.targetMessageId === 'string' ? {targetMessageId:event.targetMessageId} : {}),...(typeof event.generationType === 'string' ? {generationType:event.generationType} : {})}); return; }
    if (name !== 'GENERATION_ENDED' && name !== 'GENERATION_STOPPED') return;
    if (name === 'GENERATION_STOPPED') this.cancelled.add(generationId);
    // Clear synchronously so queued Force/Undo sees lifecycle changes before its final write check.
    if (this.active.get(chatId)?.generationId === generationId) this.active.delete(chatId);
    if (!this.permitted()) return;
    return this.serial(chatId, async () => {
      let data: Loaded;
      try { data = await this.load(chatId); } catch { return; }
      const messages = await this.recover(data);
      const s = data.state; const pending = s.pending;
      if (!pending || pending.generationId !== generationId) return;
      const abort = async (notice = '') => { s.pending=null; s.notice=notice; await this.save(s); };
      if (name === 'GENERATION_STOPPED' || this.cancelled.has(generationId) || event.error || (event.generationType && event.generationType !== 'normal') || !s.enabled) return abort();
      if (typeof event.messageId !== 'string' || pending.expires <= Date.now()) return abort();
      const reply = messages.find(m => m.id === event.messageId);
      if (!reply || reply.role !== 'assistant' || reply.id === pending.baseline) return abort();
      if (lastConversation(messages)?.id !== reply.id) return abort('The conversation moved on before the handoff. Use Force next scene when ready.');
      const baseline = pending.baseline && messages.find(m => m.id === pending.baseline);
      const preceding = lastConversation(messages.filter(m => m.index_in_chat < reply.index_in_chat));
      if ((preceding?.id ?? null) !== pending.baseline || (pending.baseline && (!baseline || baseline.index_in_chat >= reply.index_in_chat || await digest(JSON.stringify([baseline.id,baseline.role,baseline.content,baseline.swipe_id])) !== pending.baselineDigest))) return abort('The conversation changed before the handoff. Choose the next scene manually.');
      const stripped = clean(reply.content);
      const contentDigest = await digest(stripped);
      const proof = object(reply.extra?.[HANDOFF_KEY] ?? reply.metadata?.[HANDOFF_KEY]);
      const proven = proof.version === 1 && proof.nonce === pending.nonce && proof.generationId === generationId && proof.scene === s.next && proof.fingerprint === s.fingerprint && proof.contentDigest === contentDigest;
      const exactToken = `<!--SET_POINTS:${pending.nonce}-->`;
      // Lumiverse's normal generation writes bypass REST content processors. Bind the
      // token to the ENDED event's saved message, then strip and persist proof before append.
      if (!proven) {
        if (!reply.content.trimEnd().endsWith(exactToken)) return abort();
        const latest = await this.api.chat.getMessages(chatId);
        const currentReply = latest.find(m => m.id === reply.id);
        if (!currentReply || lastConversation(latest)?.id !== reply.id || currentReply.content !== reply.content || currentReply.swipe_id !== reply.swipe_id || this.active.has(chatId)) return abort('The reply changed before the handoff. Choose the next scene manually.');
        this.assertPermissions();
        await this.api.chat.updateMessage(chatId, reply.id, {content:stripped,metadata:{...reply.metadata,[HANDOFF_KEY]:{version:1,nonce:pending.nonce,generationId,scene:pending.scene,fingerprint:s.fingerprint,contentDigest}}});
        const verified = await this.api.chat.getMessages(chatId);
        const committed = verified.find(m => m.id === reply.id);
        if (!committed || committed.content !== stripped || committed.swipe_id !== reply.swipe_id || lastConversation(verified)?.id !== reply.id) return abort('The reply changed before the handoff. Choose the next scene manually.');
      }
      // Event content and historical markers never authorize an append.
      await this.insert(data, reply.id);
    });
  }
}
