import type { SpindleAPI } from 'lumiverse-spindle-types';
import type { GenerationMessage } from './importer';

const FORMAT = 1;
const MAX_BYTES = 1_000_000;
type JsonRecord = Record<string, unknown>;
type Entry = { format: 1; key: string; attemptId: string; kind: 'response'; state: 'complete'|'rejected'; response: JsonRecord };
type Intent = { format: 1; key: string; attemptId: string; kind: 'intent'; state: 'pending'|'failed' };
type Checkpoint = Entry|Intent;
export class CheckpointError extends Error {
  constructor(readonly code: 'UNCERTAIN_REQUEST'|'STORAGE_ERROR', message: string) { super(message); this.name = 'CheckpointError'; }
}
const storageError = () => new CheckpointError('STORAGE_ERROR', 'The paid response checkpoint could not be saved or read safely. No further model request was sent. Retry to recover the saved response; do not clear extension storage.');
const uncertainError = (error?: unknown) => {
  const code = record(error).code;
  const cause = typeof code === 'string' && ['TIMEOUT', 'CANCELLED', 'CONNECTION_FAILED', 'REQUEST_FAILED'].includes(code) ? `${code}; ` : '';
  return new CheckpointError('UNCERTAIN_REQUEST', `The previous request may have been charged, but no completed response was recovered. Retry the unfinished request explicitly only if you accept that it may be charged again. (${cause}UNCERTAIN_REQUEST)`);
};
function record(value: unknown): JsonRecord { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function canonical(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(item => item === undefined ? null : normalize(item));
    if (input !== null && typeof input === 'object') return Object.fromEntries(Object.keys(input).sort().filter(key => (input as JsonRecord)[key] !== undefined).map(key => [key, normalize((input as JsonRecord)[key])]));
    if (input === null || typeof input === 'string' || typeof input === 'boolean' || typeof input === 'number' && Number.isFinite(input)) return input;
    throw storageError();
  };
  return JSON.stringify(normalize(value));
}
async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function safeNumber(value: unknown): number|undefined { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined; }
/** Keep answer text privately, but never persist opaque provider metadata or tool arguments. */
function savedResponse(result: unknown): JsonRecord {
  const raw = record(result), response: JsonRecord = {};
  for (const key of ['content', 'reasoning', 'finish_reason']) if (typeof raw[key] === 'string') response[key] = raw[key];
  if (raw.refusal) response.refusal = true;
  if (raw.error) response.error = true;
  const details = record(raw.stop_details), stop: JsonRecord = {};
  for (const key of ['type', 'category']) if (typeof details[key] === 'string') stop[key] = details[key];
  if (Object.keys(stop).length) response.stop_details = stop;
  // Consumers need presence, not the opaque reasoning blocks or their contents.
  if (Array.isArray(raw.reasoning_details) && raw.reasoning_details.length) response.reasoning_details = [{}];
  const usage: JsonRecord = {}, inputUsage = record(raw.usage);
  for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens']) {
    const value = safeNumber(inputUsage[key]);
    if (value !== undefined) usage[key] = value;
  }
  const reasoningTokens = safeNumber(record(record(inputUsage.provider_raw).completion_tokens_details).reasoning_tokens);
  if (reasoningTokens !== undefined) usage.provider_raw = { completion_tokens_details: { reasoning_tokens: reasoningTokens } };
  if (Object.keys(usage).length) response.usage = usage;
  return response;
}
function knownFailure(error: unknown): boolean {
  const value = record(error);
  if (['TIMEOUT', 'CANCELLED', 'CONNECTION_FAILED', 'REQUEST_FAILED'].includes(String(value.code)) || ['AbortError', 'TimeoutError'].includes(String(value.name))) return false;
  if (typeof value.status === 'number' && value.status >= 400 && value.status <= 599) return true;
  return ['AUTHENTICATION', 'REQUEST_DENIED', 'RATE_LIMIT', 'CONTEXT_LIMIT', 'DECLINED', 'MODEL_UNAVAILABLE', 'INVALID_REQUEST', 'PROVIDER_UNAVAILABLE'].includes(String(value.code));
}

