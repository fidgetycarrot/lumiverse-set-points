import type { CastMember, ImportOptions, StoryDraft, StoryRoles } from './types';

export interface RoleIssue { fieldKey: string; sceneId?: string; kind: 'agency'|'viewpoint'|'identity'; message: string; excerpt?: string; start?:number; end?:number }
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
// A name counts only as a whole word, so "Ana" never matches inside "Banana".
function nameKeys(person: CastMember): string[] {
  return [person.name, ...person.aliases].map(name => name.trim()).filter(name => name.length >= 2 && !/^(?:man|woman|boy|girl|he|she|they|you|i)$/i.test(name));
}
export function mentionCount(text: string, person: CastMember): number {
  const keys = nameKeys(person);
  if (!keys.length || !text) return 0;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${keys.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  return [...text.matchAll(pattern)].length;
}
/** The one cast member named in free text, if exactly one is. */
function soleNamed(cast: CastMember[], text: string): CastMember|undefined {
  const named = cast.filter(person => mentionCount(text, person) > 0);
  return named.length === 1 ? named[0] : undefined;
}
/**
 * Who the source story mostly follows, when the human joins as someone new.
 * The original viewpoint field wins when it names one cast member. Otherwise it
 * is the character the rest of the cast, the premise, and the lore talk about
 * most. Scene text is left out on purpose: when an opening has wrongly put the
 * human in the lead's place, the lead's name is exactly what goes missing there.
 * Returns nothing when the human plays a source character or no one clearly leads.
 */
export function sourceLead(draft: Pick<StoryDraft,'cast'|'playerRole'|'roles'> & Partial<Pick<StoryDraft,'premise'|'lore'>>): CastMember|undefined {
  const roles = draft.roles ?? defaultRoles(draft);
  if (roles.playerCharacterId) return undefined;
  const named = soleNamed(draft.cast, roles.sourceViewpoint);
  if (named) return named;
  const shared = [draft.premise ?? '', ...(draft.lore ?? []).map(entry => entry.content)].join('\n');
  const ranked = draft.cast.map(person => {
    const others = draft.cast.filter(other => other.id !== person.id).map(other => `${other.relationships}\n${other.knowledge}`).join('\n');
    return { person, count: mentionCount(others, person) + mentionCount(shared, person) };
  }).sort((a, b) => b.count - a.count);
  return ranked[0] && ranked[0].count >= 2 && ranked[0].count > (ranked[1]?.count ?? 0) ? ranked[0].person : undefined;
}
/** Who the source follows, from who takes part in the most events. Used before scenes exist. */
export function leadFromEvents(cast: CastMember[], events: Array<{ participants: string[] }>, sourceViewpoint = ''): CastMember|undefined {
  const named = soleNamed(cast, sourceViewpoint);
  if (named) return named;
  const ranked = cast.map(person => ({ person, count: events.filter(event => event.participants.some(name => matchCharacter([person], name))).length })).sort((a, b) => b.count - a.count);
  return ranked[0] && ranked[0].count >= 2 && ranked[0].count > (ranked[1]?.count ?? 0) ? ranked[0].person : undefined;
}
/** The newcomer rule: the source's main character stays someone else. */
export function newcomerRule(lead?: string): string {
  return `The human's character is someone new, not any character from the source story. ${lead ? `${lead}, whom the source story follows, stays a separate supporting character voiced by the narrator.` : 'The source story\'s main character stays a separate supporting character voiced by the narrator.'} Never give the human that character's body, history, memories, sensations, belongings, injuries, blessings, relationships, or experiences: what happened to them in the source happened to them, not to the human. "You" means only the newcomer, who meets the cast as a separate person and knows only what they have seen or been told.`;
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
/** `newcomer: false` reproduces the pre-0.1.15 wording, so saved paid answers to older prompts stay reusable. */
export function roleInstruction(draft: Pick<StoryDraft,'cast'|'playerRole'|'roles'|'openingStyle'> & Partial<Pick<StoryDraft,'premise'|'lore'>>, options: { newcomer?: boolean } = {}): string {
  const roles = draft.roles ?? defaultRoles(draft);
  const player = draft.cast.find(person => person.id === roles.playerCharacterId);
  const narrator = draft.cast.find(person => person.id === roles.viewpointCharacterId);
  const newcomer = player || options.newcomer === false ? '' : ` ${newcomerRule(sourceLead(draft)?.name)}`;
  const contract = `Set Points role contract. The human plays ${draft.playerRole}${player ? ` (cast identity: ${player.name})` : ' (a custom or unbound player role)'}. This role never changes when the source viewpoint changes.${newcomer} In narration, you/your and {{user}} refer only to this human-controlled player, never another cast member. ${roles.narration === 'character' && narrator ? `Narrate in first person as supporting character ${narrator.name}; unquoted I/my refers only to that character. Keep the human's identity separate. Only report player actions or words already supplied by the human; do not invent them. Other cast members retain their own voices.` : 'Use an external narrator. Describe the setting and supporting cast in third person. First person belongs only inside clearly quoted supporting-character dialogue, never unquoted narration.'} ${roles.sourceViewpoint ? `Original source viewpoint: ${roles.sourceViewpoint}. This is source context, not an assignment of the player role.` : ''} The human alone supplies their character's actions, dialogue, thoughts, feelings, choices, and consent. Source events and scene assumptions are conditional; they never authorize inventing the human's decisions. These explicit roles take precedence over incidental viewpoint language in story prose.`;
  if(draft.openingStyle!=='story')return contract;
  return contract.replace("Only report player actions or words already supplied by the human; do not invent them.","During live chat, report only player actions or words already supplied by the human; do not invent them.").replace("The human alone supplies their character's actions, dialogue, thoughts, feelings, choices, and consent. Source events and scene assumptions are conditional; they never authorize inventing the human's decisions.","Stored scene openings use Story excerpt style: they may contain preset source actions, dialogue, and internal states for the selected player as part of that scripted setup. They must retain the selected player identity and narration style. During live chat after the opening, the human alone supplies new actions, dialogue, thoughts, feelings, choices, and consent. Do not replay or extrapolate preset actions as fresh player decisions. Previous-choice prerequisites must agree with actual chat events before an automatic transition; if they do not, stay in the current scene and let the human choose. Force deliberately inserts a scripted setup and still needs continuity review.");
}
// Local heuristics are review aids, not semantic proof or an automatic rewrite.
function narrative(text: string): string {
  // Preserve offsets so review can select the exact match in the original editor.
  // Apostrophes inside words are not dialogue delimiters.
  return text.replace(/“[^”]*”|"[^"]*"|‘[^’]*’|(?<![\p{L}\p{N}])'(?:[^']|'(?=[\p{L}\p{N}]))*'(?=$|[\s.,!?;:)\]])/gu,quote=>quote.replace(/[^\n\r]/g,' '));
}
const action = '(?:say|says|said|ask|asks|asked|answer|answers|answered|whisper|whispers|whispered|decide|decides|decided|choose|chooses|chose|agree|agrees|agreed|nod|nods|nodded|smile|smiles|smiled|grin|grins|grinned|lean|leans|leaned|walk|walks|walked|step|steps|stepped|reach|reaches|reached|grab|grabs|grabbed|push|pushes|pushed|pull|pulls|pulled|think|thinks|thought|feel|feels|felt|remember|remembers|remembered|tell|tells|told|know|knows|knew|want|wants|wanted|believe|believes|believed|consent|consents|consented|freeze|freezes|froze)';
function optionalAction(body:string,match:RegExpMatchArray):boolean {
  const index=match.index!,before=body.slice(0,index),boundary=Math.max(...['.','!','?',';',',','\n','\r'].map(mark=>before.lastIndexOf(mark)));
  const prefix=before.slice(boundary+1).trim().replace(/^[*#>\s]+/,'');
  if(/(?:^|\s)(?:if|unless|whether)\b/i.test(prefix))return true;
  const past=/\b(?:said|asked|answered|whispered|decided|chose|agreed|nodded|smiled|grinned|leaned|walked|stepped|reached|grabbed|pushed|pulled|thought|felt|remembered|told|knew|wanted|believed|consented|froze)$/i.test(match[0]);
  if(!past&&/^(?:when|once|until)\b/i.test(prefix))return true;
  // Questions that invite the human to supply a feeling/choice are not assertions.
  const rest=body.slice(index+match[0].length),nextPunctuation=rest.match(/[.!?\n\r]/)?.[0];
  return nextPunctuation==='?'&&/^(?:what|why|how|where|when|do|did|can|could|would|will|should|might)\b/i.test(prefix);
}
function matchedText(text:string,match:RegExpMatchArray):Pick<RoleIssue,'excerpt'|'start'|'end'> {
  const start=match.index!,end=start+match[0].length,from=Math.max(0,start-40),to=Math.min(text.length,end+60);
  return {start,end,excerpt:`${from?'…':''}${text.slice(from,to).replace(/\s+/g,' ')}${to<text.length?'…':''}`};
}
export function roleIssues(draft: StoryDraft): RoleIssue[] {
  const roles = draft.roles ?? defaultRoles(draft), result: RoleIssue[] = [];
  const player = draft.cast.find(person => person.id === roles.playerCharacterId);
  const names = player ? [player.name,...player.aliases].filter(name => name.trim().length >= 3 && !/^(?:man|woman|boy|girl|brother|sister|he|she|they|you)$/i.test(name)) : [];
  const actor=`(?:\\byou\\b|\\{\\{user\\}\\}${names.length?'|\\b(?:'+names.map(escape).join('|')+')\\b':''})`;
  const playerAction = new RegExp(`${actor}\\s+(?:(?:then|already|finally|quietly|slowly|suddenly|reluctantly|still|now|also|just)\\s+)*${action}\\b`,'gi');
  const otherNames = draft.cast.filter(person=>person.id!==roles.playerCharacterId).map(person=>person.name).filter(name=>name.length>=3);
  const wrongIdentity = otherNames.length ? new RegExp(`\\b(?:you are|you were|your name is)\\s+(?:${otherNames.map(escape).join('|')})(?=\\W|$)`,'i') : null;
  for (const scene of draft.scenes) {
    const body = narrative(scene.greeting), fieldKey = `scene:${scene.id}:greeting`;
    const actionMatch=[...body.matchAll(playerAction)].find(match=>!optionalAction(body,match));
    if (actionMatch && draft.openingStyle!=='story') result.push({fieldKey,sceneId:scene.id,kind:'agency',...matchedText(scene.greeting,actionMatch),message:'This opening may assign an action, line, feeling, or decision to the player. Check the highlighted wording rather than assuming this is a confirmed error.'});
    const firstPerson=roles.narration==='neutral'?/\bI\b|\b[Mm]y\b|\b[Mm]yself\b/.exec(body):null;
    if (firstPerson) result.push({fieldKey,sceneId:scene.id,kind:'viewpoint',...matchedText(scene.greeting,firstPerson),message:'Unquoted first-person wording may conflict with the external narrator. Check who is speaking.'});
    const identity=wrongIdentity?.exec(body);
    if (identity) result.push({fieldKey,sceneId:scene.id,kind:'identity',...matchedText(scene.greeting,identity),message:'This opening may identify the player as a different cast member.'});
  }
  // Joining as someone new: an opening that leaves out the character the source
  // follows, while speaking to "you", may have put the human in their place.
  const lead = player ? undefined : sourceLead(draft);
  if (lead) draft.scenes.forEach((scene, index) => {
    if (mentionCount(scene.greeting, lead) || index > 0 && !mentionCount(scene.direction, lead)) return;
    const you = /\byou(?:r|rs|rself)?\b/i.exec(narrative(scene.greeting));
    if (you) result.push({fieldKey:`scene:${scene.id}:greeting`,sceneId:scene.id,kind:'identity',...matchedText(scene.greeting,you),message:`${lead.name} is part of this scene’s story but isn’t in this opening. Check that “you” is your own character here, not standing in for ${lead.name}.`});
  });
  const firstPersonRule = /(?:narrate|narration|write|tell|use|perspective|viewpoint|voice|inside).{0,90}first[ -]person|first[ -]person.{0,90}(?:narration|perspective|viewpoint|head)/i;
  const forbidsFirst = /(?:never|do not|don't|avoid|no).{0,60}first[ -]person/i;
  const directions = [
    {fieldKey:'narratorInstructions',text:draft.narratorInstructions},
    ...draft.scenes.map(scene=>({fieldKey:`scene:${scene.id}:direction`,sceneId:scene.id,text:scene.direction})),
    ...draft.lore.map(entry=>({fieldKey:`lore:${entry.id}:content`,text:entry.content})),
    ...draft.cast.flatMap(person=>['personality','voice'].map(key=>({fieldKey:`cast:${person.id}:${key}`,text:person[key as 'personality'|'voice']}))),
    ...draft.cast.flatMap(person=>person.notes?[{fieldKey:`cast:${person.id}:motivations`,text:person.notes.motivations},{fieldKey:`cast:${person.id}:reactions`,text:person.notes.reactions}]:[]),
  ];
  for (const entry of directions) if (roles.narration === 'neutral' && firstPersonRule.test(entry.text) && !forbidsFirst.test(entry.text) || roles.narration === 'character' && forbidsFirst.test(entry.text)) result.push({fieldKey:entry.fieldKey,sceneId:'sceneId' in entry?entry.sceneId:undefined,kind:'viewpoint',message:'This direction may contradict the selected narration style. Review the field and role settings together.'});
  return result;
}
// A compact edit detector for review acknowledgment, not an authentication token.
export function roleReviewFingerprint(draft: StoryDraft): string {
  const roles=draft.roles??defaultRoles(draft);
  const value = JSON.stringify({checker:3,openingStyle:draft.openingStyle??'interactive',id:clean(draft.id),playerRole:clean(draft.playerRole),roles:{...roles,sourceViewpoint:clean(roles.sourceViewpoint)},narratorInstructions:clean(draft.narratorInstructions),cast:draft.cast.map(person=>({id:person.id,name:clean(person.name),aliases:person.aliases.map(clean),personality:clean(person.personality),voice:clean(person.voice),...(person.notes?{notes:person.notes}:{})})),lore:draft.lore.map(entry=>({id:entry.id,content:clean(entry.content)})),scenes:draft.scenes.map(scene=>({id:scene.id,greeting:clean(scene.greeting),direction:clean(scene.direction),assumptions:scene.assumptions.map(clean)}))});
  let hash = 14695981039346656037n;
  for (let i=0;i<value.length;i++) { hash ^= BigInt(value.charCodeAt(i)); hash = BigInt.asUintN(64,hash*1099511628211n); }
  return `${value.length}:${hash.toString(16).padStart(16,'0')}`;
}
export function requireRoleReview(draft: StoryDraft) {
  if (roleIssues(draft).length && draft.roleReview !== roleReviewFingerprint(draft)) throw new Error('Review the player and viewpoint checks in Review before saving to Lumiverse. Correct the flagged fields or explicitly mark the current checks reviewed. No model request was made.');
}
