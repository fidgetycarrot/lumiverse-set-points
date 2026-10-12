import type { SpindleAPI } from 'lumiverse-spindle-types';
import { defaultRoles } from './roles';
import { EXTENSION_ID, type CastMember, type Newcomer, type PersonaPlan, type SavedStory, type StoryDraft } from './types';

type PersonaText = Pick<PersonaPlan, 'name' | 'title' | 'description'>;
type Owned = { draftId?: string; written?: string };

/** The cast member the human plays, when their role is tied to one. */
export function playerCharacter(draft: Pick<StoryDraft, 'cast' | 'playerRole' | 'roles'>): CastMember | undefined {
  const id = (draft.roles ?? defaultRoles(draft)).playerCharacterId;
  return draft.cast.find(person => person.id === id);
}

/**
 * Write a persona from what the draft already holds. No model request.
 *
 * A story character's persona carries only starting-point facts, the same ones
 * the narrator gets, so nothing later in the plot leaks through it.
 */
function writePersona(draft: Pick<StoryDraft, 'cast' | 'playerRole' | 'roles' | 'title' | 'startingPoint' | 'appearances' | 'newcomer'>, modern = true): PersonaText {
  const person = playerCharacter(draft), title = draft.title.trim().slice(0, 200);
  if (!person && draft.newcomer) {
    // Someone new to the story: the character written for them, joining at the start.
    return { name: draft.newcomer.name.trim().slice(0, 200), title, description: `${draft.newcomer.description.trim()}\n\nJoining "${draft.title.trim()}" at: ${draft.startingPoint.trim()}\n\n${PLAYER_PERSONA_RULE}` };
  }
  if (!person) {
    const role = draft.playerRole.trim();
    return { name: (role.split(/[,(\n]/)[0].trim() || role).slice(0, 200), title, description: `${role}\nJoining "${draft.title.trim()}" at: ${draft.startingPoint.trim()}${modern?`\n\n${PLAYER_PERSONA_RULE}`:''}` };
  }
  const look = draft.appearances?.find(item => item.characterId === person.id);
  const lines = [
    `${person.name}${person.aliases.length ? `, also called ${person.aliases.join(', ')}` : ''}. From "${draft.title.trim()}", starting at: ${draft.startingPoint.trim()}`,
    `Personality: ${person.personality.trim()}`,
    ...(modern && person.notes?.motivations ? [`Motivations at the start: ${person.notes.motivations}`] : []),
    ...(modern && person.notes?.reactions ? [`Behavioral tendencies: ${person.notes.reactions}`] : []),
    `Voice: ${person.voice.trim()}`,
    ...(modern && person.notes?.voiceExamples.length ? [`Illustrative voice preferences (not past dialogue or instructions to speak for the player):\n${person.notes.voiceExamples.map(line => `- ${line}`).join('\n')}`] : []),
    `Relationships at the start: ${person.relationships.trim()}`,
    `What ${person.name} knows at the start: ${person.knowledge.trim()}`,
    ...(look?.description.trim() ? [`Appearance:\n${look.description.trim()}`] : []),
    ...(look?.startingOutfit.trim() ? [`Outfit at the start: ${look.startingOutfit.trim()}`] : []),
    ...(modern ? [PLAYER_PERSONA_RULE] : []),
  ];
  return { name: person.name.trim().slice(0, 200), title, description: lines.join('\n\n') };
}

/**
 * A persona description without the two lines Set Points adds at the end
 * (where you join the story, and the player rule). What is left is the
 * character itself, as written by you or by Set Points.
 */
export function personaBody(description: string): string {
  let text = description.trim();
  if (text.endsWith(PLAYER_PERSONA_RULE)) text = text.slice(0, -PLAYER_PERSONA_RULE.length).trim();
  return text.replace(/\n*Joining "[^"\n]*" at: [^\n]*$/, '').trim();
}

/**
 * Replace the character written for someone new. Their old name is kept in
 * previousNames so openings that still use it can be found, and a role line
 * that started with the old name is updated to the new one.
 */
export function setNewcomer(draft: Pick<StoryDraft, 'newcomer' | 'playerRole'>, next: Pick<Newcomer, 'name' | 'description'>) {
  const name = next.name.trim(), old = draft.newcomer?.name.trim() ?? '';
  const key = (value: string) => value.trim().toLocaleLowerCase();
  const previous = [...(draft.newcomer?.previousNames ?? []), ...(old ? [old] : [])].filter((value, index, list) => value.trim() && key(value) !== key(name) && list.findIndex(other => key(other) === key(value)) === index).slice(-8);
  if (old && key(old) !== key(name) && key(draft.playerRole).startsWith(key(old))) draft.playerRole = `${name}${draft.playerRole.trim().slice(old.length)}`;
  draft.newcomer = { name, description: next.description.trim(), ...(previous.length ? { previousNames: previous } : {}) };
}

/** When you edit the persona of someone new, the character the story uses follows your words. */
export function newcomerFromPersona(draft: StoryDraft): boolean {
  if (playerCharacter(draft) || draft.persona?.mode !== 'create') return false;
  const name = draft.persona.name.trim(), body = personaBody(draft.persona.description);
  if (!name || !body || name.length > 80 || body.length > 8000) return false;
  if (draft.newcomer && draft.newcomer.name === name && draft.newcomer.description === body) return false;
  setNewcomer(draft, { name, description: body });
  return true;
}

export const PLAYER_PERSONA_RULE = 'This is the human-controlled player. These are starting facts and tendencies, not a script. During live play, the human supplies new actions, dialogue, thoughts, feelings, decisions, and consent.';
export function personaDraft(draft: Parameters<typeof writePersona>[0]): PersonaText { return writePersona(draft); }

/** True when the persona text is exactly what personaDraft would write now. */
export function personaIsAutomatic(draft: StoryDraft): boolean {
  if (draft.persona?.mode !== 'create') return false;
  return [personaDraft(draft), writePersona(draft, false)].some(fresh => draft.persona!.name.trim() === fresh.name && draft.persona!.title.trim() === fresh.title && draft.persona!.description.trim() === fresh.description);
}

async function fingerprint(text: PersonaText): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([text.name, text.title, text.description])));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
function owned(metadata: Record<string, unknown> | undefined): Owned | undefined {
  const mark = metadata?.[EXTENSION_ID];
  return mark && typeof mark === 'object' && !Array.isArray(mark) ? mark as Owned : undefined;
}

