import { roleInstruction, requireRoleReview } from './roles';
import type { SpindleAPI, WorldBookEntryCreateDTO } from 'lumiverse-spindle-types';
import { APPEARANCE_CONTINUITY_RULE, APPEARANCE_RULE, appearanceGuide, cardPayload, validateDraft } from './importer';
import { EXTENSION_ID, type SavedStory, type StoryDraft } from './types';

type Receipt = { key: string; draftId: string; worldBookId?: string; characterId?: string; complete?: boolean };
export async function draftKey(draft: StoryDraft): Promise<string> {
  // Publication guidance changed in 0.1.10. A new receipt creates a fresh card
  // instead of returning a pre-update card with the old restrictive rules.
  // Draft identity and paid model-response checkpoints are unaffected.
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ publicationRevision: 3, draft })));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function worldEntries(draft: StoryDraft): WorldBookEntryCreateDTO[] {
  const approvedAppearances = appearanceGuide(draft);
  return [
    ...(approvedAppearances ? [{ comment: 'Approved character appearances', key: [], constant: true,
      probability: 100, use_probability: false, priority: 100, content: `${APPEARANCE_RULE}\n\n${approvedAppearances}` }] : []),
    { comment: 'Premise and player role', constant: true, content: `${draft.premise}\n\nPlayer: ${draft.playerRole}\nStarting point: ${draft.startingPoint}\n\n${roleInstruction(draft)}\nThese are starting facts. Later events in the chat take precedence. Leave the player’s actions, thoughts, and speech to them.\n\n${APPEARANCE_CONTINUITY_RULE}` },
    ...draft.cast.map(member => ({ comment: member.name, key: [member.name, ...member.aliases], constant: false,
      content: `${member.name}\nPersonality: ${member.personality}\nVoice: ${member.voice}\nRelationships at the start: ${member.relationships}\nKnowledge at the start: ${member.knowledge}\nUse subsequent chat events for changes to these starting facts.` })),
    ...draft.lore.map(entry => ({ comment: entry.name, key: entry.keys, constant: entry.keys.length === 0, content: entry.content })),
  ].map(entry => ({ ...entry, disabled: false, use_regex: false, prevent_recursion: true, exclude_recursion: true, vectorized: false }));
}

/** Owned receipts and resource markers make retrying an interrupted save resumable. */
export class CardPublisher {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private api: SpindleAPI, private userId?: string) {}
  publish(input: unknown): Promise<SavedStory> {
    const run = this.queue.then(() => this.create(validateDraft(input)));
    this.queue = run.catch(() => {});
    return run;
  }
  private async create(draft: StoryDraft): Promise<SavedStory> {
    for (const permission of ['characters', 'world_books']) if (!this.api.permissions.has(permission)) throw new Error(`Grant ${permission} in Lumiverse’s Extensions panel to save a card.`);
    requireRoleReview(draft);
    const key = await draftKey(draft);
    const path = `receipts/${key}.json`;
    const marker = { key, draftId: draft.id };
    const readMarker = (data: Record<string, unknown> | undefined) => (data?.[EXTENSION_ID] as { key?: string } | undefined)?.key;
    const persist = (receipt: Receipt) => this.api.userStorage.setJson(path, receipt, { userId: this.userId });
    const receipt = await this.api.userStorage.getJson<Receipt>(path, { fallback: marker, userId: this.userId });
    // Always search for a committed card first: a host write may have succeeded
    // immediately before its reply or our storage acknowledgement was lost.
    let existing: { id: string; world_book_ids?: string[] } | undefined;
    for (let offset = 0; ; offset += 100) {
      if (offset >= 100_000) throw new Error('Card recovery scan exceeded its limit. Contact support before retrying.');
      const page = await this.api.characters.list({ offset, limit: 100, userId: this.userId });
      existing = page.data.find(card => readMarker(card.extensions) === key);
      if (existing || offset + page.data.length >= page.total) break;
      if (!page.data.length) throw new Error('Card recovery could not finish. Retry when your library is available.');
    }
    if (existing) {
      const worldBookId = receipt.worldBookId || existing.world_book_ids?.[0];
      if (!worldBookId || !existing.world_book_ids?.includes(worldBookId) || !await this.api.world_books.get(worldBookId, this.userId)) throw new Error('The saved card was found but its world book was removed or detached. Check its attachments in Characters before retrying.');
      const saved = { characterId: existing.id, worldBookId, draftId: draft.id, title: draft.title };
      await persist({ ...receipt, characterId: existing.id, worldBookId, complete: true });
      return saved;
    }
    if (receipt.characterId) throw new Error('The previously saved card was removed. Import the draft with a new ID to create another copy.');
    if (receipt.worldBookId && !await this.api.world_books.get(receipt.worldBookId, this.userId)) throw new Error('The partially saved world book was removed. Import the draft with a new ID to start a new save.');
    if (!receipt.worldBookId) {
      for (let offset = 0; ; offset += 100) {
        if (offset >= 100_000) throw new Error('World book recovery scan exceeded its limit.');
        const page = await this.api.world_books.list({ offset, limit: 100, userId: this.userId });
        const found = page.data.find(book => readMarker(book.metadata) === key);
        if (found) { receipt.worldBookId = found.id; break; }
        if (offset + page.data.length >= page.total) break;
        if (!page.data.length) throw new Error('World book recovery could not finish.');
      }
    }
    if (!receipt.worldBookId) {
      const book = await this.api.world_books.create({ name: `${draft.title} · Set Points`, description: 'Starting cast and lore. Created by Set Points.', metadata: { [EXTENSION_ID]: marker } }, this.userId);
      receipt.worldBookId = book.id;
    }
    await persist(receipt);
    const entries = worldEntries(draft);
    const existingIndices = new Set<number>();
    for (let offset = 0; ; offset += 100) {
      const page = await this.api.world_books.entries.list(receipt.worldBookId, { offset, limit: 100, userId: this.userId });
      for (const entry of page.data) {
        const mark = entry.extensions?.[EXTENSION_ID] as { key?: string; index?: number } | undefined;
        if (mark?.key === key && typeof mark.index === 'number') existingIndices.add(mark.index);
      }
      if (offset + page.data.length >= page.total) break;
      if (!page.data.length || offset >= 100_000) throw new Error('Could not finish reading the partially saved lore.');
    }
    for (let index = 0; index < entries.length; index++) {
      if (!existingIndices.has(index)) await this.api.world_books.entries.create(receipt.worldBookId, { ...entries[index], extensions: { [EXTENSION_ID]: { ...marker, index } } }, this.userId);
    }
    const payload = cardPayload(draft);
    const card = await this.api.characters.create({ ...payload, world_book_ids: [receipt.worldBookId], extensions: { ...payload.extensions, [EXTENSION_ID]: { ...payload.extensions[EXTENSION_ID], ...marker } } }, this.userId);
    receipt.characterId = card.id;
    receipt.complete = true;
    await persist(receipt);
    return { characterId: card.id, worldBookId: receipt.worldBookId, draftId: draft.id, title: draft.title };
  }
}
