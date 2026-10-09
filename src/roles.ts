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
export function roleInstruction(draft: Pick<StoryDraft,'cast'|'playerRole'|'roles'|'openingStyle'>): string {
  const roles = draft.roles ?? defaultRoles(draft);
  const player = draft.cast.find(person => person.id === roles.playerCharacterId);
  const narrator = draft.cast.find(person => person.id === roles.viewpointCharacterId);
  const contract = `Set Points role contract. The human plays ${draft.playerRole}${player ? ` (cast identity: ${player.name})` : ' (a custom or unbound player role)'}. This role never changes when the source viewpoint changes. In narration, you/your and {{user}} refer only to this human-controlled player, never another cast member. ${roles.narration === 'character' && narrator ? `Narrate in first person as supporting character ${narrator.name}; unquoted I/my refers only to that character. Keep the human's identity separate. Only report player actions or words already supplied by the human; do not invent them. Other cast members retain their own voices.` : 'Use an external narrator. Describe the setting and supporting cast in third person. First person belongs only inside clearly quoted supporting-character dialogue, never unquoted narration.'} ${roles.sourceViewpoint ? `Original source viewpoint: ${roles.sourceViewpoint}. This is source context, not an assignment of the player role.` : ''} The human alone supplies their character's actions, dialogue, thoughts, feelings, choices, and consent. Source events and scene assumptions are conditional; they never authorize inventing the human's decisions. These explicit roles take precedence over incidental viewpoint language in story prose.`;
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
  const value = JSON.stringify({checker:2,openingStyle:draft.openingStyle??'interactive',id:clean(draft.id),playerRole:clean(draft.playerRole),roles:{...roles,sourceViewpoint:clean(roles.sourceViewpoint)},narratorInstructions:clean(draft.narratorInstructions),cast:draft.cast.map(person=>({id:person.id,name:clean(person.name),aliases:person.aliases.map(clean),personality:clean(person.personality),voice:clean(person.voice)})),lore:draft.lore.map(entry=>({id:entry.id,content:clean(entry.content)})),scenes:draft.scenes.map(scene=>({id:scene.id,greeting:clean(scene.greeting),direction:clean(scene.direction),assumptions:scene.assumptions.map(clean)}))});
  let hash = 14695981039346656037n;
  for (let i=0;i<value.length;i++) { hash ^= BigInt(value.charCodeAt(i)); hash = BigInt.asUintN(64,hash*1099511628211n); }
  return `${value.length}:${hash.toString(16).padStart(16,'0')}`;
}
export function requireRoleReview(draft: StoryDraft) {
  if (roleIssues(draft).length && draft.roleReview !== roleReviewFingerprint(draft)) throw new Error('Review the player and viewpoint checks in Review before saving to Lumiverse. Correct the flagged fields or explicitly mark the current checks reviewed. No model request was made.');
}