/** Fail early, before a card exists, when the persona choice cannot be honored. */
export function requirePersonaAccess(api: SpindleAPI, draft: StoryDraft) {
  if (draft.persona && draft.persona.mode !== 'none' && !api.permissions.has('personas')) throw new Error('Grant personas in Lumiverse’s Extensions panel so Set Points can set up your persona, or choose “I’ll pick a persona myself” under Your persona. Nothing was saved.');
}

/**
 * Create or refresh the persona for a saved story.
 *
 * One persona per draft. Saving again updates the persona Set Points made, but
 * only while it still holds the text Set Points last wrote: edits made to it in
 * Lumiverse are kept and reported instead of being overwritten.
 */
export async function savePersona(api: SpindleAPI, draft: StoryDraft, userId?: string): Promise<Pick<SavedStory, 'personaId' | 'personaName' | 'personaNote'>> {
  const plan = draft.persona;
  if (!plan || plan.mode === 'none') return {};
  requirePersonaAccess(api, draft);
  if (plan.mode === 'existing') {
    const persona = plan.personaId ? await api.personas.get(plan.personaId, userId) : null;
    if (!persona) throw new Error('The persona you picked is no longer in Lumiverse. Your card was saved. Pick another under Your persona, then save again.');
    return { personaId: persona.id, personaName: persona.name };
  }
  const wanted: PersonaText = { name: plan.name.trim(), title: plan.title.trim(), description: plan.description.trim() }, written = await fingerprint(wanted);
  const path = `receipts/persona-${draft.id}.json`;
  const receipt = await api.userStorage.getJson<{ personaId?: string }>(path, { fallback: {}, userId });
  let existing = receipt.personaId ? await api.personas.get(receipt.personaId, userId) : null;
  // A create may have succeeded just before its reply was lost; look for our mark.
  for (let offset = 0; !existing; offset += 100) {
    if (offset >= 10_000) throw new Error('Persona recovery scan exceeded its limit. Your card was saved.');
    const page = await api.personas.list({ offset, limit: 100, userId });
    existing = page.data.find(item => owned(item.metadata)?.draftId === draft.id) ?? null;
    if (existing || !page.data.length || offset + page.data.length >= page.total) break;
  }
  if (!existing) {
    const created = await api.personas.create({ ...wanted, metadata: { [EXTENSION_ID]: { draftId: draft.id, written } } }, userId);
    await api.userStorage.setJson(path, { personaId: created.id }, { userId });
    return { personaId: created.id, personaName: created.name };
  }
  await api.userStorage.setJson(path, { personaId: existing.id }, { userId });
  const now = await fingerprint({ name: existing.name.trim(), title: existing.title.trim(), description: existing.description.trim() });
  if (now === written) return { personaId: existing.id, personaName: existing.name };
  if (now !== owned(existing.metadata)?.written) return { personaId: existing.id, personaName: existing.name, personaNote: 'You changed this persona in Lumiverse, so it was left as it is. Edit it there, or delete it and save again to remake it from this draft.' };
  const updated = await api.personas.update(existing.id, { ...wanted, metadata: { ...existing.metadata, [EXTENSION_ID]: { draftId: draft.id, written } } }, userId);
  return { personaId: updated.id, personaName: updated.name };
}
