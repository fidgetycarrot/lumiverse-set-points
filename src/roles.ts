import type { CastMember, ImportOptions, StoryDraft, StoryRoles } from './types';

export interface RoleIssue { fieldKey: string; sceneId?: string; kind: 'agency'|'viewpoint'|'identity'; message: string }
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = (text: string) => text.trim();
function matchCharacter(cast: CastMember[], label: string): CastMember|undefined {
  const role = label.trim().toLocaleLowerCase();
  const matches = cast.filter(person => [person.name, ...person.aliases].some(name => {
    const key = name.trim().toLocaleLowerCase();
    return key && (role === key || role.startsWith(`${key},`) || role.startsWith(`${key} (`));
  }));
  return matches.length === 1 ? matches[0] : undefined;
}
export function defaultRoles(draft: Pick<StoryDraft,'cast'|'playerRole'>): StoryRoles {
  return { narration: 'neutral', playerCharacterId: matchCharacter(draft.cast, draft.playerRole)?.id ?? null, viewpointCharacterId: null, sourceViewpoint: '' };
}
export function validateRoles(value: unknown, cast: CastMember[]): StoryRoles {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Narration roles must be an object.');
  const input = value as Record<string,unknown>;
  if (input.narration !== 'neutral' && input.narration !== 'character') throw new Error('Choose an external narrator or a supporting-character viewpoint.');
  const id = (value: unknown): string|null => {
    if (value === null) return null;
    if (typeof value !== 'string' || !cast.some(person => person.id === value)) throw new Error('Narration roles must reference existing cast IDs or a custom player.');
    return value;
  };
  const playerCharacterId = id(input.playerCharacterId), viewpointCharacterId = id(input.viewpointCharacterId);
  if (input.narration === 'neutral' && viewpointCharacterId !== null || input.narration === 'character' && viewpointCharacterId === null) throw new Error('A supporting-character viewpoint needs one narrator character; external narration has none.');
  if (viewpointCharacterId && viewpointCharacterId === playerCharacterId) throw new Error('The human controls that character. Choose external narration or a different supporting-character viewpoint.');
  if (typeof input.sourceViewpoint !== 'string' || input.sourceViewpoint.length > 500) throw new Error('Keep the original story viewpoint under 500 characters.');
  const sourceViewpoint = input.sourceViewpoint.trim();
  if (/\{\{|\}\}|<%|%>|<\s*\/?\s*[a-z]|\[\[SET_POINTS|<!--SET_POINTS/i.test(sourceViewpoint)) throw new Error('Use plain text for the original story viewpoint.');
  return { narration: input.narration, playerCharacterId, viewpointCharacterId, sourceViewpoint };
}
export function rolesForImport(cast: CastMember[], playerRole: string, options: Pick<ImportOptions,'narrationMode'|'narratorCharacter'|'sourceViewpoint'>): StoryRoles {
  const base = defaultRoles({cast,playerRole});
  if (options.narrationMode === 'character') {
    const narrator = matchCharacter(cast, options.narratorCharacter ?? '');
    if (!narrator) throw new Error('The selected narrator name must identify exactly one source cast member. Saved source analysis is retained.');
    base.narration = 'character'; base.viewpointCharacterId = narrator.id;
  }
  base.sourceViewpoint = options.sourceViewpoint ?? '';
  return validateRoles(base, cast);
}
export function roleInstruction(draft: Pick<StoryDraft,'cast'|'playerRole'|'roles'>): string {
  const roles = draft.roles ?? defaultRoles(draft);
  const player = draft.cast.find(person => person.id === roles.playerCharacterId);
  const narrator = draft.cast.find(person => person.id === roles.viewpointCharacterId);
  return `Set Points role contract. The human plays ${draft.playerRole}${player ? ` (cast identity: ${player.name})` : ' (a custom or unbound player role)'}. This role never changes when the source viewpoint changes. In narration, you/your and {{user}} refer only to this human-controlled player, never another cast member. ${roles.narration === 'character' && narrator ? `Narrate in first person as supporting character ${narrator.name}; unquoted I/my refers only to that character. Keep the human's identity separate. Only report player actions or words already supplied by the human; do not invent them. Other cast members retain their own voices.` : 'Use an external narrator. Describe the setting and supporting cast in third person. First person belongs only inside clearly quoted supporting-character dialogue, never unquoted narration.'} ${roles.sourceViewpoint ? `Original source viewpoint: ${roles.sourceViewpoint}. This is source context, not an assignment of the player role.` : ''} The human alone supplies their character's actions, dialogue, thoughts, feelings, choices, and consent. Source events and scene assumptions are conditional; they never authorize inventing the human's decisions. These explicit roles take precedence over incidental viewpoint language in story prose.`;
}
// Local heuristics are review aids, not semantic proof or an automatic rewrite.
function narrative(text: string): string {
  return text.replace(/“[^”]*”|"[^"\n]*"|‘[^’\n]*’/g, ' ');
}
const action = '(?:say|says|said|ask|asks|asked|answer|answers|answered|whisper|whispers|whispered|decide|decides|decided|choose|chooses|chose|agree|agrees|agreed|nod|nods|nodded|smile|smiles|smiled|grin|grins|grinned|lean|leans|leaned|walk|walks|walked|step|steps|stepped|reach|reaches|reached|grab|grabs|grabbed|push|pushes|pushed|pull|pulls|pulled|think|thinks|thought|feel|feels|felt|remember|remembers|remembered|tell|tells|told|know|knows|knew|want|wants|wanted|believe|believes|believed|consent|consents|consented|freeze|freezes|froze)';
export function roleIssues(draft: StoryDraft): RoleIssue[] {
  const roles = draft.roles ?? defaultRoles(draft), result: RoleIssue[] = [];
  const player = draft.cast.find(person => person.id === roles.playerCharacterId);
  const names = player ? [player.name,...player.aliases].filter(name => name.trim().length >= 3 && !/^(?:man|woman|boy|girl|brother|sister|he|she|they|you)$/i.test(name)) : [];
  const playerActor = names.length ? new RegExp(`(?:\\{\\{user\\}\\}|\\b(?:${names.map(escape).join('|')})\\b)\\s+${action}\\b`, 'i') : /\{\{user\}\}\s+(?:says?|said|walks?|decides?|chooses?|thinks?|feels?)\b/i;
  const youAction = new RegExp(`\\byou\\s+(?:(?:then|already|finally|quietly|slowly|suddenly|reluctantly|still|now|also|just)\\s+)*${action}\\b`,'i');
  const otherNames = draft.cast.filter(person=>person.id!==roles.playerCharacterId).map(person=>person.name).filter(name=>name.length>=3);
  const wrongIdentity = otherNames.length ? new RegExp(`\\b(?:you are|you were|your name is)\\s+(?:${otherNames.map(escape).join('|')})(?=\\W|$)`,'i') : null;
  for (const scene of draft.scenes) {
    const body = narrative(scene.greeting), fieldKey = `scene:${scene.id}:greeting`;
    if (youAction.test(body) || playerActor.test(body)) result.push({fieldKey,sceneId:scene.id,kind:'agency',message:'This opening may assign an action, line, feeling, or decision to the player. Check that the player supplied it or that it belongs in a conditional assumption.'});
    if (roles.narration === 'neutral' && /\bI\b|\b[Mm]y\b|\b[Mm]yself\b/.test(body)) result.push({fieldKey,sceneId:scene.id,kind:'viewpoint',message:'Unquoted first-person wording may conflict with the external narrator. Check who is speaking.'});
    if (wrongIdentity?.test(body)) result.push({fieldKey,sceneId:scene.id,kind:'identity',message:'This opening may identify the player as a different cast member.'});
  }
  const firstPersonRule = /(?:narrate|narration|write|tell|use|perspective|viewpoint|voice|inside).{0,90}first[ -]person|first[ -]person.{0,90}(?:narration|perspective|viewpoint|head)/i;
  const forbidsFirst = /(?:never|do not|don't|avoid|no).{0,60}first[ -]person/i;
  const directions = [
    {fieldKey:'narratorInstructions',text:draft.narratorInstructions},
    ...draft.scenes.map(scene=>({fieldKey:`scene:${scene.id}:direction`,sceneId:scene.id,text:scene.direction})),
    ...draft.lore.map(entry=>({fieldKey:`lore:${entry.id}:content`,text:entry.content})),
    ...draft.cast.flatMap(person=>['personality','voice'].map(key=>({fieldKey:`cast:${person.id}:${key}`,text:person[key as 'personality'|'voice']}))),
  ];
  for (const entry of directions) if (roles.narration === 'neutral' && firstPersonRule.test(entry.text) && !forbidsFirst.test(entry.text) || roles.narration === 'character' && forbidsFirst.test(entry.text)) result.push({fieldKey:entry.fieldKey,sceneId:'sceneId' in entry?entry.sceneId:undefined,kind:'viewpoint',message:'This direction may contradict the selected narration style. Review the field and role settings together.'});
  return result;
}
// A compact edit detector for review acknowledgment, not an authentication token.
export function roleReviewFingerprint(draft: StoryDraft): string {
  const roles=draft.roles??defaultRoles(draft);
  const value = JSON.stringify({id:clean(draft.id),playerRole:clean(draft.playerRole),roles:{...roles,sourceViewpoint:clean(roles.sourceViewpoint)},narratorInstructions:clean(draft.narratorInstructions),cast:draft.cast.map(person=>({id:person.id,name:clean(person.name),aliases:person.aliases.map(clean),personality:clean(person.personality),voice:clean(person.voice)})),lore:draft.lore.map(entry=>({id:entry.id,content:clean(entry.content)})),scenes:draft.scenes.map(scene=>({id:scene.id,greeting:clean(scene.greeting),direction:clean(scene.direction),assumptions:scene.assumptions.map(clean)}))});
  let hash = 14695981039346656037n;
  for (let i=0;i<value.length;i++) { hash ^= BigInt(value.charCodeAt(i)); hash = BigInt.asUintN(64,hash*1099511628211n); }
  return `${value.length}:${hash.toString(16).padStart(16,'0')}`;
}
export function requireRoleReview(draft: StoryDraft) {
  if (roleIssues(draft).length && draft.roleReview !== roleReviewFingerprint(draft)) throw new Error('Review the player and viewpoint checks in Review before saving to Lumiverse. Correct the flagged fields or explicitly mark the current checks reviewed. No model request was made.');
}