/** Per-user paid-call journal. It never dispatches a model request on its own. */
export class ResponseCheckpoints {
  reused = 0;
  private retryUncertain = false;
  private last?: { key: string; attemptId: string };
  private uncommitted = new Map<string, Entry>();
  private serial: Promise<unknown> = Promise.resolve();
  private active = 0;
  constructor(private api: SpindleAPI, private userId?: string) {}
  beginRun(options: { retryUncertain?: boolean } = {}): void {
    if (this.active) throw new CheckpointError('STORAGE_ERROR', 'Wait for the current request checkpoint to finish before starting another import.');
    this.reused = 0; this.last = undefined; this.retryUncertain = options.retryUncertain === true;
  }
  private locked<T>(work: () => Promise<T>): Promise<T> {
    this.active++;
    const result = this.serial.catch(() => {}).then(work);
    this.serial = result;
    return result.finally(() => { this.active--; });
  }
  private path(key: string, kind: 'response'|'intent'): string { return `imports/responses/${key}${kind === 'intent' ? '.intent' : ''}.json`; }
  private async keys(messages: GenerationMessage[], primary: unknown, fallbacks: unknown[] = []): Promise<string[]> {
    try {
      const keys = await Promise.all([primary, ...fallbacks].map(connectionFingerprint => digest(canonical({ format: FORMAT, messages, connectionFingerprint }))));
      return [...new Set(keys)];
    } catch { throw storageError(); }
  }
  private async encode(value: Checkpoint): Promise<string> {
    const body = canonical(value);
    const serialized = canonical({ ...value, checksum: await digest(body) });
    if (new TextEncoder().encode(serialized).byteLength > MAX_BYTES) throw storageError();
    return serialized;
  }
  private async decode(serialized: string, key: string, kind: 'response'|'intent'): Promise<Checkpoint> {
    if (new TextEncoder().encode(serialized).byteLength > MAX_BYTES) throw storageError();
    const value = record(JSON.parse(serialized)), { checksum, ...body } = value;
    if (body.format !== FORMAT || body.key !== key || body.kind !== kind || typeof body.attemptId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(body.attemptId) || checksum !== await digest(canonical(body))) throw storageError();
    if (kind === 'response') {
      if (!['complete', 'rejected'].includes(String(body.state)) || !body.response || canonical(body.response) !== canonical(savedResponse(body.response))) throw storageError();
      if (Object.keys(body).sort().join(',') !== 'attemptId,format,key,kind,response,state') throw storageError();
    } else if (!['pending', 'failed'].includes(String(body.state)) || Object.keys(body).sort().join(',') !== 'attemptId,format,key,kind,state') throw storageError();
    return body as Checkpoint;
  }
  private async write(value: Checkpoint): Promise<void> {
    try {
      const data = await this.encode(value), path = this.path(value.key, value.kind), temp = `${path}.tmp`;
      await this.api.userStorage.write(temp, data, this.userId);
      if (await this.api.userStorage.read(temp, this.userId) !== data) throw storageError();
      await this.api.userStorage.move(temp, path, this.userId);
      if (await this.api.userStorage.read(path, this.userId) !== data) throw storageError();
    } catch { throw storageError(); }
  }
  private async read(key: string, kind: 'response'|'intent'): Promise<Checkpoint|undefined> {
    try {
      const path = this.path(key, kind), temp = `${path}.tmp`;
      // A complete temporary file represents the latest intended write, including
      // a rejection marker. Recover it even if the older primary still exists.
      if (await this.api.userStorage.exists(temp, this.userId)) {
        const data = await this.api.userStorage.read(temp, this.userId);
        const value = await this.decode(data, key, kind);
        await this.api.userStorage.move(temp, path, this.userId);
        if (await this.api.userStorage.read(path, this.userId) !== data) throw storageError();
        return value;
      }
      if (!(await this.api.userStorage.exists(path, this.userId))) return undefined;
      return await this.decode(await this.api.userStorage.read(path, this.userId), key, kind);
    } catch { throw storageError(); }
  }
  private async requireSettled(keys: string[], responses: Map<string, Entry|undefined>): Promise<void> {
    for (const key of keys) {
      const response = responses.has(key) ? responses.get(key) : await this.read(key, 'response') as Entry|undefined;
      const intent = await this.read(key, 'intent') as Intent|undefined;
      if (intent?.state === 'pending' && intent.attemptId !== response?.attemptId && !this.retryUncertain) throw uncertainError();
    }
  }
  /** Inspect a paid result without dispatching or selecting it for invalidation. */
  peek(messages: GenerationMessage[], connectionFingerprint: unknown, options: { includeRejected?: boolean; reuseFingerprints?: unknown[]; requireSettled?: boolean } = {}): Promise<unknown|undefined> {
    return this.locked(async () => {
      const keys = await this.keys(messages, connectionFingerprint, options.reuseFingerprints);
      const responses = new Map<string, Entry|undefined>();
      let candidate: Entry|undefined;
      let rejectedPrimary: Entry|undefined;
      for (const [index, key] of keys.entries()) {
        const held = this.uncommitted.get(key);
        if (held) {
          await this.write(held);
          this.uncommitted.delete(key);
        }
        const entry = held ?? await this.read(key, 'response') as Entry|undefined;
        responses.set(key, entry);
        // Rejected historical attempts must not become successful answers just
        // because the caller changed its request allowance or reasoning setting.
        if (!entry) continue;
        if (entry.state === 'rejected') {
          if (index === 0 && options.includeRejected) rejectedPrimary = entry;
          continue;
        }
        candidate ??= entry;
        if (!options.requireSettled) break;
      }
      // Raw "complete" entries may still fail caller validation. A schema-change
      // probe must resolve every older attempt before such a failure can cause
      // new paid work under different messages.
      if (options.requireSettled) await this.requireSettled(keys, responses);
      candidate ??= rejectedPrimary;
      if (candidate) {
        this.reused++;
        return structuredClone(candidate.response);
      }
      return undefined;
    });
  }
  request(messages: GenerationMessage[], connectionFingerprint: unknown, generate: () => Promise<unknown>, options: { reuseFingerprints?: unknown[] } = {}): Promise<unknown> {
    return this.locked(async () => {
      this.last = undefined;
      const keys = await this.keys(messages, connectionFingerprint, options.reuseFingerprints);
      const previous = new Map<string, Entry|undefined>();
      for (const key of keys) {
        const held = this.uncommitted.get(key);
        if (held) {
          await this.write(held);
          this.uncommitted.delete(key);
          this.reused++; this.last = { key, attemptId: held.attemptId };
          return structuredClone(held.response);
        }
        const entry = await this.read(key, 'response') as Entry|undefined;
        previous.set(key, entry);
        if (entry?.state === 'complete') {
          this.reused++; this.last = { key, attemptId: entry.attemptId };
          return structuredClone(entry.response);
        }
      }
      // Only a new dispatch needs uncertainty approval. Reusing a completed
      // answer above costs nothing even if another attempt has an unknown result.
      await this.requireSettled(keys, previous);
      const key = keys[0];
      const attempt: Intent = { format: FORMAT, key, attemptId: crypto.randomUUID(), kind: 'intent', state: 'pending' };
      await this.write(attempt);
      let result: unknown;
      try { result = await generate(); }
      catch (error) {
        if (!knownFailure(error)) throw uncertainError(error);
        await this.write({ ...attempt, state: 'failed' });
        throw error;
      }
      const entry: Entry = { format: FORMAT, key, attemptId: attempt.attemptId, kind: 'response', state: 'complete', response: savedResponse(result) };
      // Keep the paid answer in memory until durable storage acknowledges it.
      // A retry can save it again without another model request.
      this.uncommitted.set(key, entry);
      await this.write(entry);
      this.uncommitted.delete(key);
      this.last = { key, attemptId: entry.attemptId };
      return structuredClone(entry.response);
    });
  }
  invalidateLast(): Promise<void> {
    return this.locked(async () => {
      const last = this.last;
      if (!last) return;
      const entry = await this.read(last.key, 'response') as Entry|undefined;
      if (!entry || entry.attemptId !== last.attemptId) throw storageError();
      await this.write({ ...entry, state: 'rejected' });
      this.last = undefined;
    });
  }
}
