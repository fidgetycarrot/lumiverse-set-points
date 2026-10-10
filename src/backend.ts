import type { SpindleAPI, GenerationRequestDTO, GenerationResponseDTO, InterceptorDisposer } from 'lumiverse-spindle-types';
import { adaptStory, ImportError, validateDraft, type Generate, type GenerationMessage } from './importer';
import { ResponseCheckpoints, CheckpointError } from './checkpoints';
import { CardPublisher } from './publisher';
import { repairSceneOpenings, repairSignature } from './scene-repair';
import { SceneRuntime } from './runtime';
import { extractPage, storyUrl } from './source';
import { enrichVisuals, validateVisualPack, visualDraftSignature, type VisualPack } from './visuals';
import { designLooks, lookDraftSignature, rerollLook, validateLookPack, LOOK_LIMITS, type LookPack } from './looks';
import { VERSION, type AppSnapshot, type ImportJob, type ImportOptions, type SavedStory, type StoryDraft } from './types';

const STATE_PATH = 'workspace.json';
type VisualInput = { draft: StoryDraft; sourceText: string; connectionId: string; maxOutputTokens?: number; reasoningMode?: ImportOptions['reasoningMode'] };
// A look job is either a full design (needs the story text) or a reroll of one
// character (needs only the saved looks, which carry their own story notes).
type LookInput = { draft: StoryDraft; sourceText?: string; connectionId: string; maxOutputTokens?: number; reasoningMode?: ImportOptions['reasoningMode']; reroll?: { characterId: string; note: string; pack: LookPack } };
type RepairInput = { draft: StoryDraft; sceneIds: string[]; connectionId: string; maxOutputTokens?: number; reasoningMode?: ImportOptions['reasoningMode']; promptVersion?:1|2 };
type Workspace = {
  repairInput?: RepairInput; repairJob?: ImportJob; repairResult?: StoryDraft; repairConnectionFingerprint?: unknown;
  draft: StoryDraft|null; saved: SavedStory|null; job: ImportJob|null; lastImport?: ImportOptions; lastConnectionFingerprint?: unknown;
  // This binding is created only from a completed adaptation (or explicit visual
  // input), never inferred from lastImport, which may belong to a failed story.
  draftSource?: { signature: string; text: string };
  visualJob?: ImportJob; visualPack?: VisualPack; visualResultSignature?: string;
  visualInput?: VisualInput; visualConnectionFingerprint?: unknown;
  lookJob?: ImportJob; lookPack?: LookPack; lookResultSignature?: string;
  lookInput?: LookInput; lookConnectionFingerprint?: unknown;
};
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function string(value: unknown, name: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`); return value; }
function sameSettings(a: unknown, b: unknown): boolean {
  const ordered = (_key: string, value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value;
  return JSON.stringify(a, ordered) === JSON.stringify(b, ordered);
}
const OUTPUT_ALLOWANCES = [8000, 16000, 32000, 64000] as const;
const REASONING_MODES = ['inherit', 'off', 'low'] as const;
type ResponseSettings = { maxOutputTokens: number; reasoningMode: typeof REASONING_MODES[number] };
function responseSettings(value: Pick<ImportOptions, 'maxOutputTokens'|'reasoningMode'>): ResponseSettings {
  const maxOutputTokens = value.maxOutputTokens ?? 16000, reasoningMode = value.reasoningMode ?? 'inherit';
  if (!(OUTPUT_ALLOWANCES as readonly unknown[]).includes(maxOutputTokens)) throw new Error('Choose an output allowance of 8,000, 16,000, 32,000, or 64,000 tokens.');
  if (!(REASONING_MODES as readonly unknown[]).includes(reasoningMode)) throw new Error('Choose connection reasoning, low reasoning, or reasoning off.');
  return { maxOutputTokens, reasoningMode };
}
function requestFingerprint(base: unknown, settings: ResponseSettings): unknown {
  // The default is byte-compatible with 0.1.3/0.1.4 checkpoints. Only these
  // explicit per-request controls may vary when reusing completed paid work.
  return { ...record(base), parameters: { temperature: 0.3, max_tokens: settings.maxOutputTokens }, ...(settings.reasoningMode === 'inherit' ? {} : { reasoningMode: settings.reasoningMode }) };
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
  private visualCheckpoints: ResponseCheckpoints;
  private workspace: Workspace = { draft: null, saved: null, job: null };
  private ready: Promise<void>;
  private abort?: AbortController;
  private jobTask?: Promise<void>;
  private visualAbort?: AbortController;
  private visualTask?: Promise<void>;
  private visualStarting = false;
  private repairStarting = false;
  private repairAbort?: AbortController;
  private repairTask?: Promise<void>;
  private repairCheckpoints: ResponseCheckpoints;
  private lookCheckpoints: ResponseCheckpoints;
  private lookStarting = false;
  private lookAbort?: AbortController;
  private lookTask?: Promise<void>;
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
    this.visualCheckpoints = new ResponseCheckpoints(api, userId);
    this.repairCheckpoints = new ResponseCheckpoints(api, userId);
    this.lookCheckpoints = new ResponseCheckpoints(api, userId);
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
    // Optional repair recovery must not make completed legacy drafts unreadable.
    try {
      if (saved.repairInput) this.workspace.repairInput = this.validateRepairInput(saved.repairInput);
      if (saved.repairResult) this.workspace.repairResult = validateDraft(saved.repairResult);
      if (saved.repairJob) {
        if (!['running','complete','failed','cancelled'].includes(saved.repairJob.status) || typeof saved.repairJob.id !== 'string') throw new Error('Invalid repair job');
        this.workspace.repairJob = saved.repairJob.status === 'running' ? {...saved.repairJob,status:'failed',label:'Scene repair interrupted',error:'Resume scene repair to reuse completed steps. An unknown outcome needs an explicit retry.'} : saved.repairJob;
      }
      this.workspace.repairConnectionFingerprint = saved.repairConnectionFingerprint;
    } catch {
      await this.api.userStorage.setJson(`recovery/scene-repair-${Date.now()}.json`,{repairInput:saved.repairInput,repairResult:saved.repairResult,repairJob:saved.repairJob},{userId:this.userId});
      delete this.workspace.repairInput; delete this.workspace.repairResult;
      this.workspace.repairJob = {id:crypto.randomUUID(),status:'failed',completed:0,total:1,label:'Saved scene repair needs attention',error:'Invalid repair data was backed up. The story draft and paid responses are preserved.'};
    }
    // Optional visual data must never make a valid story draft unreadable.
    let invalidVisuals = false;
    if (saved.draftSource) {
      if (typeof saved.draftSource.signature === 'string' && saved.draftSource.signature.length <= 192_000 && typeof saved.draftSource.text === 'string' && saved.draftSource.text.trim().length >= 100 && saved.draftSource.text.length <= 500_000) this.workspace.draftSource = saved.draftSource;
      else invalidVisuals = true;
    }
    try {
      if (saved.visualPack) {
        const pack = validateVisualPack(saved.visualPack);
        if (typeof saved.visualResultSignature !== 'string' || !saved.visualResultSignature || saved.visualResultSignature.length > 192_000) throw new Error('Invalid visual binding');
        this.workspace.visualPack = pack;
        this.workspace.visualResultSignature = saved.visualResultSignature;
      }
    } catch { invalidVisuals = true; }
    try {
      if (saved.visualInput) {
        this.workspace.visualInput = this.validateVisualInput(saved.visualInput);
        this.workspace.visualConnectionFingerprint = saved.visualConnectionFingerprint;
      }
      if (saved.visualJob) {
        const job = saved.visualJob;
        if (!['running', 'complete', 'failed', 'cancelled'].includes(job.status) || typeof job.id !== 'string' || typeof job.label !== 'string' || !Number.isSafeInteger(job.completed) || !Number.isSafeInteger(job.total)) throw new Error('Invalid visual job');
        this.workspace.visualJob = job;
      }
    } catch { invalidVisuals = true; delete this.workspace.visualInput; }
    if (invalidVisuals) {
      await this.api.userStorage.setJson(`recovery/visuals-${Date.now()}.json`, { draftSource: saved.draftSource, visualPack: saved.visualPack, visualInput: saved.visualInput, visualJob: saved.visualJob, visualResultSignature: saved.visualResultSignature, visualConnectionFingerprint: saved.visualConnectionFingerprint }, { userId: this.userId });
      this.workspace.visualJob = { id: crypto.randomUUID(), status: 'failed', completed: 0, total: 1, label: 'Saved image descriptions need attention', error: 'Some saved image-description data could not be opened. A recovery copy was retained. Your story draft and paid responses are preserved.' };
      this.note('Invalid image-description data backed up for recovery.');
    }
    // Designed looks are optional too: bad saved data is set aside, never fatal.
    try {
      if (saved.lookPack) {
        if (typeof saved.lookResultSignature !== 'string' || !saved.lookResultSignature || saved.lookResultSignature.length > 192_000) throw new Error('Invalid look binding');
        this.workspace.lookPack = validateLookPack(saved.lookPack);
        this.workspace.lookResultSignature = saved.lookResultSignature;
      }
      if (saved.lookInput) {
        this.workspace.lookInput = this.validateLookInput(saved.lookInput);
        this.workspace.lookConnectionFingerprint = saved.lookConnectionFingerprint;
      }
      if (saved.lookJob) {
        const job = saved.lookJob;
        if (!['running', 'complete', 'failed', 'cancelled'].includes(job.status) || typeof job.id !== 'string' || typeof job.label !== 'string' || !Number.isSafeInteger(job.completed) || !Number.isSafeInteger(job.total)) throw new Error('Invalid look job');
        this.workspace.lookJob = job.status === 'running' ? { ...job, status: 'failed', label: 'Look design interrupted', error: 'Lumiverse restarted while designing looks. Resume to reuse completed steps. A request with an unknown outcome needs an explicit retry.' } : job;
      }
    } catch {
      await this.api.userStorage.setJson(`recovery/looks-${Date.now()}.json`, { lookPack: saved.lookPack, lookInput: saved.lookInput, lookJob: saved.lookJob, lookResultSignature: saved.lookResultSignature }, { userId: this.userId });
      delete this.workspace.lookPack; delete this.workspace.lookResultSignature; delete this.workspace.lookInput;
      this.workspace.lookJob = { id: crypto.randomUUID(), status: 'failed', completed: 0, total: 1, label: 'Saved looks need attention', error: 'Some saved look data could not be opened. A recovery copy was kept. Your story draft and paid responses are preserved.' };
      this.note('Invalid look data backed up for recovery.');
    }
    if (this.workspace.visualJob?.status === 'running') {
      this.workspace.visualJob = { ...this.workspace.visualJob, status: 'failed', label: 'Image descriptions interrupted', error: 'Lumiverse restarted during image descriptions. Resume to reuse completed steps. A request with an unknown outcome needs an explicit retry.' };
      await this.persist();
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
  private validateVisualInput(value: unknown): VisualInput {
    const data = record(value), draft = validateDraft(data.draft);
    if (!draft.cast.length) throw new Error('The draft needs at least one character before creating image descriptions.');
    if (typeof data.sourceText !== 'string' || data.sourceText.trim().length < 100 || data.sourceText.length > 500_000) throw new Error('Provide between 100 and 500,000 characters of the original story for these image descriptions.');
    const settings = responseSettings(data as VisualInput);
    return { draft, sourceText: data.sourceText, connectionId: string(data.connectionId, 'Image-description model connection'), ...settings };
  }
  private validateLookInput(value: unknown): LookInput {
    const data = record(value), draft = validateDraft(data.draft);
    if (!draft.cast.length) throw new Error('The draft needs at least one character before designing looks.');
    const base = { draft, connectionId: string(data.connectionId, 'Look design model connection'), ...responseSettings(data as LookInput) };
    if (data.reroll !== undefined) {
      const reroll = record(data.reroll), characterId = string(reroll.characterId, 'Character to reroll');
      if (!draft.cast.some(person => person.id === characterId)) throw new Error('Choose a character from this draft to reroll.');
      if (typeof reroll.note !== 'string' || reroll.note.length > LOOK_LIMITS.note) throw new Error(`Keep the change note under ${LOOK_LIMITS.note} characters.`);
      return { ...base, reroll: { characterId, note: reroll.note.trim(), pack: validateLookPack(reroll.pack, draft) } };
    }
    if (typeof data.sourceText !== 'string' || data.sourceText.trim().length < 100 || data.sourceText.length > 500_000) throw new Error('Provide between 100 and 500,000 characters of the original story to design looks from.');
    return { ...base, sourceText: data.sourceText };
  }
  private looksBusy() { return this.lookStarting || !!this.lookAbort || this.workspace.lookJob?.status === 'running'; }
  private note(kind: string) { this.entries.push(`${new Date().toISOString()} ${kind}`); this.entries = this.entries.slice(-100); }
  private async selectedConnection(value: unknown) {
    const id = string(value, 'Adaptation model connection');
    const connection = await this.api.connections.get(id, this.userId);
    if (!connection) throw new Error('The selected model connection is no longer available.');
    if (!connection.model?.trim()) throw new Error('The selected connection has no model. Choose a model for that connection in Lumiverse, then retry.');
    if (!connection.provider?.trim()) throw new Error('The selected connection has no provider. Edit that connection in Lumiverse, then retry.');
    return { id, model: connection.model, provider: connection.provider, fingerprint: { id, model: connection.model, provider: connection.provider, api_url: connection.api_url, preset_id: connection.preset_id, metadata: connection.metadata, reasoning_bindings: connection.reasoning_bindings, parameters: { temperature: 0.3, max_tokens: 16000 } } };
  }
  private async requestModel(connection: { id: string; model: string; provider: string }, messages: GenerationMessage[], signal: AbortSignal, maxTokens = 16000, timeoutMs = 600_000, reasoningMode: ResponseSettings['reasoningMode'] = 'inherit'): Promise<unknown> {
    this.require('generation');
    const deadline = AbortSignal.timeout(timeoutMs);
    const requestSignal = AbortSignal.any([signal, deadline]);
    let onAbort: (() => void) | undefined;
    try {
      requestSignal.throwIfAborted();
      const request: RawModelRequest = { type: 'raw', connection_id: connection.id, provider: connection.provider, model: connection.model, userId: this.userId, messages, parameters: { temperature: 0.3, max_tokens: maxTokens }, signal: requestSignal };
      if (reasoningMode !== 'inherit') request.reasoning = reasoningMode === 'off' && connection.provider !== 'openrouter'
        ? { source: 'off' } : { source: 'custom', apiReasoning: true, effort: reasoningMode === 'off' ? 'none' : 'low' };
      this.note(`Model request settings: requestedOutputTokens=${maxTokens}; reasoning=${reasoningMode}.`);
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
    if (LIMIT_STOPS.has(finish) || LIMIT_STOPS.has(native)) fail('OUTPUT_LIMIT', connectionCheck ? 'The provider responded, but the small test reached its output allowance before returning a complete answer. Reasoning can consume this allowance.' : 'The model reached its output allowance before finishing this step. Under Settings for unfinished requests, increase the response allowance if the model supports it or lower the reasoning mode. Completed steps can be reused; retrying this unfinished step uses normal charges.');
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
    if (this.repairStarting || this.repairAbort || this.workspace.repairJob?.status === 'running') throw new Error('Wait for scene repair to finish or cancel it first.');
    if (this.checking) throw new Error('A connection check is already running.');
    if (this.starting || this.abort || this.workspace.job?.status === 'running') throw new Error('Wait for the adaptation to finish before checking a connection.');
    if (this.visualStarting || this.visualAbort || this.workspace.visualJob?.status === 'running') throw new Error('Wait for image descriptions to finish before checking a connection.');
    if (this.looksBusy()) throw new Error('Wait for look design to finish before checking a connection.');
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
    let personas: AppSnapshot['personas'];
    if (permissions.includes('personas')) {
      try { personas = (await this.api.personas.list({ limit: 100, userId: this.userId })).data.map(({ id, name, title }) => ({ id, name, title })); }
      catch { this.note('Persona list unavailable.'); }
    }
    const lookJob = structuredClone(this.workspace.lookJob ?? null);
    const play = chatId === null ? { chatId: null, characterId: null, title: '', enabled: false, current: 0, next: null, scenes: [], canUndo: false, busy: false, notice: 'Open a chat with a Set Points narrator to use scene controls.' } : await this.runtime.view(chatId);
    const { draft, saved, job } = structuredClone(this.workspace);
    const visualJob = structuredClone(this.workspace.visualJob ?? null);
    return { version: VERSION, permissions, connections, draft, saved, job, resume: { available: Boolean(this.workspace.lastImport && job && ['failed', 'cancelled'].includes(job.status)), retryUncertain: Boolean(job?.retryUncertain), ...responseSettings(this.workspace.lastImport ?? {}) }, visuals: {
      job: visualJob, pack: structuredClone(this.workspace.visualPack ?? null), resultSignature: this.workspace.visualResultSignature,
      sourceSignature: this.workspace.draftSource?.signature, requestSignature: this.workspace.visualInput ? visualDraftSignature(this.workspace.visualInput.draft) : undefined,
      resumeAvailable: Boolean(this.workspace.visualInput && visualJob && ['failed', 'cancelled'].includes(visualJob.status)), retryUncertain: Boolean(visualJob?.retryUncertain),
      connectionId: this.workspace.visualInput?.connectionId, ...responseSettings(this.workspace.visualInput ?? {}),
    }, looks: {
      job: lookJob, pack: structuredClone(this.workspace.lookPack ?? null), resultSignature: this.workspace.lookResultSignature,
      requestSignature: this.workspace.lookInput ? lookDraftSignature(this.workspace.lookInput.draft) : undefined,
      resumeAvailable: Boolean(this.workspace.lookInput && lookJob && ['failed', 'cancelled'].includes(lookJob.status)), retryUncertain: Boolean(lookJob?.retryUncertain),
      ...(this.workspace.lookInput?.reroll && lookJob?.status === 'running' ? { rerolling: this.workspace.lookInput.reroll.characterId } : {}),
      connectionId: this.workspace.lookInput?.connectionId, ...responseSettings(this.workspace.lookInput ?? {}),
    }, ...(personas ? { personas } : {}), repairs: {job:this.workspace.repairJob??null,result:this.workspace.repairResult??null,requestSignature:this.workspace.repairInput?repairSignature(this.workspace.repairInput.draft):undefined,resumeAvailable:!!this.workspace.repairInput&&['failed','cancelled'].includes(this.workspace.repairJob?.status??''),retryUncertain:!!this.workspace.repairJob?.retryUncertain,connectionId:this.workspace.repairInput?.connectionId}, play, diagnostics: [...this.entries] };
  }
  private async start(options: ImportOptions, retryUncertain = false, resume = false): Promise<ImportJob> {
    await this.ready;
    const settings = responseSettings(options);
    this.require('generation');
    if (this.repairStarting || this.repairAbort || this.workspace.repairJob?.status === 'running') throw new Error('Wait for scene repair to finish or cancel it first.');
    if (this.checking) throw new Error('Wait for the connection check to finish before adapting the story.');
    if (this.saving) throw new Error('Wait for the card to finish saving before importing another story.');
    if (this.starting || this.abort || this.workspace.job?.status === 'running') throw new Error('An import is already running. Cancel it before starting another.');
    if (this.visualStarting || this.visualAbort || this.workspace.visualJob?.status === 'running') throw new Error('Wait for image descriptions to finish or cancel them before starting an adaptation.');
    if (this.looksBusy()) throw new Error('Wait for look design to finish or cancel it before starting an adaptation.');
    this.starting = true;
    try {
      if (typeof options.text !== 'string' || options.text.trim().length < 100 || options.text.length > 500_000) throw new Error('Paste between 100 and 500,000 characters of story text.');
      if (!Number.isInteger(options.sceneCount) || options.sceneCount < 2 || options.sceneCount > 32) throw new Error('Choose between 2 and 32 scenes.');
      if (!Number.isInteger(options.chunkSize) || options.chunkSize < 4000 || options.chunkSize > 20000) throw new Error('Section size must be between 4,000 and 20,000 characters.');
      string(options.sourceTitle, 'Story title'); string(options.playerRole, 'Player role'); string(options.startingPoint, 'Starting point');
      if (options.sourceTitle.length > 300 || options.playerRole.length > 2000 || options.startingPoint.length > 2000) throw new Error('Keep the title under 300 characters and role/starting point under 2,000 characters.');
      if(options.openingStyle!==undefined&&!['interactive','story'].includes(options.openingStyle))throw new Error('Choose a valid scene opening style.');
      if (options.narrationMode !== undefined && !['neutral','character'].includes(options.narrationMode)) throw new Error('Choose a valid narration style.');
      if (options.narrationMode === 'character' && (typeof options.narratorCharacter !== 'string' || !options.narratorCharacter.trim())) throw new Error('Name the supporting character who narrates.');
      if (options.narratorCharacter !== undefined && (typeof options.narratorCharacter !== 'string' || options.narratorCharacter.length>200) || options.sourceViewpoint !== undefined && (typeof options.sourceViewpoint !== 'string' || options.sourceViewpoint.length>500)) throw new Error('Keep narrator names under 200 characters and source viewpoint under 500.');
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
            const fingerprint = requestFingerprint(connection.fingerprint, settings);
            const reuseFingerprints = OUTPUT_ALLOWANCES.flatMap(maxOutputTokens => REASONING_MODES.map(reasoningMode => requestFingerprint(connection.fingerprint, { maxOutputTokens, reasoningMode })));
            const result = await this.checkpoints.request(messages, fingerprint, () => this.requestModel(connection, messages, signal ?? controller.signal, settings.maxOutputTokens, 600_000, settings.reasoningMode), { reuseFingerprints });
            responseReturned = true;
            if (this.checkpoints.reused > reusedBefore) this.note('Reused a saved model response.');
            return this.readModelResponse(result);
          };
          generate.peek = async (messages, _signal, peekOptions) => {
            controller.signal.throwIfAborted();
            const reuseFingerprints = OUTPUT_ALLOWANCES.flatMap(maxOutputTokens => REASONING_MODES.map(reasoningMode => requestFingerprint(connection.fingerprint, { maxOutputTokens, reasoningMode })));
            const result = await this.checkpoints.peek(messages, requestFingerprint(connection.fingerprint, settings), { includeRejected: true, reuseFingerprints, requireSettled: peekOptions?.requireSettled });
            controller.signal.throwIfAborted();
            if (result === undefined) return undefined;
            try { return this.readModelResponse(result); }
            catch (error) {
              if (!(error instanceof ModelRequestError)) throw error;
              this.note('Saved response could not be reused.');
              return undefined;
            }
          };
          const draft = await adaptStory(options, generate, (completed, total, label) => {
            if (this.workspace.job?.id !== job.id) return;
            this.workspace.job = { ...job, completed, total, label, phase: label };
            this.changed();
          }, controller.signal);
          controller.signal.throwIfAborted();
          this.workspace.draft = validateDraft(draft);
          this.workspace.draftSource = { signature: visualDraftSignature(this.workspace.draft), text: options.text };
          this.workspace.saved = null;
          this.workspace.job = { ...this.workspace.job!, status: 'complete', label: 'Ready to review', completed: this.workspace.job!.total };
          await this.persist();
          this.note('Import completed. Draft ready to review.');
        } catch (error) {
          const cancelled = controller.signal.aborted;
          let message = error instanceof Error ? error.message : 'Import failed. Your last completed draft is preserved.';
          if (!cancelled && responseReturned && (error instanceof ImportError && !['COMPACTION_IMPOSSIBLE', 'REQUEST_SIZE_LIMIT', 'DRAFT_SIZE_LIMIT'].includes(error.code) || error instanceof ModelRequestError)) {
            try { await this.checkpoints.invalidateLast(); }
            catch { message = 'The failed step could not be marked for retry. Saved responses were retained; check extension storage before retrying.'; }
          }
          const retryUncertain = error instanceof CheckpointError && error.code === 'UNCERTAIN_REQUEST';
          const phase = this.workspace.job?.phase;
          if (phase) this.note(`Import stopped during: ${phase}.`);
          this.workspace.job = { ...this.workspace.job!, status: cancelled ? 'cancelled' : 'failed', label: cancelled ? 'Import cancelled; saved steps retained' : 'Import needs attention', retryUncertain, error: cancelled ? undefined : `${message} Saved steps are retained. Resume saved import reuses them; remaining model requests use normal charges.` };
          this.note(cancelled ? 'Import cancelled.' : 'Import failed; last completed draft preserved.');
          await this.persist().catch(() => this.note('Could not persist the import status.'));
        } finally { if (this.abort === controller) this.abort = undefined; this.changed(); }
      })();
      return structuredClone(job);
    } finally { this.starting = false; }
  }
  private validateRepairInput(value: unknown): RepairInput {
    const data=record(value), draft=validateDraft(data.draft);
    if (!Array.isArray(data.sceneIds) || !data.sceneIds.length || new Set(data.sceneIds).size!==data.sceneIds.length || data.sceneIds.some(id=>typeof id!=='string'||!draft.scenes.some(scene=>scene.id===id))) throw new Error('Select existing scenes once each for repair.');
    if(data.promptVersion!==undefined&&data.promptVersion!==1&&data.promptVersion!==2)throw new Error('Invalid saved scene repair format.');
    return {draft,sceneIds:data.sceneIds as string[],connectionId:string(data.connectionId,'Scene repair connection'),...responseSettings(data),...(data.promptVersion!==undefined?{promptVersion:data.promptVersion as 1|2}:{})};
  }
  private async startRepair(value: unknown, retryUncertain=false, resume=false): Promise<ImportJob> {
    await this.ready; this.require('generation');
    if (this.starting||this.abort||this.visualStarting||this.visualAbort||this.repairStarting||this.repairAbort||this.checking||this.saving||this.workspace.job?.status==='running'||this.workspace.visualJob?.status==='running'||this.looksBusy()) throw new Error('Wait for the current operation to finish or cancel it before repairing scenes.');
    this.repairStarting=true;
    try {
      const options=this.validateRepairInput(value);if(!resume)options.promptVersion=2;
      const settings=responseSettings(options),connection=await this.selectedConnection(options.connectionId);
      if (resume&&!sameSettings(connection.fingerprint,this.workspace.repairConnectionFingerprint)) throw new Error('The saved scene repair connection changed. Restore its settings before resuming, or start a new normally charged repair.');
      this.repairCheckpoints.beginRun({retryUncertain});
      const controller=new AbortController(),job:ImportJob={id:crypto.randomUUID(),status:'running',completed:0,total:options.sceneIds.length,label:'Preparing scene repair'};
      this.repairAbort=controller;
      this.workspace.repairInput=structuredClone(options);this.workspace.repairJob=job;delete this.workspace.repairResult;this.workspace.repairConnectionFingerprint=structuredClone(connection.fingerprint);
      try { await this.persist(); } catch { this.repairAbort=undefined;this.workspace.repairJob={...job,status:'failed',label:'Scene repair could not be saved',error:'No model request was sent. Check extension storage.'};this.changed();throw new Error(this.workspace.repairJob.error); }
      this.changed();
      this.repairTask=(async()=>{
        let responseReturned=false;
        try {
          const fingerprint=requestFingerprint(connection.fingerprint,settings),reuseFingerprints=OUTPUT_ALLOWANCES.flatMap(maxOutputTokens=>REASONING_MODES.map(reasoningMode=>requestFingerprint(connection.fingerprint,{maxOutputTokens,reasoningMode})));
          const generate:Generate=async(messages,signal)=>{
            responseReturned=false;controller.signal.throwIfAborted();
            const response=await this.repairCheckpoints.request(messages,fingerprint,()=>this.requestModel(connection,messages,signal??controller.signal,settings.maxOutputTokens,600_000,settings.reasoningMode),{reuseFingerprints});
            responseReturned=true;return this.readModelResponse(response);
          };
          this.workspace.repairResult=await repairSceneOpenings(options.draft,options.sceneIds,generate,(completed,total,label)=>{this.workspace.repairJob={...job,completed,total,label,phase:label};this.changed();},controller.signal,options.promptVersion??1);
          controller.signal.throwIfAborted();this.workspace.repairJob={...this.workspace.repairJob!,status:'complete',label:'Repaired scenes ready to review'};
          this.note('Scene repair completed; result awaits explicit review.');await this.persist();
        } catch(error) {
          const cancelled=controller.signal.aborted;
          let message=error instanceof ImportError||error instanceof ModelRequestError||error instanceof CheckpointError?error.message:'Scene repair could not finish. The current draft is preserved.';
          if (!cancelled&&responseReturned&&(error instanceof ModelRequestError||error instanceof ImportError&&!['REQUEST_SIZE_LIMIT','OUTPUT_LIMIT'].includes(error.code))) {
            try {await this.repairCheckpoints.invalidateLast();} catch {message='Could not mark the failed scene response for retry. Saved work was retained.';}
          }
          this.workspace.repairJob={...this.workspace.repairJob!,status:cancelled?'cancelled':'failed',label:cancelled?'Scene repair cancelled':'Scene repair needs attention',retryUncertain:error instanceof CheckpointError&&error.code==='UNCERTAIN_REQUEST',error:cancelled?undefined:`${message} Resume scene repair reuses compatible saved steps; remaining requests use normal charges.`};
          delete this.workspace.repairResult;await this.persist().catch(()=>this.note('Could not persist scene repair status.'));
        } finally {if(this.repairAbort===controller)this.repairAbort=undefined;this.changed();}
      })();
      return structuredClone(job);
    } finally {this.repairStarting=false;}
  }
  private async startVisuals(value: unknown, retryUncertain = false, resume = false): Promise<ImportJob> {
    await this.ready;
    this.require('generation');
    if (this.repairStarting || this.repairAbort || this.workspace.repairJob?.status === 'running') throw new Error('Wait for scene repair to finish or cancel it first.');
    if (this.checking) throw new Error('Wait for the connection check to finish before creating image descriptions.');
    if (this.saving) throw new Error('Wait for the card to finish saving before creating image descriptions.');
    if (this.starting || this.abort || this.workspace.job?.status === 'running') throw new Error('Wait for the adaptation to finish before creating image descriptions.');
    if (this.visualStarting || this.visualAbort || this.workspace.visualJob?.status === 'running') throw new Error('Image descriptions are already running. Wait or cancel them first.');
    if (this.looksBusy()) throw new Error('Wait for look design to finish or cancel it before creating image descriptions.');
    this.visualStarting = true;
    try {
      const data = record(value), draft = validateDraft(data.draft), signature = visualDraftSignature(draft);
      const boundSource = this.workspace.draftSource;
      const sourceText = data.sourceText === undefined && boundSource?.signature === signature ? boundSource.text : data.sourceText;
      if (sourceText === undefined) throw new Error('Provide the original story for this draft. Set Points cannot safely match it to a saved source. Paste it in Image descriptions or explicitly copy the text from Import.');
      const options = this.validateVisualInput({ ...data, draft, sourceText }), settings = responseSettings(options);
      const connection = await this.selectedConnection(options.connectionId);
      if (resume && !sameSettings(connection.fingerprint, this.workspace.visualConnectionFingerprint)) throw new Error('The saved image-description connection settings have changed. Resume paused before making any model request. Restore those settings, or create image descriptions with the new connection and normal model charges.');
      this.visualCheckpoints.beginRun({ retryUncertain });
      const controller = new AbortController();
      this.visualAbort = controller;
      const job: ImportJob = { id: crypto.randomUUID(), status: 'running', completed: 0, total: 1, label: 'Preparing image descriptions' };
      this.workspace.visualJob = job;
      this.workspace.visualInput = structuredClone(options);
      this.workspace.visualConnectionFingerprint = structuredClone(connection.fingerprint);
      // An explicit source choice is a new binding. It does not replace the
      // saved story draft, its import options, or the existing visual result.
      this.workspace.draftSource = { signature, text: options.sourceText };
      try { await this.persist(); }
      catch {
        this.visualAbort = undefined;
        this.workspace.visualJob = { ...job, status: 'failed', label: 'Image descriptions could not be saved', error: 'The image-description request could not be saved for recovery. No model request was sent. Check extension storage before retrying.' };
        this.changed();
        throw new Error(this.workspace.visualJob.error);
      }
      this.note('Image descriptions started.');
      this.changed();
      this.visualTask = (async () => {
        let responseReturned = false;
        try {
          const fingerprint = requestFingerprint(connection.fingerprint, settings);
          const reuseFingerprints = OUTPUT_ALLOWANCES.flatMap(maxOutputTokens => REASONING_MODES.map(reasoningMode => requestFingerprint(connection.fingerprint, { maxOutputTokens, reasoningMode })));
          const generate: Generate = async (messages, signal) => {
            responseReturned = false;
            controller.signal.throwIfAborted();
            const reusedBefore = this.visualCheckpoints.reused;
            const result = await this.visualCheckpoints.request(messages, fingerprint, () => this.requestModel(connection, messages, signal ?? controller.signal, settings.maxOutputTokens, 600_000, settings.reasoningMode), { reuseFingerprints });
            responseReturned = true;
            if (this.visualCheckpoints.reused > reusedBefore) this.note('Reused a saved image-description response.');
            return this.readModelResponse(result);
          };
          const pack = await enrichVisuals(options, generate, (completed, total, label) => {
            this.workspace.visualJob = { ...job, completed, total, label, phase: label };
            this.changed();
          }, controller.signal);
          controller.signal.throwIfAborted();
          this.workspace.visualPack = validateVisualPack(pack, options.draft);
          this.workspace.visualResultSignature = signature;
          this.workspace.visualJob = { ...this.workspace.visualJob!, status: 'complete', label: 'Image descriptions ready to review', completed: this.workspace.visualJob!.total };
          await this.persist();
          this.note('Image descriptions completed.');
        } catch (error) {
          const cancelled = controller.signal.aborted;
          let message = error instanceof ImportError || error instanceof ModelRequestError || error instanceof CheckpointError ? error.message : 'Image descriptions could not be completed. Your story draft and previous descriptions are preserved.';
          if (!cancelled && responseReturned && (error instanceof ImportError && !['VISUAL_SIZE_LIMIT', 'REQUEST_SIZE_LIMIT'].includes(error.code) || error instanceof ModelRequestError)) {
            try { await this.visualCheckpoints.invalidateLast(); }
            catch { message = 'The failed image-description step could not be marked for retry. Saved responses were retained; check extension storage before retrying.'; }
          }
          const retryUncertain = error instanceof CheckpointError && error.code === 'UNCERTAIN_REQUEST';
          if (this.workspace.visualJob?.phase) this.note(`Image descriptions stopped during: ${this.workspace.visualJob.phase}.`);
          this.workspace.visualJob = { ...this.workspace.visualJob!, status: cancelled ? 'cancelled' : 'failed', label: cancelled ? 'Image descriptions cancelled; saved steps retained' : 'Image descriptions need attention', retryUncertain, error: cancelled ? undefined : `${message} Saved steps are retained. Resume image descriptions reuses them; remaining model requests use normal charges.` };
          this.note(cancelled ? 'Image descriptions cancelled.' : 'Image descriptions failed; story draft preserved.');
          await this.persist().catch(() => this.note('Could not persist image-description status.'));
        } finally { if (this.visualAbort === controller) this.visualAbort = undefined; this.changed(); }
      })();
      return structuredClone(job);
    } finally { this.visualStarting = false; }
  }
  private async startLooks(value: unknown, retryUncertain = false, resume = false): Promise<ImportJob> {
    await this.ready;
    this.require('generation');
    if (this.repairStarting || this.repairAbort || this.workspace.repairJob?.status === 'running') throw new Error('Wait for scene repair to finish or cancel it first.');
    if (this.checking) throw new Error('Wait for the connection check to finish before designing looks.');
    if (this.saving) throw new Error('Wait for the card to finish saving before designing looks.');
    if (this.starting || this.abort || this.workspace.job?.status === 'running') throw new Error('Wait for the adaptation to finish before designing looks.');
    if (this.visualStarting || this.visualAbort || this.workspace.visualJob?.status === 'running') throw new Error('Wait for image descriptions to finish or cancel them before designing looks.');
    if (this.looksBusy()) throw new Error('Looks are already being designed. Wait or cancel first.');
    this.lookStarting = true;
    try {
      const options = this.validateLookInput(value), settings = responseSettings(options), signature = lookDraftSignature(options.draft);
      const connection = await this.selectedConnection(options.connectionId);
      if (resume && !sameSettings(connection.fingerprint, this.workspace.lookConnectionFingerprint)) throw new Error('The saved look design connection settings have changed. Resume paused before making any model request. Restore those settings, or design looks again with the new connection and normal model charges.');
      this.lookCheckpoints.beginRun({ retryUncertain });
      const controller = new AbortController();
      this.lookAbort = controller;
      const job: ImportJob = { id: crypto.randomUUID(), status: 'running', completed: 0, total: 1, label: options.reroll ? 'Preparing a new look' : 'Preparing to design looks' };
      this.workspace.lookJob = job;
      this.workspace.lookInput = structuredClone(options);
      this.workspace.lookConnectionFingerprint = structuredClone(connection.fingerprint);
      // Story text chosen for a design is remembered for this draft version,
      // the same way image descriptions remember theirs.
      if (options.sourceText !== undefined) this.workspace.draftSource = { signature: visualDraftSignature(options.draft), text: options.sourceText };
      try { await this.persist(); }
      catch {
        this.lookAbort = undefined;
        this.workspace.lookJob = { ...job, status: 'failed', label: 'Look design could not be saved', error: 'The request could not be saved for recovery. No model request was sent. Check extension storage before retrying.' };
        this.changed();
        throw new Error(this.workspace.lookJob.error);
      }
      this.note(options.reroll ? 'Look reroll started.' : 'Look design started.');
      this.changed();
      this.lookTask = (async () => {
        let responseReturned = false;
        try {
          const fingerprint = requestFingerprint(connection.fingerprint, settings);
          const reuseFingerprints = OUTPUT_ALLOWANCES.flatMap(maxOutputTokens => REASONING_MODES.map(reasoningMode => requestFingerprint(connection.fingerprint, { maxOutputTokens, reasoningMode })));
          const generate: Generate = async (messages, signal) => {
            responseReturned = false;
            controller.signal.throwIfAborted();
            const reusedBefore = this.lookCheckpoints.reused;
            const result = await this.lookCheckpoints.request(messages, fingerprint, () => this.requestModel(connection, messages, signal ?? controller.signal, settings.maxOutputTokens, 600_000, settings.reasoningMode), { reuseFingerprints });
            responseReturned = true;
            if (this.lookCheckpoints.reused > reusedBefore) this.note('Reused a saved look design response.');
            return this.readModelResponse(result);
          };
          const progress = (completed: number, total: number, label: string) => { this.workspace.lookJob = { ...job, completed, total, label, phase: label }; this.changed(); };
          const pack = options.reroll
            ? await rerollLook({ draft: options.draft, pack: options.reroll.pack, characterId: options.reroll.characterId, note: options.reroll.note }, generate, progress, controller.signal)
            : await designLooks({ draft: options.draft, sourceText: options.sourceText! }, generate, progress, controller.signal);
          controller.signal.throwIfAborted();
          this.workspace.lookPack = validateLookPack(pack, options.draft);
          this.workspace.lookResultSignature = signature;
          this.workspace.lookJob = { ...this.workspace.lookJob!, status: 'complete', label: options.reroll ? 'New look ready to review' : 'Looks ready to review', completed: this.workspace.lookJob!.total };
          await this.persist();
          this.note(options.reroll ? 'Look reroll completed.' : 'Look design completed.');
        } catch (error) {
          const cancelled = controller.signal.aborted;
          let message = error instanceof ImportError || error instanceof ModelRequestError || error instanceof CheckpointError ? error.message : 'Looks could not be designed. Your story draft and earlier looks are preserved.';
          if (!cancelled && responseReturned && (error instanceof ImportError && !['LOOK_SIZE_LIMIT', 'REQUEST_SIZE_LIMIT'].includes(error.code) || error instanceof ModelRequestError)) {
            try { await this.lookCheckpoints.invalidateLast(); }
            catch { message = 'The failed step could not be marked for retry. Saved responses were retained; check extension storage before retrying.'; }
          }
          const retryUncertain = error instanceof CheckpointError && error.code === 'UNCERTAIN_REQUEST';
          if (this.workspace.lookJob?.phase) this.note(`Look design stopped during: ${this.workspace.lookJob.phase}.`);
          this.workspace.lookJob = { ...this.workspace.lookJob!, status: cancelled ? 'cancelled' : 'failed', label: cancelled ? 'Look design cancelled; saved steps kept' : 'Look design needs attention', retryUncertain, error: cancelled ? undefined : `${message} Saved steps are kept. Resume reuses them; remaining model requests use normal charges.` };
          this.note(cancelled ? 'Look design cancelled.' : 'Look design failed; story draft preserved.');
          await this.persist().catch(() => this.note('Could not persist look design status.'));
        } finally { if (this.lookAbort === controller) this.lookAbort = undefined; this.changed(); }
      })();
      return structuredClone(job);
    } finally { this.lookStarting = false; }
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
        const options = structuredClone(this.workspace.lastImport);
        if (data.maxOutputTokens !== undefined) options.maxOutputTokens = data.maxOutputTokens as number;
        if (data.reasoningMode !== undefined) options.reasoningMode = data.reasoningMode as ImportOptions['reasoningMode'];
        return this.start(options, data.retryUncertain === true, true);
      }
      case 'cancel-import': this.abort?.abort(); return { cancelled: Boolean(this.abort) };
      case 'start-visuals': return this.startVisuals(data);
      case 'resume-visuals': {
        if (!this.workspace.visualInput) throw new Error('There are no saved image descriptions to resume.');
        const options = structuredClone(this.workspace.visualInput);
        if (data.maxOutputTokens !== undefined) options.maxOutputTokens = data.maxOutputTokens as number;
        if (data.reasoningMode !== undefined) options.reasoningMode = data.reasoningMode as ImportOptions['reasoningMode'];
        return this.startVisuals(options, data.retryUncertain === true, true);
      }
      case 'cancel-visuals': this.visualAbort?.abort(); return { cancelled: Boolean(this.visualAbort) };
      case 'save-visuals': {
        if (this.visualStarting || this.visualAbort || this.workspace.visualJob?.status === 'running') throw new Error('Wait for image descriptions to finish or cancel them before saving edits.');
        const draft = validateDraft(data.draft), signature = visualDraftSignature(draft);
        if (signature !== this.workspace.visualResultSignature) throw new Error('These image descriptions belong to a different draft revision. Create descriptions for the current draft before saving.');
        const pack = validateVisualPack(data.pack, draft);
        this.workspace.visualPack = pack;
        await this.persist(); this.changed(); return structuredClone(pack);
      }
      case 'start-looks': {
        const draft = validateDraft(data.draft), bound = this.workspace.draftSource;
        const sourceText = data.sourceText === undefined && bound?.signature === visualDraftSignature(draft) ? bound.text : data.sourceText;
        if (sourceText === undefined) throw new Error('Add the original story for this draft first. Set Points has no saved copy that matches it.');
        return this.startLooks({ ...data, draft, sourceText, reroll: undefined });
      }
      case 'reroll-look': {
        const draft = validateDraft(data.draft);
        if (!this.workspace.lookPack || this.workspace.lookResultSignature !== lookDraftSignature(draft)) throw new Error('The saved looks belong to a different draft or cast. Design looks for the current draft first.');
        return this.startLooks({ ...data, draft, sourceText: undefined, reroll: { characterId: data.characterId, note: data.note ?? '', pack: this.workspace.lookPack } });
      }
      case 'resume-looks': {
        if (!this.workspace.lookInput) throw new Error('There is no saved look design to resume.');
        const options = structuredClone(this.workspace.lookInput);
        if (data.maxOutputTokens !== undefined) options.maxOutputTokens = data.maxOutputTokens as number;
        if (data.reasoningMode !== undefined) options.reasoningMode = data.reasoningMode as ImportOptions['reasoningMode'];
        return this.startLooks(options, data.retryUncertain === true, true);
      }
      case 'cancel-looks': this.lookAbort?.abort(); return { cancelled: Boolean(this.lookAbort) };
      case 'switch-persona': {
        this.require('personas');
        const persona = await this.api.personas.get(string(data.personaId, 'Persona'), this.userId);
        if (!persona) throw new Error('That persona is no longer in Lumiverse.');
        await this.api.personas.switchActive(persona.id, this.userId);
        this.note('Active persona switched on request.');
        return { personaId: persona.id, name: persona.name };
      }
      case 'start-scene-repair': return this.startRepair(data);
      case 'resume-scene-repair': {
        if (!this.workspace.repairInput) throw new Error('No saved scene repair is available.');
        if (repairSignature(validateDraft(data.draft))!==repairSignature(this.workspace.repairInput.draft)) throw new Error('The saved repair belongs to a different draft version.');
        return this.startRepair({...this.workspace.repairInput,...responseSettings({...this.workspace.repairInput,...data})},data.retryUncertain===true,true);
      }
      case 'cancel-scene-repair': this.repairAbort?.abort(); return {cancelled:true};
      case 'apply-scene-repair': {
        const current=validateDraft(data.draft);
        if (this.starting||this.visualStarting||this.repairStarting||this.repairAbort||this.workspace.job?.status==='running'||this.workspace.visualJob?.status==='running'||this.looksBusy()||this.saving) throw new Error('Wait for the current operation to finish.');
        if (!this.workspace.repairResult||!this.workspace.repairInput||this.workspace.repairJob?.status!=='complete'||repairSignature(current)!==repairSignature(this.workspace.repairInput.draft)) throw new Error('The repaired scenes belong to a different draft version. Your edits are preserved.');
        const result=validateDraft(this.workspace.repairResult);this.workspace.draft=result;this.workspace.saved=null;await this.persist();this.changed();return result;
      }
      case 'save-draft': {
        if (this.saving) throw new Error('Wait for the card to finish saving before replacing the draft.');
        if (this.workspace.job?.status === 'running') throw new Error('Wait for the import to finish or cancel it before replacing the draft.');
        const draft = validateDraft(data.draft);
        this.workspace.draft = draft; this.workspace.saved = null;
        await this.persist(); this.changed(); return draft;
      }
      case 'create-card': {
        if (this.repairStarting||this.repairAbort) throw new Error('Wait for scene repair to finish or cancel it before publishing.');
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
        return { version: VERSION, job: this.workspace.job && { id: this.workspace.job.id, status: this.workspace.job.status, completed: this.workspace.job.completed, total: this.workspace.job.total }, reusedResponses: this.checkpoints.reused, visualJob: this.workspace.visualJob && { id: this.workspace.visualJob.id, status: this.workspace.visualJob.status, completed: this.workspace.visualJob.completed, total: this.workspace.visualJob.total }, reusedVisualResponses: this.visualCheckpoints.reused, lookJob: this.workspace.lookJob && { id: this.workspace.lookJob.id, status: this.workspace.lookJob.status, completed: this.workspace.lookJob.completed, total: this.workspace.lookJob.total }, reusedLookResponses: this.lookCheckpoints.reused, play: { chatId: view.chatId, current: view.current, next: view.next, enabled: view.enabled, sceneCount: view.scenes.length, busy: view.busy }, repairJob:this.workspace.repairJob&&{status:this.workspace.repairJob.status,completed:this.workspace.repairJob.completed,total:this.workspace.repairJob.total}, entries: [...this.entries] };
      }
      default: throw new Error('Unknown Set Points action. Reload the extension.');
    }
  }
  dispose() { this.abort?.abort(); this.visualAbort?.abort(); this.checkAbort?.abort(); this.repairAbort?.abort(); this.lookAbort?.abort(); }
  async waitForImport() { await this.jobTask; }
  async waitForRepair() { await this.repairTask; }
  async waitForVisuals() { await this.visualTask; }
  async waitForLooks() { await this.lookTask; }
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
