import type { SpindleAPI, GenerationResponseDTO, InterceptorDisposer } from 'lumiverse-spindle-types';
import { adaptStory, validateDraft } from './importer';
import { CardPublisher } from './publisher';
import { SceneRuntime } from './runtime';
import { extractPage, storyUrl } from './source';
import { VERSION, type AppSnapshot, type ImportJob, type ImportOptions, type SavedStory, type StoryDraft } from './types';

const STATE_PATH = 'workspace.json';
type Workspace = { draft: StoryDraft|null; saved: SavedStory|null; job: ImportJob|null };
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function string(value: unknown, name: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`); return value; }
function providerError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|cancel/i.test(message)) return new Error('The model request was cancelled or timed out. Your previous draft is still available.');
  if (/401|unauthori|api.?key/i.test(message)) return new Error('The model connection could not authenticate. Check that connection in Lumiverse.');
  if (/429|rate.limit|quota|credits|balance/i.test(message)) return new Error('The model provider reported a rate or credit limit. Check your connection and try again later.');
  if (/context|too.long|maximum.*token/i.test(message)) return new Error('The model could not fit this request. Choose a larger-context connection or a smaller section size.');
  if (/refus|content.filter|safety|moderation/i.test(message)) return new Error('The model provider declined this request. No replacement content was saved.');
  return new Error('The model request failed. Check the selected connection in Lumiverse. No source text was written to diagnostic logs.');
}

export class SetPointsController {
  readonly runtime: SceneRuntime;
  private publisher: CardPublisher;
  private workspace: Workspace = { draft: null, saved: null, job: null };
  private ready: Promise<void>;
  private abort?: AbortController;
  private jobTask?: Promise<void>;
  private entries: string[] = [];
  private persistence: Promise<void> = Promise.resolve();
  private starting = false;
  private saving = false;
  constructor(private api: SpindleAPI, private userId?: string, private changed: () => void = () => {}) {
    this.runtime = new SceneRuntime(api, userId);
    this.publisher = new CardPublisher(api, userId);
    this.ready = this.restore();
  }
  private async restore() {
    let saved: Workspace;
    try { saved = await this.api.userStorage.getJson<Workspace>(STATE_PATH, { fallback: this.workspace, userId: this.userId }); }
    catch {
      const backup = `recovery/workspace-${Date.now()}.txt`;
      try {
        const raw = await this.api.userStorage.read(STATE_PATH, this.userId);
        await this.api.userStorage.write(backup, raw, this.userId);
      } catch { throw new Error('Saved Set Points data could not be read or backed up. Check extension storage, then reload Set Points.'); }
      saved = { draft: null, saved: null, job: null };
      this.note('Unreadable workspace backed up for recovery.');
    }
    try {
      this.workspace = { draft: saved.draft ? validateDraft(saved.draft) : null, saved: saved.saved ?? null, job: saved.job ?? null };
    } catch {
      await this.api.userStorage.setJson(`recovery/workspace-${Date.now()}.json`, saved, { userId: this.userId });
      this.workspace = { draft: null, saved: null, job: { id: crypto.randomUUID(), status: 'failed', completed: 0, total: 1, label: 'Saved draft needs attention', error: 'The previous draft could not be opened. A recovery copy was retained; you can import a new story or load an exported draft.' } };
      this.note('Invalid saved draft backed up for recovery.');
    }
    if (this.workspace.job?.status === 'running') {
      this.workspace.job = { ...this.workspace.job, status: 'failed', label: 'Import interrupted', error: 'Lumiverse restarted during import. Your last completed draft is preserved. Start the import again.' };
      await this.persist();
    }
  }
  private persist(): Promise<void> {
    const value = structuredClone(this.workspace);
    const write = this.persistence.catch(() => {}).then(() => this.api.userStorage.setJson(STATE_PATH, value, { userId: this.userId }));
    this.persistence = write;
    return write;
  }
  private require(permission: string) { if (!this.api.permissions.has(permission)) throw new Error(`Grant ${permission} in Lumiverse’s Extensions panel to use this action.`); }
  private note(kind: string) { this.entries.push(`${new Date().toISOString()} ${kind}`); this.entries = this.entries.slice(-100); }
  async snapshot(chatId?: string|null): Promise<AppSnapshot> {
    await this.ready;
    const permissions = await this.api.permissions.getGranted();
    let connections: AppSnapshot['connections'] = [];
    if (permissions.includes('generation')) {
      try { connections = (await this.api.connections.list(this.userId)).map(({ id, name, provider, model }) => ({ id, name, provider, model })); }
      catch { this.note('Connection list unavailable.'); }
    }
    const play = chatId === null ? { chatId: null, characterId: null, title: '', enabled: false, current: 0, next: null, scenes: [], canUndo: false, busy: false, notice: 'Open a chat with a Set Points narrator to use scene controls.' } : await this.runtime.view(chatId);
    return { version: VERSION, permissions, connections, ...structuredClone(this.workspace), play, diagnostics: [...this.entries] };
  }
  private async start(options: ImportOptions): Promise<ImportJob> {
    await this.ready;
    this.require('generation');
    if (this.saving) throw new Error('Wait for the card to finish saving before importing another story.');
    if (this.starting || this.workspace.job?.status === 'running') throw new Error('An import is already running. Cancel it before starting another.');
    this.starting = true;
    try {
      if (typeof options.text !== 'string' || options.text.trim().length < 100 || options.text.length > 500_000) throw new Error('Paste between 100 and 500,000 characters of story text.');
      if (!Number.isInteger(options.sceneCount) || options.sceneCount < 2 || options.sceneCount > 32) throw new Error('Choose between 2 and 32 scenes.');
      if (!Number.isInteger(options.chunkSize) || options.chunkSize < 4000 || options.chunkSize > 20000) throw new Error('Section size must be between 4,000 and 20,000 characters.');
      string(options.sourceTitle, 'Story title'); string(options.playerRole, 'Player role'); string(options.startingPoint, 'Starting point');
      if (options.sourceTitle.length > 300 || options.playerRole.length > 2000 || options.startingPoint.length > 2000) throw new Error('Keep the title under 300 characters and role/starting point under 2,000 characters.');
      if (options.sourceUrl) options.sourceUrl = storyUrl(options.sourceUrl);
      const connectionId = string(options.connectionId, 'Adaptation model connection');
      if (!await this.api.connections.get(connectionId, this.userId)) throw new Error('The selected model connection is no longer available.');
      this.abort = new AbortController();
      const controller = this.abort;
      const job: ImportJob = { id: crypto.randomUUID(), status: 'running', completed: 0, total: 1, label: 'Preparing the story' };
      this.workspace.job = job;
      await this.persist();
      this.note('Import started.');
      this.changed();
      this.jobTask = (async () => {
        try {
          const draft = await adaptStory(options, async (messages, signal) => {
            this.require('generation');
            const deadline = AbortSignal.timeout(180_000);
            let result: unknown;
            try {
              result = await this.api.generate.raw({ type: 'raw', connection_id: connectionId, userId: this.userId, messages, parameters: { temperature: 0.3, max_tokens: 16000 }, signal: AbortSignal.any([signal ?? controller.signal, deadline]) });
            } catch (error) { throw providerError(error); }
            const value = record(result);
            if (value.refusal || /content_filter|safety|refusal/i.test(String(value.finish_reason))) throw new Error('The model provider declined this request. No replacement content was saved.');
            if (typeof value.content !== 'string') throw new Error('The model returned no readable content. Check your selected connection.');
            return value as unknown as GenerationResponseDTO;
          }, (completed, total, label) => {
            if (this.workspace.job?.id !== job.id) return;
            this.workspace.job = { ...job, completed, total, label };
            this.changed();
          }, controller.signal);
          controller.signal.throwIfAborted();
          this.workspace.draft = validateDraft(draft);
          this.workspace.saved = null;
          this.workspace.job = { ...this.workspace.job!, status: 'complete', label: 'Ready to review', completed: this.workspace.job!.total };
          await this.persist();
          this.note('Import completed. Draft ready to review.');
        } catch (error) {
          const cancelled = controller.signal.aborted;
          this.workspace.job = { ...this.workspace.job!, status: cancelled ? 'cancelled' : 'failed', label: cancelled ? 'Import cancelled' : 'Import needs attention', error: cancelled ? undefined : error instanceof Error ? error.message : 'Import failed. Your last completed draft is preserved.' };
          this.note(cancelled ? 'Import cancelled.' : 'Import failed; last completed draft preserved.');
          await this.persist().catch(() => this.note('Could not persist the import status.'));
        } finally { this.abort = undefined; this.changed(); }
      })();
      return structuredClone(job);
    } finally { this.starting = false; }
  }
  async handle(action: string, input: unknown): Promise<unknown> {
    await this.ready;
    const data = record(input);
    switch (action) {
      case 'snapshot': return this.snapshot(data.chatId === null ? null : typeof data.chatId === 'string' ? data.chatId : undefined);
      case 'fetch-url': {
        this.require('cors_proxy');
        const url = storyUrl(data.url);
        this.note('Page extraction requested.');
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const response = await Promise.race([this.api.cors(url, { method: 'GET', headers: { Accept: 'text/html,text/plain;q=0.9' } }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('The website took too long to respond. Paste the story text instead.')), 25000); })]);
          return extractPage(response, url);
        } catch (error) {
          if (error instanceof Error && /Paste|paste|page|story|Link|large|text|site/i.test(error.message) && error.message.length < 300) throw error;
          throw new Error('The website could not be read. Paste the story text instead.');
        } finally { if (timer) clearTimeout(timer); }
      }
      case 'start-import': return this.start(record(data.options) as unknown as ImportOptions);
      case 'cancel-import': this.abort?.abort(); return { cancelled: Boolean(this.abort) };
      case 'save-draft': {
        if (this.saving) throw new Error('Wait for the card to finish saving before replacing the draft.');
        if (this.workspace.job?.status === 'running') throw new Error('Wait for the import to finish or cancel it before replacing the draft.');
        const draft = validateDraft(data.draft);
        this.workspace.draft = draft; this.workspace.saved = null;
        await this.persist(); this.changed(); return draft;
      }
      case 'create-card': {
        if (this.saving) throw new Error('This card is already being saved. Wait for the save to finish.');
        if (this.workspace.job?.status === 'running') throw new Error('Wait for the import to finish before saving a card.');
        const draft = validateDraft(data.draft);
        this.saving = true;
        try {
          this.workspace.draft = draft; await this.persist();
          const saved = await this.publisher.publish(draft);
          this.workspace.saved = saved; await this.persist(); this.note('Narrator card and attached world book saved.'); this.changed(); return saved;
        } finally { this.saving = false; }
      }
      case 'play-enable': {
        if (typeof data.enabled !== 'boolean') throw new Error('Choose whether to follow the story.');
        const chatId = string(data.chatId, 'Active chat'); await this.runtime.setEnabled(chatId, data.enabled); this.changed(); return this.runtime.view(chatId);
      }
      case 'play-next': {
        if (data.index !== null && !Number.isInteger(data.index)) throw new Error('Choose a valid next scene.');
        const chatId = string(data.chatId, 'Active chat'); await this.runtime.selectNext(chatId, data.index === null ? null : Number(data.index)); this.changed(); return this.runtime.view(chatId);
      }
      case 'play-force': {
        const chatId = string(data.chatId, 'Active chat'); await this.runtime.force(chatId); this.note('Next scene requested.'); this.changed(); return this.runtime.view(chatId);
      }
      case 'play-undo': {
        const chatId = string(data.chatId, 'Active chat'); await this.runtime.undo(chatId); this.note('Latest scene insertion undone.'); this.changed(); return this.runtime.view(chatId);
      }
      case 'diagnostics': {
        const view = await this.runtime.view();
        return { version: VERSION, job: this.workspace.job && { id: this.workspace.job.id, status: this.workspace.job.status, completed: this.workspace.job.completed, total: this.workspace.job.total }, play: { chatId: view.chatId, current: view.current, next: view.next, enabled: view.enabled, sceneCount: view.scenes.length, busy: view.busy }, entries: [...this.entries] };
      }
      default: throw new Error('Unknown Set Points action. Reload the extension.');
    }
  }
  dispose() { this.abort?.abort(); }
  async waitForImport() { await this.jobTask; }
}

export function setupBackend(api: SpindleAPI): () => void {
  const controllers = new Map<string, SetPointsController>();
  const instance = (userId?: string) => {
    const key = userId ?? 'owner';
    let found = controllers.get(key);
    if (!found) { found = new SetPointsController(api, userId, () => api.sendToFrontend({ type: 'set-points:changed' }, userId)); controllers.set(key, found); }
    return found;
  };
  const stop: (() => void)[] = [];
  stop.push(api.onFrontendMessage((payload, userId, frontendSessionId) => {
    const request = record(payload);
    if (request.type !== 'set-points:request' || typeof request.id !== 'string' || request.id.length > 100 || typeof request.action !== 'string') return;
    void instance(userId).handle(request.action, request.input).then(result => {
      api.sendToFrontend({ type: 'set-points:response', id: request.id, result }, userId, { frontendSessionId });
    }).catch(error => {
      api.sendToFrontend({ type: 'set-points:response', id: request.id, error: error instanceof Error ? error.message : 'Set Points could not complete this action.' }, userId, { frontendSessionId });
    });
  }));
  let interceptor: InterceptorDisposer | undefined;
  let processorRegistered = false;
  let generationStops: (() => void)[] = [];
  const subscribe = (event: string) => api.on(event, (payload, userId) => {
    void instance(userId).runtime.handleEvent(event, payload).then(() => api.sendToFrontend({ type: 'set-points:changed' }, userId)).catch(() => {
      api.log.warn('[Set Points] Scene update failed. Refresh the Play tab to inspect the current state.');
      api.sendToFrontend({ type: 'set-points:changed' }, userId);
    });
  });
  const configure = () => {
    if (api.permissions.has('interceptor') && !interceptor) interceptor = api.registerInterceptor((messages, ctx) => instance(ctx.userId).runtime.intercept(messages, ctx.chatId, ctx), 45);
    else if (!api.permissions.has('interceptor') && interceptor) { interceptor(); interceptor = undefined; }
    if (api.permissions.has('chat_mutation') && !processorRegistered) {
      api.registerMessageContentProcessor(ctx => instance(ctx.userId).runtime.processContent(ctx), 45);
      processorRegistered = true;
    } else if (!api.permissions.has('chat_mutation')) processorRegistered = false;
    if (api.permissions.has('generation') && !generationStops.length) generationStops = ['GENERATION_STARTED', 'GENERATION_ENDED', 'GENERATION_STOPPED'].map(subscribe);
    else if (!api.permissions.has('generation') && generationStops.length) { generationStops.forEach(dispose => dispose()); generationStops = []; }
  };
  configure();
  stop.push(api.permissions.onChanged(detail => {
    for (const [key, controller] of controllers) {
      void controller.runtime.handleEvent('PERMISSION_CHANGED', detail).catch(() => {});
      api.sendToFrontend({ type: 'set-points:changed' }, key === 'owner' ? undefined : key);
    }
    configure();
  }));
  for (const event of ['MESSAGE_EDITED', 'MESSAGE_SWIPED', 'SWIPE_EDITED', 'CHAT_SWITCHED', 'CHAT_CHANGED', 'CHAT_FORKED', 'CHARACTER_EDITED', 'CHARACTER_DELETED']) {
    stop.push(subscribe(event));
  }
  return () => { stop.forEach(dispose => dispose()); generationStops.forEach(dispose => dispose()); interceptor?.(); for (const controller of controllers.values()) controller.dispose(); };
}

declare const spindle: SpindleAPI;
if (typeof spindle !== 'undefined') setupBackend(spindle);
