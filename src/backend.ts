import type { SpindleAPI, GenerationRequestDTO, GenerationResponseDTO, InterceptorDisposer } from 'lumiverse-spindle-types';
import { adaptStory, ImportError, validateDraft, type Generate, type GenerationMessage } from './importer';
import { ResponseCheckpoints, CheckpointError } from './checkpoints';
import { CardPublisher } from './publisher';
import { SceneRuntime } from './runtime';
import { extractPage, storyUrl } from './source';
import { VERSION, type AppSnapshot, type ImportJob, type ImportOptions, type SavedStory, type StoryDraft } from './types';

const STATE_PATH = 'workspace.json';
type Workspace = { draft: StoryDraft|null; saved: SavedStory|null; job: ImportJob|null; lastImport?: ImportOptions; lastConnectionFingerprint?: unknown };
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function string(value: unknown, name: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`); return value; }
function sameSettings(a: unknown, b: unknown): boolean {
  const ordered = (_key: string, value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value;
  return JSON.stringify(a, ordered) === JSON.stringify(b, ordered);
}
// Lumiverse 1.2's raw worker API requires these fields even with connection_id.
// spindle-types 0.6.40 omits them from GenerationRequestDTO.
type RawModelRequest = GenerationRequestDTO & { provider: string; model: string };
type ModelFailureCode = 'TIMEOUT' | 'CANCELLED' | 'AUTHENTICATION' | 'REQUEST_DENIED' | 'RATE_LIMIT' | 'CONTEXT_LIMIT' | 'DECLINED' | 'MODEL_UNAVAILABLE' | 'INVALID_REQUEST' | 'PROVIDER_UNAVAILABLE' | 'CONNECTION_FAILED' | 'REQUEST_FAILED' | 'EMPTY_RESPONSE' | 'REASONING_ONLY' | 'OUTPUT_LIMIT' | 'RESPONSE_FAILED';
const FILTER_STOPS = new Set(['refusal', 'content_filter', 'safety', 'blocklist', 'prohibited_content', 'spii', 'image_safety', 'image_prohibited_content', 'escalation', 'recitation', 'image_recitation']);
const LIMIT_STOPS = new Set(['length', 'max_tokens', 'max_output_tokens']);
const FAILED_STOPS = new Set(['error', 'failed', 'incomplete', 'cancelled', 'other', 'image_other', 'no_image', 'malformed_response', 'finish_reason_unspecified', 'language', 'malformed_function_call', 'unexpected_tool_call', 'too_many_tool_calls', 'missing_thought_signature']);
const KNOWN_STOPS = new Set([...FILTER_STOPS, ...LIMIT_STOPS, ...FAILED_STOPS, 'stop', 'completed', 'end_turn', 'stop_sequence', 'tool_calls', 'function_call']);
function stopCode(value: unknown): string { return typeof value === 'string' && KNOWN_STOPS.has(value.toLowerCase()) ? value.toLowerCase() : value == null ? 'unspecified' : 'unrecognized'; }
class ModelRequestError extends Error {
  constructor(readonly code: ModelFailureCode, message: string, readonly status?: number) {
    super(`${message} (${code}${status ? `; HTTP ${status}` : ''})`);
  }
}
function providerError(error: unknown): ModelRequestError {
  const value = record(error);
  const message = typeof value.message === 'string' ? value.message : typeof error === 'string' ? error : '';
  // Providers can echo the prompt, URL, or credentials. Only fixed categories and
  // a validated HTTP status may leave this function; never retain the raw error.
  const candidate = value.status ?? value.statusCode ?? record(value.response).status
    ?? message.match(/\b(?:HTTP(?:\s+error)?|API\s+error|status(?:\s+code)?)\s*[:=]?\s*([45]\d{2})\b/i)?.[1]
    ?? message.match(/\bfailed\s*\(([45]\d{2})\):/i)?.[1];
  const status = /^[45]\d{2}$/.test(String(candidate)) ? Number(candidate) : undefined;
  const failure = (code: ModelFailureCode, text: string) => new ModelRequestError(code, text, status);
  if (/timeout|timed?\s*out/i.test(message) || value.name === 'TimeoutError') return failure('TIMEOUT', 'The model request took too long. Retry with a smaller section size or a faster connection.');
  if (/abort|cancel/i.test(message) || value.name === 'AbortError') return failure('CANCELLED', 'The model request was cancelled. Your previous draft is still available.');
  if (/fetch failed|network|ECONN|ENOTFOUND|connection refused/i.test(message)) return failure('CONNECTION_FAILED', 'Lumiverse could not reach the model provider. Check the connection and try again.');
  if (/\brefus(?:al|ed)\b|content[ _-]?(?:filter|policy)|\bsafety\b|\bmoderation\b|(?:input|prompt|request).{0,60}\bflagged\b|PROHIBITED_CONTENT/i.test(message)) return failure('DECLINED', 'The provider reported a content restriction or refusal. No replacement content was saved.');
  if (status === 403) return failure('REQUEST_DENIED', 'The provider denied this request. This can mean an access restriction or content filtering; it does not by itself mean your credentials are invalid.');
  if (status === 401 || /unauthori|authentication|(?:invalid|incorrect|missing|expired|revoked|disabled).{0,30}(?:api.?key|credentials|token)/i.test(message)) return failure('AUTHENTICATION', 'The model connection could not authenticate. Check that connection in Lumiverse.');
  if (status === 429 || status === 402 || /\b429\b|rate.limit|quota|credits|balance/i.test(message)) return failure('RATE_LIMIT', 'The model provider reported a rate or credit limit. Check your connection and try again later.');
  if (/context|too.long|maximum.*token/i.test(message)) return failure('CONTEXT_LIMIT', 'The model could not fit this request. Choose a larger-context connection or a smaller section size.');
  if (/model.{0,80}(?:not found|not available|does not exist|invalid|unknown|required|missing|empty|unsupported)|(?:unknown|invalid|missing|unsupported)\s+model/i.test(message)) return failure('MODEL_UNAVAILABLE', 'The provider could not use the selected model. Re-select the model in your Lumiverse connection and retry.');
  if (status === 400 || status === 422 || /unsupported.{0,60}(?:parameter|temperature|max_tokens)|invalid.{0,30}(?:parameter|request)/i.test(message)) return failure('INVALID_REQUEST', 'The model rejected the request settings. Share the error code and your provider/model to help troubleshoot.');
  if (status && status >= 500) return failure('PROVIDER_UNAVAILABLE', 'The model provider reported a server error. Try again later.');
  return failure('REQUEST_FAILED', 'The model request failed. Share the error code and your provider/model to help troubleshoot. No source text was written to diagnostic logs.');
}

export class SetPointsController {
  readonly runtime: SceneRuntime;
  private publisher: CardPublisher;
  private checkpoints: ResponseCheckpoints;
  private workspace: Workspace = { draft: null, saved: null, job: null };
  private ready: Promise<void>;
  private abort?: AbortController;
  private jobTask?: Promise<void>;
  private entries: string[] = [];
  private persistence: Promise<void> = Promise.resolve();
  private starting = false;
  private saving = false;
  private checking = false;
  private checkAbort?: AbortController;
  constructor(private api: SpindleAPI, private userId?: string, private changed: () => void = () => {}) {
    this.runtime = new SceneRuntime(api, userId);
    this.publisher = new CardPublisher(api, userId);
    this.checkpoints = new ResponseCheckpoints(api, userId);
    this.ready = this.restore();
  }
  private async restore() {
    let saved: Workspace;
    try {
      const temp = `${STATE_PATH}.tmp`;
      if (await this.api.userStorage.exists(temp, this.userId)) {
        const pending = await this.api.userStorage.read(temp, this.userId);
        const parsed = JSON.parse(pending);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !('draft' in parsed) || !('job' in parsed)) throw new Error('Invalid workspace');
        await this.api.userStorage.move(temp, STATE_PATH, this.userId);
        if (await this.api.userStorage.read(STATE_PATH, this.userId) !== pending) throw new Error('Workspace recovery failed');
      }
      saved = await this.api.userStorage.exists(STATE_PATH, this.userId) ? JSON.parse(await this.api.userStorage.read(STATE_PATH, this.userId)) : this.workspace;
      if (!saved || typeof saved !== 'object' || Array.isArray(saved) || !('draft' in saved) || !('job' in saved)) throw new Error('Invalid workspace');
    }
    catch {
      throw new Error('Saved Set Points data could not be read safely. No model request was sent. Keep extension storage intact so the source and paid responses can be recovered.');
    }
    try {
      this.workspace = { draft: saved.draft ? validateDraft(saved.draft) : null, saved: saved.saved ?? null, job: saved.job ?? null, ...(saved.lastImport ? { lastImport: saved.lastImport, lastConnectionFingerprint: saved.lastConnectionFingerprint } : {}) };
    } catch {
      await this.api.userStorage.setJson(`recovery/workspace-${Date.now()}.json`, saved, { userId: this.userId });
      this.workspace = { draft: null, saved: null, ...(saved.lastImport ? { lastImport: saved.lastImport, lastConnectionFingerprint: saved.lastConnectionFingerprint } : {}), job: { id: crypto.randomUUID(), status: 'failed', completed: 0, total: 1, label: 'Saved draft needs attention', error: 'The previous draft could not be opened. A recovery copy was retained; you can import a new story or load an exported draft.' } };
      this.note('Invalid saved draft backed up for recovery.');
    }
    if (this.workspace.job?.status === 'running') {
      this.workspace.job = { ...this.workspace.job, status: 'failed', label: 'Import interrupted', error: this.workspace.lastImport ? 'Lumiverse restarted during import. Resume saved import to reuse completed steps. Any request with an unknown outcome will need an explicit retry.' : 'Lumiverse restarted during import. Your last completed draft is preserved. Start the import again.' };
      await this.persist();
    }
  }
  private persist(): Promise<void> {
    const value = JSON.stringify(this.workspace);
    const write = this.persistence.catch(() => {}).then(async () => {
      const temp = `${STATE_PATH}.tmp`;
      await this.api.userStorage.write(temp, value, this.userId);
      if (await this.api.userStorage.read(temp, this.userId) !== value) throw new Error('Saved import verification failed. Keep extension storage intact.');
      await this.api.userStorage.move(temp, STATE_PATH, this.userId);
      if (await this.api.userStorage.read(STATE_PATH, this.userId) !== value) throw new Error('Saved import verification failed. Keep extension storage intact.');
    });
    this.persistence = write;
    return write;
  }
  private require(permission: string) { if (!this.api.permissions.has(permission)) throw new Error(`Grant ${permission} in Lumiverse’s Extensions panel to use this action.`); }
  private note(kind: string) { this.entries.push(`${new Date().toISOString()} ${kind}`); this.entries = this.entries.slice(-100); }
  private async selectedConnection(value: unknown) {
    const id = string(value, 'Adaptation model connection');
    const connection = await this.api.connections.get(id, this.userId);
    if (!connection) throw new Error('The selected model connection is no longer available.');
    if (!connection.model?.trim()) throw new Error('The selected connection has no model. Choose a model for that connection in Lumiverse, then retry.');
    if (!connection.provider?.trim()) throw new Error('The selected connection has no provider. Edit that connection in Lumiverse, then retry.');
    return { id, model: connection.model, provider: connection.provider, fingerprint: { id, model: connection.model, provider: connection.provider, api_url: connection.api_url, preset_id: connection.preset_id, metadata: connection.metadata, reasoning_bindings: connection.reasoning_bindings, parameters: { temperature: 0.3, max_tokens: 16000 } } };
  }
  private async requestModel(connection: { id: string; model: string; provider: string }, messages: GenerationMessage[], signal: AbortSignal, maxTokens = 16000, timeoutMs = 180_000): Promise<unknown> {
    this.require('generation');
    const deadline = AbortSignal.timeout(timeoutMs);
    const requestSignal = AbortSignal.any([signal, deadline]);
    let onAbort: (() => void) | undefined;
    try {
      requestSignal.throwIfAborted();
      const request: RawModelRequest = { type: 'raw', connection_id: connection.id, provider: connection.provider, model: connection.model, userId: this.userId, messages, parameters: { temperature: 0.3, max_tokens: maxTokens }, signal: requestSignal };
      // Settle locally as well as asking the host to cancel. A lost host reply
      // must not leave the connection check or import running indefinitely.
      return await Promise.race([this.api.generate.raw(request), new Promise<never>((_, reject) => {
        onAbort = () => reject(requestSignal.reason);
        requestSignal.addEventListener('abort', onAbort, { once: true });
        if (requestSignal.aborted) onAbort();
      })]);
    } catch (error) {
      const failure = providerError(deadline.aborted && !signal.aborted ? new DOMException('The model request timed out.', 'TimeoutError') : error);
      this.note(`Model request failed: ${failure.code}${failure.status ? `; HTTP ${failure.status}` : ''}.`);
      throw failure;
    } finally { if (onAbort) requestSignal.removeEventListener('abort', onAbort); }
  }
  private readModelResponse(result: unknown, connectionCheck = false): GenerationResponseDTO {
    const value = record(result), details = record(value.stop_details);
    const finish = stopCode(value.finish_reason), native = stopCode(details.category);
    const textLength = typeof value.content === 'string' ? value.content.length : 0;
    const reasoningLength = typeof value.reasoning === 'string' ? value.reasoning.length : 0;
    const tokens = record(value.usage).completion_tokens;
    const outputTokens = typeof tokens === 'number' && Number.isSafeInteger(tokens) && tokens >= 0 ? tokens : 'unknown';
    const reasoningTokens = record(record(record(value.usage).provider_raw).completion_tokens_details).reasoning_tokens;
    const safeReasoningTokens = typeof reasoningTokens === 'number' && Number.isSafeInteger(reasoningTokens) && reasoningTokens >= 0 ? reasoningTokens : 'unknown';
    const reasoningPresent = reasoningLength > 0 || Array.isArray(value.reasoning_details) && value.reasoning_details.length > 0 || typeof safeReasoningTokens === 'number' && safeReasoningTokens > 0;
    // Whitelisted stop codes and numeric sizes only. Explanations, reasoning,
    // opaque provider details and response text can all contain source material.
    this.note(`Model response: finish=${finish}; native=${native}; textCharacters=${textLength}; reasoningCharacters=${reasoningLength}; reasoningPresent=${reasoningPresent}; outputTokens=${outputTokens}; reasoningTokens=${safeReasoningTokens}.`);
    const fail = (code: ModelFailureCode, message: string): never => {
      this.note(`Model response rejected: ${code}.`);
      throw new ModelRequestError(code, message);
    };
    if (value.refusal || details.type === 'refusal' || details.type === 'blocked_prompt' || FILTER_STOPS.has(finish) || FILTER_STOPS.has(native)) fail('DECLINED', 'The provider reported a content restriction or refusal. No replacement content was saved.');
    if (LIMIT_STOPS.has(finish) || LIMIT_STOPS.has(native)) fail('OUTPUT_LIMIT', connectionCheck ? 'The provider responded, but the small test reached its output allowance before returning a complete answer. Reasoning can consume this allowance.' : 'The model reached the output allowance before finishing. Reasoning can consume that allowance. Review the connection’s reasoning settings or request fewer scenes.');
    if (value.error || ['failed', 'incomplete'].includes(String(details.type)) || FAILED_STOPS.has(finish) || FAILED_STOPS.has(native)) fail('RESPONSE_FAILED', 'The provider returned an unsuccessful response. Download diagnostics for its stop category; no response text is included.');
    if (typeof value.content !== 'string') fail('RESPONSE_FAILED', 'The model returned an unexpected response format. Download diagnostics to help troubleshoot.');
    if (!(value.content as string).trim()) {
      if (reasoningPresent) fail('REASONING_ONLY', 'The model returned reasoning without an answer. Review the connection’s reasoning and output settings. No draft was replaced.');
      fail('EMPTY_RESPONSE', 'The model returned no answer and Lumiverse supplied no precise cause. Use Check connection, then download diagnostics if needed.');
    }
    return value as unknown as GenerationResponseDTO;
  }
  private async testConnection(connectionId: unknown): Promise<{ message: string }> {
    this.require('generation');
    if (this.checking) throw new Error('A connection check is already running.');
    if (this.starting || this.workspace.job?.status === 'running') throw new Error('Wait for the adaptation to finish before checking a connection.');
    this.checking = true;
    const controller = new AbortController();
    this.checkAbort = controller;
    try {
      const connection = await this.selectedConnection(connectionId);
      this.note('Neutral connection check started.');
      this.readModelResponse(await this.requestModel(connection, [
        { role: 'system', content: 'This is a connection check. Reply briefly.' },
        { role: 'user', content: 'Reply with the word OK.' },
      ], controller.signal, 256, 30_000), true);
      this.note('Neutral connection check accepted.');
      return { message: 'The provider accepted the small test request. Your story was not sent or changed. A full adaptation can still be rejected because its content, size, and settings differ.' };
    } catch (error) {
      this.note('Neutral connection check failed.');
      throw error;
    } finally { this.checking = false; this.checkAbort = undefined; }
  }
  async snapshot(chatId?: string|null): Promise<AppSnapshot> {
    await this.ready;
    const permissions = await this.api.permissions.getGranted();
    let connections: AppSnapshot['connections'] = [];
    if (permissions.includes('generation')) {
      try { connections = (await this.api.connections.list(this.userId)).map(({ id, name, provider, model }) => ({ id, name, provider, model })); }
      catch { this.note('Connection list unavailable.'); }
    }
    const play = chatId === null ? { chatId: null, characterId: null, title: '', enabled: false, current: 0, next: null, scenes: [], canUndo: false, busy: false, notice: 'Open a chat with a Set Points narrator to use scene controls.' } : await this.runtime.view(chatId);
    const { draft, saved, job } = structuredClone(this.workspace);
    return { version: VERSION, permissions, connections, draft, saved, job, resume: { available: Boolean(this.workspace.lastImport && job && ['failed', 'cancelled'].includes(job.status)), retryUncertain: Boolean(job?.retryUncertain) }, play, diagnostics: [...this.entries] };
  }
  private async start(options: ImportOptions, retryUncertain = false, resume = false): Promise<ImportJob> {
    await this.ready;
    this.require('generation');
    if (this.checking) throw new Error('Wait for the connection check to finish before adapting the story.');
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
      const connection = await this.selectedConnection(options.connectionId);
      if (resume && !sameSettings(connection.fingerprint, this.workspace.lastConnectionFingerprint)) throw new Error('The saved connection settings have changed. Resume paused before making any model request. Restore those settings, or use Create adaptation to start with the new settings and normal model charges.');
      this.checkpoints.beginRun({ retryUncertain });
      this.abort = new AbortController();
      const controller = this.abort;
      const job: ImportJob = { id: crypto.randomUUID(), status: 'running', completed: 0, total: 1, label: 'Preparing the story' };
      this.workspace.job = job;
      this.workspace.lastImport = structuredClone(options);
      this.workspace.lastConnectionFingerprint = structuredClone(connection.fingerprint);
      try { await this.persist(); }
      catch {
        this.abort = undefined;
        this.workspace.job = { ...job, status: 'failed', label: 'Import could not be saved', error: 'The import could not be saved for recovery. No model request was sent. Check extension storage before retrying.' };
        this.changed();
        throw new Error(this.workspace.job.error);
      }
      this.note('Import started.');
      this.changed();
      this.jobTask = (async () => {
        let responseReturned = false;
        try {
          const generate: Generate = async (messages, signal) => {
            responseReturned = false;
            controller.signal.throwIfAborted();
            const reusedBefore = this.checkpoints.reused;
            const result = await this.checkpoints.request(messages, connection.fingerprint, () => this.requestModel(connection, messages, signal ?? controller.signal));
            responseReturned = true;
            if (this.checkpoints.reused > reusedBefore) this.note('Reused a saved model response.');
            return this.readModelResponse(result);
          };
          generate.peek = async messages => {
            controller.signal.throwIfAborted();
            const result = await this.checkpoints.peek(messages, connection.fingerprint, { includeRejected: true });
            controller.signal.throwIfAborted();
            if (result === undefined) return undefined;
            try { return this.readModelResponse(result); }
            catch (error) {
              if (!(error instanceof ModelRequestError)) throw error;
              this.note('Saved shortening response was unusable; keeping the original summary.');
              return undefined;
            }
          };
          const draft = await adaptStory(options, generate, (completed, total, label) => {
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
          let message = error instanceof Error ? error.message : 'Import failed. Your last completed draft is preserved.';
          if (!cancelled && responseReturned && (error instanceof ImportError && !['COMPACTION_IMPOSSIBLE', 'REQUEST_SIZE_LIMIT'].includes(error.code) || error instanceof ModelRequestError)) {
            try { await this.checkpoints.invalidateLast(); }
            catch { message = 'The failed step could not be marked for retry. Saved responses were retained; check extension storage before retrying.'; }
          }
          const retryUncertain = error instanceof CheckpointError && error.code === 'UNCERTAIN_REQUEST';
          this.workspace.job = { ...this.workspace.job!, status: cancelled ? 'cancelled' : 'failed', label: cancelled ? 'Import cancelled; saved steps retained' : 'Import needs attention', retryUncertain, error: cancelled ? undefined : `${message} Saved steps are retained. Resume saved import reuses them; remaining model requests use normal charges.` };
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
      case 'test-connection': return this.testConnection(data.connectionId);
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
      case 'resume-import': {
        if (!this.workspace.lastImport) throw new Error('There is no saved import to resume. Earlier versions did not save intermediate work.');
        return this.start(structuredClone(this.workspace.lastImport), data.retryUncertain === true, true);
      }
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
        return { version: VERSION, job: this.workspace.job && { id: this.workspace.job.id, status: this.workspace.job.status, completed: this.workspace.job.completed, total: this.workspace.job.total }, reusedResponses: this.checkpoints.reused, play: { chatId: view.chatId, current: view.current, next: view.next, enabled: view.enabled, sceneCount: view.scenes.length, busy: view.busy }, entries: [...this.entries] };
      }
      default: throw new Error('Unknown Set Points action. Reload the extension.');
    }
  }
  dispose() { this.abort?.abort(); this.checkAbort?.abort(); }
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
